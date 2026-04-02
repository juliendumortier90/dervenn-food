#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include <WiFiUdp.h>
#include <WDT.h>

#if !defined(ARDUINO_UNOR4_WIFI)
#error "Ce sketch est prevu uniquement pour Arduino UNO R4 WiFi."
#endif

#include <FastLED.h>

#define PIN_REMOTE_RESET_BUTTON 8
#define DATA_PIN 10
#define LED_TYPE WS2811
#define COLOR_ORDER RGB

#define NUM_DIGITS 10
#define SEGMENTS_PER_DIGIT 7
#define NUM_LEDS (NUM_DIGITS * SEGMENTS_PER_DIGIT)

const CRGB COUNTER_COLOR = CRGB::Red;
const uint8_t COUNTER_BRIGHTNESS = 255;
const uint8_t ANIM_BRIGHTNESS = 255;
const uint16_t FRAME_MS = 20;
const uint32_t ANIM_INTERVAL_MS = 60UL * 1000UL * 5UL;
const uint16_t ANIM_MS = 8000;
const bool BOTTOM_ROW_REVERSED = true;

const char *WIFI_SSID = "androidap";
const char *WIFI_PASSWORD = "n4l6c21u$76!.";
const char *BIKE_HTTP_HOST = "n4l6c21u76.execute-api.eu-west-3.amazonaws.com";
const char *BIKE_STATS_GET_PATH = "/prod/bike/stats";
const char *BIKE_RESET_SESSION_POST_PATH = "/prod/bike/resetsession";
const char *BIKE_AUTH_HEADER = "Basic Zm9vZDpwZXBkZXV4";
const uint16_t BIKE_HTTPS_PORT = 443;
const uint16_t DIGIT_UDP_PORT = 4210;
const uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
const uint32_t REMOTE_POLL_INTERVAL_MS = 5UL * 60UL * 1000UL;
const uint16_t HTTP_TIMEOUT_MS = 10000;
const uint32_t SERIAL_WAIT_MS = 3000;
const uint32_t RESET_SESSION_HOLD_MS = 10000;
const uint16_t BUTTON_BLINK_MS = 250;
const uint16_t DHCP_WAIT_MS = 10000;
const uint32_t WATCHDOG_TIMEOUT_MS = 4000;

const uint8_t segmentMapTop[SEGMENTS_PER_DIGIT] = {1, 2, 6, 5, 4, 0, 3};
const uint8_t segmentMapBottom[SEGMENTS_PER_DIGIT] = {1, 0, 4, 5, 6, 2, 3};
const uint8_t digitMask[10] = {
  0b0111111,
  0b0000110,
  0b1011011,
  0b1001111,
  0b1100110,
  0b1101101,
  0b1111101,
  0b0000111,
  0b1111111,
  0b1101111
};

const uint8_t NUM_ANIMATIONS = 3;
const uint8_t animIdList[NUM_ANIMATIONS] = {1, 3, 18};
const uint8_t MODE_COUNT = 0;
const uint8_t MODE_ANIM = 1;

CRGB leds[NUM_LEDS];
WiFiUDP udp;
using SecureClient = WiFiSSLClient;
bool watchdogReady = false;

void refreshWatchdog() {
  if (watchdogReady) {
    WDT.refresh();
  }
}

void initWatchdog() {
  if (WDT.begin(WATCHDOG_TIMEOUT_MS)) {
    watchdogReady = true;
    Serial.print("Watchdog actif: ");
    Serial.print(WDT.getTimeout());
    Serial.println(" ms");
    refreshWatchdog();
  } else {
    Serial.println("Echec d'initialisation du watchdog.");
  }
}

int totalCount = 0;
int sessionCount = 0;
unsigned long lastWiFiConnectAttempt = 0;
unsigned long lastRemotePollTime = 0;
unsigned long buttonPressStart = 0;
bool lastButtonState = HIGH;
bool udpStarted = false;

uint8_t mode = MODE_ANIM;
uint8_t animIndex = 0;
uint32_t modeStartMs = 0;
uint32_t lastFrameMs = 0;
uint32_t lastAnimTriggerMs = 0;

void beginSerial() {
  Serial.begin(9600);

  unsigned long start = millis();
  while (!Serial && millis() - start < SERIAL_WAIT_MS) {
    delay(10);
  }

  delay(200);
}

bool waitForClientData(SecureClient &client, uint32_t timeoutMs) {
  unsigned long start = millis();
  while (!client.available() && client.connected() && millis() - start < timeoutMs) {
    refreshWatchdog();
    delay(10);
  }

  return client.available() > 0;
}

int parseHttpStatusCode(const String &statusLine) {
  int firstSpace = statusLine.indexOf(' ');
  if (firstSpace < 0) {
    return -1;
  }

  int secondSpace = statusLine.indexOf(' ', firstSpace + 1);
  String code = secondSpace >= 0
    ? statusLine.substring(firstSpace + 1, secondSpace)
    : statusLine.substring(firstSpace + 1);
  code.trim();
  return code.toInt();
}

bool readHttpResponse(SecureClient &client, int &statusCode, String &body) {
  if (!waitForClientData(client, HTTP_TIMEOUT_MS)) {
    statusCode = -1;
    return false;
  }

  String statusLine = client.readStringUntil('\n');
  statusLine.trim();
  statusCode = parseHttpStatusCode(statusLine);

  while (waitForClientData(client, HTTP_TIMEOUT_MS)) {
    String headerLine = client.readStringUntil('\n');
    if (headerLine == "\r" || headerLine.length() == 0) {
      break;
    }
  }

  body = "";
  unsigned long lastDataAt = millis();

  while (client.connected() || client.available()) {
    while (client.available()) {
      body += (char)client.read();
      lastDataAt = millis();
      refreshWatchdog();
    }

    if (millis() - lastDataAt > HTTP_TIMEOUT_MS) {
      break;
    }

    refreshWatchdog();
    delay(10);
  }

  return true;
}

bool isAsciiDigit(char c) {
  return c >= '0' && c <= '9';
}

bool isAsciiSpace(char c) {
  return c == ' ' || c == '\n' || c == '\r' || c == '\t';
}

int clampCounterValue(long value) {
  if (value < 0) return 0;
  if (value > 999999L) return 999999;
  return (int)value;
}

bool extractIntegerField(const String &payload, const char *key, long &value) {
  String needle = "\"";
  needle += key;
  needle += "\"";

  int keyPos = payload.indexOf(needle);
  if (keyPos < 0) {
    return false;
  }

  int colonPos = payload.indexOf(':', keyPos + needle.length());
  if (colonPos < 0) {
    return false;
  }

  int cursor = colonPos + 1;
  while (cursor < payload.length() && isAsciiSpace(payload[cursor])) {
    cursor++;
  }

  int start = cursor;
  if (cursor < payload.length() && payload[cursor] == '-') {
    cursor++;
  }

  int digitStart = cursor;
  while (cursor < payload.length() && isAsciiDigit(payload[cursor])) {
    cursor++;
  }

  if (cursor == digitStart) {
    return false;
  }

  value = payload.substring(start, cursor).toInt();
  return true;
}

bool parseStatsPayload(const String &payload, long &remoteTotalCount, long &remoteSessionCount) {
  bool hasTotal = extractIntegerField(payload, "totalCount", remoteTotalCount);
  bool hasSession = extractIntegerField(payload, "sessionCount", remoteSessionCount);

  if (!hasTotal) {
    return false;
  }

  if (!hasSession) {
    remoteSessionCount = remoteTotalCount;
  }

  return true;
}

bool hasValidLocalIp() {
  IPAddress ip = WiFi.localIP();
  return ip[0] != 0 || ip[1] != 0 || ip[2] != 0 || ip[3] != 0;
}

bool waitForLocalIp(uint32_t timeoutMs) {
  unsigned long startedAt = millis();

  while (millis() - startedAt < timeoutMs) {
    if (WiFi.status() == WL_CONNECTED && hasValidLocalIp()) {
      return true;
    }

    refreshWatchdog();
    delay(50);
  }

  return hasValidLocalIp();
}

void startUdpListener() {
  if (udpStarted) {
    return;
  }

  if (udp.begin(DIGIT_UDP_PORT)) {
    udpStarted = true;
    Serial.print("Ecoute UDP sur le port ");
    Serial.println(DIGIT_UDP_PORT);
  } else {
    Serial.println("Echec de l'initialisation UDP.");
  }
}

void connectToWiFi() {
  lastWiFiConnectAttempt = millis();

  Serial.print("Connexion WiFi a ");
  Serial.println(WIFI_SSID);

  if (WiFi.status() == WL_NO_MODULE) {
    Serial.println("Module WiFi indisponible sur cette carte.");
    return;
  }

  String firmwareVersion = WiFi.firmwareVersion();
  if (firmwareVersion < WIFI_FIRMWARE_LATEST_VERSION) {
    Serial.println("Firmware WiFi a mettre a jour.");
  }

  WiFi.disconnect();
  refreshWatchdog();
  delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    refreshWatchdog();
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED && waitForLocalIp(DHCP_WAIT_MS)) {
    Serial.print("WiFi connecte, IP=");
    Serial.println(WiFi.localIP());
    startUdpListener();
  } else if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connecte mais IP DHCP indisponible.");
  } else {
    Serial.println("Connexion WiFi impossible, nouvel essai plus tard.");
  }
}

bool isWiFiReady() {
  return WiFi.status() == WL_CONNECTED && hasValidLocalIp();
}

void ensureWiFiConnected(uint32_t now) {
  if (isWiFiReady()) {
    if (!udpStarted) {
      startUdpListener();
    }
    return;
  }

  udpStarted = false;

  if (now - lastWiFiConnectAttempt < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  Serial.println("WiFi perdu ou incomplet, nouvelle tentative de connexion.");
  connectToWiFi();
}

void applyRemoteCounts(long remoteTotalCount, long remoteSessionCount) {
  totalCount = clampCounterValue(remoteTotalCount);
  sessionCount = clampCounterValue(remoteSessionCount);

  Serial.print("Compteurs synchronises -> Total: ");
  Serial.print(totalCount);
  Serial.print(" | Session: ");
  Serial.println(sessionCount);
}

void handleUdpPackets() {
  if (!udpStarted) {
    return;
  }

  char packetBuffer[64];

  while (true) {
    refreshWatchdog();
    int packetSize = udp.parsePacket();
    if (!packetSize) {
      return;
    }

    int len = udp.read(packetBuffer, sizeof(packetBuffer) - 1);
    if (len <= 0) {
      continue;
    }

    packetBuffer[len] = '\0';
    String payload = String(packetBuffer);
    payload.trim();

    if (!payload.startsWith("BIKE:")) {
      continue;
    }

    int increment = payload.substring(5).toInt();
    if (increment <= 0) {
      continue;
    }

    totalCount = clampCounterValue((long)totalCount + increment);
    sessionCount = clampCounterValue((long)sessionCount + increment);

    Serial.print("UDP velo recu -> +");
    Serial.print(increment);
    Serial.print(" | Total: ");
    Serial.print(totalCount);
    Serial.print(" | Session: ");
    Serial.println(sessionCount);
  }
}

void fetchRemoteCounts() {
  if (!isWiFiReady()) {
    Serial.println("GET /prod/bike/stats ignore: WiFi non connecte.");
    return;
  }

  SecureClient client;
  if (!client.connect(BIKE_HTTP_HOST, BIKE_HTTPS_PORT)) {
    Serial.println("Connexion HTTPS impossible vers /prod/bike/stats.");
    return;
  }

  client.print("GET ");
  client.print(BIKE_STATS_GET_PATH);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(BIKE_HTTP_HOST);
  client.println("Accept: application/json");
  client.print("Authorization: ");
  client.println(BIKE_AUTH_HEADER);
  client.println("User-Agent: dervenn-digit/1.0");
  client.println("Connection: close");
  client.println();

  int httpCode = -1;
  String payload;
  bool responseRead = readHttpResponse(client, httpCode, payload);
  client.stop();

  Serial.print("GET /prod/bike/stats -> HTTP ");
  Serial.println(httpCode);

  if (!responseRead) {
    Serial.println("Erreur HTTP ou absence de reponse.");
    return;
  }

  if (httpCode != 200) {
    if (payload.length() > 0) {
      Serial.println(payload);
    }
    return;
  }

  long remoteTotalCount = 0;
  long remoteSessionCount = 0;
  if (!parseStatsPayload(payload, remoteTotalCount, remoteSessionCount)) {
    Serial.print("Reponse stats non reconnue: ");
    Serial.println(payload);
    return;
  }

  applyRemoteCounts(remoteTotalCount, remoteSessionCount);
}

bool resetSessionOnServer() {
  if (!isWiFiReady()) {
    Serial.println("POST /prod/bike/resetsession ignore: WiFi non connecte.");
    return false;
  }

  SecureClient client;
  if (!client.connect(BIKE_HTTP_HOST, BIKE_HTTPS_PORT)) {
    Serial.println("Connexion HTTPS impossible vers /prod/bike/resetsession.");
    return false;
  }

  client.print("POST ");
  client.print(BIKE_RESET_SESSION_POST_PATH);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(BIKE_HTTP_HOST);
  client.println("Accept: application/json");
  client.print("Authorization: ");
  client.println(BIKE_AUTH_HEADER);
  client.println("Content-Length: 0");
  client.println("User-Agent: dervenn-digit/1.0");
  client.println("Connection: close");
  client.println();

  int httpCode = -1;
  String payload;
  bool responseRead = readHttpResponse(client, httpCode, payload);
  client.stop();

  Serial.print("POST /prod/bike/resetsession -> HTTP ");
  Serial.println(httpCode);

  if (!responseRead || httpCode < 200 || httpCode >= 300) {
    if (payload.length() > 0) {
      Serial.println(payload);
    }
    return false;
  }

  long remoteTotalCount = 0;
  long remoteSessionCount = 0;
  if (!parseStatsPayload(payload, remoteTotalCount, remoteSessionCount)) {
    Serial.print("Reponse reset session non reconnue: ");
    Serial.println(payload);
    return false;
  }

  applyRemoteCounts(remoteTotalCount, remoteSessionCount);
  return true;
}

void handleRemotePolling(uint32_t now) {
  if (now - lastRemotePollTime < REMOTE_POLL_INTERVAL_MS) {
    return;
  }

  lastRemotePollTime = now;
  fetchRemoteCounts();
}

uint16_t baseLedIndexForDigit(uint8_t digitIndex) {
  return (uint16_t)digitIndex * SEGMENTS_PER_DIGIT;
}

uint16_t ledIndexForSegment(uint8_t digitIndex, uint8_t segmentIndex) {
  uint16_t base = baseLedIndexForDigit(digitIndex);
  if (digitIndex < 5) {
    return base + segmentMapTop[segmentIndex];
  }
  return base + segmentMapBottom[segmentIndex];
}

void renderDigitSolid(uint8_t digitIndex, uint8_t value, CRGB color) {
  uint8_t mask = (value <= 9) ? digitMask[value] : 0;
  for (uint8_t seg = 0; seg < SEGMENTS_PER_DIGIT; seg++) {
    leds[ledIndexForSegment(digitIndex, seg)] = (mask & (1 << seg)) ? color : CRGB::Black;
  }
}

uint8_t rowDigitIndex(uint8_t rowStartDigit, uint8_t offset, bool reverse) {
  if (reverse) {
    return (uint8_t)(rowStartDigit + (4 - offset));
  }
  return (uint8_t)(rowStartDigit + offset);
}

void renderRowNumber5(uint8_t rowStartDigit, int value, CRGB color, bool reverse) {
  uint32_t v = (value < 0) ? 0U : (uint32_t)value;
  v %= 100000UL;

  const uint32_t divisors[5] = {10000UL, 1000UL, 100UL, 10UL, 1UL};
  bool started = false;

  for (uint8_t pos = 0; pos < 5; pos++) {
    uint8_t digit = (uint8_t)((v / divisors[pos]) % 10);
    if (digit != 0 || started || pos == 4) {
      renderDigitSolid(rowDigitIndex(rowStartDigit, pos, reverse), digit, color);
      started = true;
    } else {
      renderDigitSolid(rowDigitIndex(rowStartDigit, pos, reverse), 255, color);
    }
  }
}

CRGB scaleColor(CRGB color, uint8_t brightness) {
  CRGB c = color;
  c.nscale8_video(brightness);
  return c;
}

void renderCountDisplayWithColor(CRGB color) {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  renderRowNumber5(0, totalCount, color, false);
  renderRowNumber5(5, sessionCount, color, BOTTOM_ROW_REVERSED);
}

void renderCountDisplay() {
  renderCountDisplayWithColor(scaleColor(COUNTER_COLOR, COUNTER_BRIGHTNESS));
}

void renderButtonFeedback(uint32_t now) {
  uint32_t pressDuration = now - buttonPressStart;
  CRGB feedbackColor = (pressDuration >= RESET_SESSION_HOLD_MS) ? CRGB::Red : CRGB::Green;

  bool ledsOn = ((now / BUTTON_BLINK_MS) % 2U) == 0U;
  if (!ledsOn) {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    return;
  }

  renderCountDisplayWithColor(scaleColor(feedbackColor, COUNTER_BRIGHTNESS));
}

void renderSnake(CRGB *out, uint32_t t, uint16_t dur) {
  fill_solid(out, NUM_LEDS, CRGB::Black);

  uint16_t head = (uint16_t)((t / 80) % NUM_LEDS);
  uint16_t maxLen = (NUM_LEDS < 40) ? NUM_LEDS : 40;
  uint16_t len = (uint16_t)(3 + (t * (maxLen - 3)) / (dur - 1));

  for (uint16_t i = 0; i < len; i++) {
    uint16_t idx = (head + NUM_LEDS - (i % NUM_LEDS)) % NUM_LEDS;
    CRGB c = CHSV(0, 255, 255);
    c.nscale8((uint8_t)(255 - (i * 255 / len)));
    out[idx] = c;
  }
}

void renderRainbowWave(CRGB *out, uint32_t t) {
  for (uint16_t i = 0; i < NUM_LEDS; i++) {
    uint8_t phase = (uint8_t)(i * 8 + t / 10);
    uint8_t v = sin8(phase);
    out[i] = CHSV((uint8_t)(t / 8 + i * 3), 255, v);
  }
}

void renderConfetti(CRGB *out, uint32_t t) {
  (void)t;
  fadeToBlackBy(out, NUM_LEDS, 20);
  uint16_t pos = random16(NUM_LEDS);
  out[pos] += CHSV(random8(), 200, 255);
}

void renderAnimation(CRGB *out, uint8_t animId, uint32_t t, uint16_t dur) {
  switch (animId) {
    case 1: renderSnake(out, t, dur); break;
    case 3: renderRainbowWave(out, t); break;
    case 18: renderConfetti(out, t); break;
    default: fill_solid(out, NUM_LEDS, CRGB::Black); break;
  }
}

void updateDisplay(uint32_t now) {
  if (now - lastFrameMs < FRAME_MS) {
    return;
  }
  lastFrameMs = now;

  if (digitalRead(PIN_REMOTE_RESET_BUTTON) == LOW) {
    renderButtonFeedback(now);
    FastLED.show();
    return;
  }

  if (mode == MODE_ANIM) {
    uint32_t animElapsed = now - modeStartMs;
    if (animElapsed >= ANIM_MS) {
      animIndex++;
      if (animIndex >= NUM_ANIMATIONS) {
        mode = MODE_COUNT;
        lastAnimTriggerMs = now;
      } else {
        modeStartMs = now;
      }
      return;
    }

    uint8_t animId = animIdList[animIndex];
    renderAnimation(leds, animId, animElapsed, ANIM_MS);
    if (ANIM_BRIGHTNESS < 255) {
      nscale8_video(leds, NUM_LEDS, ANIM_BRIGHTNESS);
    }
    FastLED.show();
    return;
  }

  if (now - lastAnimTriggerMs >= ANIM_INTERVAL_MS) {
    mode = MODE_ANIM;
    animIndex = 0;
    modeStartMs = now;
    return;
  }

  renderCountDisplay();
  FastLED.show();
}

void handleButton(uint32_t now) {
  bool buttonState = digitalRead(PIN_REMOTE_RESET_BUTTON);

  if (lastButtonState == HIGH && buttonState == LOW) {
    buttonPressStart = now;
  }

  if (lastButtonState == LOW && buttonState == HIGH) {
    uint32_t pressDuration = now - buttonPressStart;
    if (pressDuration >= RESET_SESSION_HOLD_MS) {
      Serial.println("Relachement -> reset session distant.");
      if (resetSessionOnServer()) {
        mode = MODE_COUNT;
        lastAnimTriggerMs = now;
      }
    }
  }

  lastButtonState = buttonState;
}

void setup() {
  beginSerial();
  Serial.println("=== Afficheur compteur WiFi pret ===");
  initWatchdog();

  pinMode(PIN_REMOTE_RESET_BUTTON, INPUT_PULLUP);

  connectToWiFi();
  fetchRemoteCounts();
  lastRemotePollTime = millis();

  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(255);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();
  randomSeed(analogRead(A0));

  modeStartMs = millis();
  lastAnimTriggerMs = modeStartMs;
}

void loop() {
  uint32_t now = millis();

  refreshWatchdog();
  ensureWiFiConnected(now);
  handleUdpPackets();
  handleRemotePolling(now);
  handleButton(now);
  updateDisplay(now);
  refreshWatchdog();
}
