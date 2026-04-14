#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include <WiFiUdp.h>
#include <WDT.h>

#if !defined(ARDUINO_UNOR4_WIFI)
#error "Ce sketch est prevu uniquement pour Arduino UNO R4 WiFi."
#endif

const int SENSOR_PIN = A0;
const int DEFAULT_DETECTION_THRESHOLD = 114;
const uint8_t DETECTION_MARGIN_POINTS = 6;
const unsigned long MIN_DELAY_BETWEEN_BIKES = 800; // ms
const uint32_t THRESHOLD_RECALIBRATION_INTERVAL_MS = 60UL * 60UL * 1000UL; // 1h
const uint8_t CALIBRATION_SAMPLE_COUNT = 10;
const uint8_t CALIBRATION_LOW_SAMPLE_COUNT = 3;
const uint16_t CALIBRATION_SAMPLE_INTERVAL_MS = 100;

const char *WIFI_SSID = "androidap";
const char *WIFI_PASSWORD = "n4l6c21u$76!.";
const char *BIKE_HTTP_HOST = "n4l6c21u76.execute-api.eu-west-3.amazonaws.com";
const char *BIKE_COUNTER_POST_PATH = "/prod/bike/counter";
const char *BIKE_AUTH_HEADER = "Basic Zm9vZDpwZXBkZXV4";
const uint16_t BIKE_HTTPS_PORT = 443;

const uint16_t DIGIT_UDP_PORT = 4210;
const uint16_t COUNTER_UDP_LOCAL_PORT = 4211;

const uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
const uint32_t SEND_INTERVAL_MS = 5UL * 60UL * 1000UL;
const uint16_t DIGIT_RESYNC_DELAY_MS = 1000;
const uint16_t HTTP_TIMEOUT_MS = 10000;
const uint32_t SERIAL_WAIT_MS = 3000;
const uint16_t DHCP_WAIT_MS = 10000;
const uint32_t WATCHDOG_TIMEOUT_MS = 4000;

unsigned long lastDetectionTime = 0;
unsigned long lastWiFiConnectAttempt = 0;
unsigned long lastSendAttemptTime = 0;
unsigned long lastThresholdCalibrationTime = 0;
unsigned long digitResyncDueTime = 0;
uint16_t pendingBikeCount = 0;
bool udpStarted = false;
bool watchdogReady = false;
bool digitResyncPending = false;
int detectionThreshold = DEFAULT_DETECTION_THRESHOLD;
int emptySensorValue = DEFAULT_DETECTION_THRESHOLD - DETECTION_MARGIN_POINTS;
bool thresholdCalibrationInProgress = false;
unsigned long lastCalibrationSampleTime = 0;
uint8_t calibrationSampleIndex = 0;
int calibrationSamples[CALIBRATION_SAMPLE_COUNT];
const char *currentCalibrationReason = "demarrage";

using SecureClient = WiFiSSLClient;
WiFiUDP udp;

void sortValuesAscending(int *values, uint8_t count) {
  for (uint8_t i = 1; i < count; i++) {
    int currentValue = values[i];
    int8_t j = i - 1;

    while (j >= 0 && values[j] > currentValue) {
      values[j + 1] = values[j];
      j--;
    }

    values[j + 1] = currentValue;
  }
}

int averageLowestValues(int *values, uint8_t count, uint8_t lowestCount) {
  if (count == 0) {
    return DEFAULT_DETECTION_THRESHOLD - DETECTION_MARGIN_POINTS;
  }

  uint8_t retainedCount = lowestCount > count ? count : lowestCount;
  long total = 0;

  sortValuesAscending(values, count);

  for (uint8_t index = 0; index < retainedCount; index++) {
    total += values[index];
  }

  return (int)(total / retainedCount);
}

void logThresholdCalibration() {
  Serial.print("Seuil recalcule (");
  Serial.print(currentCalibrationReason);
  Serial.print("): vide=");
  Serial.print(emptySensorValue);
  Serial.print(" | marge=");
  Serial.print(DETECTION_MARGIN_POINTS);
  Serial.print(" | seuil=");
  Serial.println(detectionThreshold);
}

void startThresholdCalibration(unsigned long now, const char *reason) {
  if (thresholdCalibrationInProgress) {
    return;
  }

  thresholdCalibrationInProgress = true;
  calibrationSampleIndex = 0;
  lastCalibrationSampleTime = now - CALIBRATION_SAMPLE_INTERVAL_MS;
  currentCalibrationReason = reason;

  Serial.print("Calibration du seuil en cours (");
  Serial.print(currentCalibrationReason);
  Serial.println(")...");
}

void processThresholdCalibration(unsigned long now) {
  if (!thresholdCalibrationInProgress) {
    return;
  }

  if (calibrationSampleIndex > 0 &&
      now - lastCalibrationSampleTime < CALIBRATION_SAMPLE_INTERVAL_MS) {
    return;
  }

  calibrationSamples[calibrationSampleIndex] = analogRead(SENSOR_PIN);
  lastCalibrationSampleTime = now;
  calibrationSampleIndex++;

  if (calibrationSampleIndex < CALIBRATION_SAMPLE_COUNT) {
    return;
  }

  emptySensorValue = averageLowestValues(
    calibrationSamples,
    CALIBRATION_SAMPLE_COUNT,
    CALIBRATION_LOW_SAMPLE_COUNT);
  detectionThreshold = emptySensorValue + DETECTION_MARGIN_POINTS;
  lastThresholdCalibrationTime = now;
  thresholdCalibrationInProgress = false;

  logThresholdCalibration();
}

void recalibrateThresholdIfDue(unsigned long now) {
  if (thresholdCalibrationInProgress) {
    return;
  }

  if (now - lastThresholdCalibrationTime < THRESHOLD_RECALIBRATION_INTERVAL_MS) {
    return;
  }

  if (now - lastDetectionTime <= MIN_DELAY_BETWEEN_BIKES) {
    return;
  }

  startThresholdCalibration(now, "horaire");
}

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

IPAddress computeBroadcastAddress() {
  IPAddress ip = WiFi.localIP();
  IPAddress mask = WiFi.subnetMask();
  IPAddress broadcast;

  for (uint8_t index = 0; index < 4; index++) {
    broadcast[index] = (uint8_t)(ip[index] | (uint8_t)(~mask[index]));
  }

  return broadcast;
}

void startUdpTransport() {
  if (udpStarted) {
    return;
  }

  if (udp.begin(COUNTER_UDP_LOCAL_PORT)) {
    udpStarted = true;
    Serial.print("UDP local pret sur le port ");
    Serial.println(COUNTER_UDP_LOCAL_PORT);
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
    startUdpTransport();
  } else if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connecte mais IP DHCP indisponible.");
  } else {
    Serial.println("Connexion WiFi impossible, nouvel essai plus tard.");
  }
}

bool isWiFiReady() {
  return WiFi.status() == WL_CONNECTED && hasValidLocalIp();
}

void ensureWiFiConnected(unsigned long now) {
  if (isWiFiReady()) {
    if (!udpStarted) {
      startUdpTransport();
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

void notifyDigitViaUdp(uint16_t increment) {
  if (!isWiFiReady() || !udpStarted) {
    return;
  }

  IPAddress broadcastIp = computeBroadcastAddress();

  if (!udp.beginPacket(broadcastIp, DIGIT_UDP_PORT)) {
    Serial.println("Impossible de preparer le paquet UDP.");
    return;
  }

  udp.print("BIKE:");
  udp.print(increment);
  udp.endPacket();
}

bool notifyDigitResyncViaUdp() {
  if (!isWiFiReady() || !udpStarted) {
    return false;
  }

  IPAddress broadcastIp = computeBroadcastAddress();

  if (!udp.beginPacket(broadcastIp, DIGIT_UDP_PORT)) {
    Serial.println("Impossible de preparer le paquet UDP de resynchronisation.");
    return false;
  }

  udp.print("SYNC");
  udp.endPacket();

  Serial.println("UDP resynchronisation digit envoye.");
  return true;
}

void scheduleDigitResync(unsigned long now) {
  digitResyncPending = true;
  digitResyncDueTime = now + DIGIT_RESYNC_DELAY_MS;

  Serial.print("Resynchronisation digit planifiee dans ");
  Serial.print(DIGIT_RESYNC_DELAY_MS);
  Serial.println(" ms.");
}

void sendDigitResyncIfDue(unsigned long now) {
  if (!digitResyncPending) {
    return;
  }

  if ((long)(now - digitResyncDueTime) < 0) {
    return;
  }

  if (notifyDigitResyncViaUdp()) {
    digitResyncPending = false;
  }
}

void handleUdpCommands() {
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
  }
}

bool sendPendingBikeCount() {
  if (pendingBikeCount == 0) {
    return true;
  }

  if (!isWiFiReady()) {
    Serial.println("Envoi differe: WiFi non connecte.");
    return false;
  }

  SecureClient client;
  if (!client.connect(BIKE_HTTP_HOST, BIKE_HTTPS_PORT)) {
    Serial.println("Connexion HTTPS impossible vers /prod/bike/counter.");
    return false;
  }

  String body = String(pendingBikeCount);

  client.print("POST ");
  client.print(BIKE_COUNTER_POST_PATH);
  client.println(" HTTP/1.1");
  client.print("Host: ");
  client.println(BIKE_HTTP_HOST);
  client.println("Accept: application/json");
  client.print("Authorization: ");
  client.println(BIKE_AUTH_HEADER);
  client.println("Content-Type: text/plain");
  client.println("User-Agent: dervenn-counter/1.0");
  client.println("Connection: close");
  client.print("Content-Length: ");
  client.println(body.length());
  client.println();
  client.print(body);

  int httpCode = -1;
  String responseBody;
  bool responseRead = readHttpResponse(client, httpCode, responseBody);
  client.stop();

  Serial.print("POST /prod/bike/counter count=");
  Serial.print(body);
  Serial.print(" -> HTTP ");
  Serial.println(httpCode);

  if (!responseRead || httpCode < 200 || httpCode >= 300) {
    Serial.println("Echec d'envoi, compteur conserve localement.");
    if (responseBody.length() > 0) {
      Serial.println(responseBody);
    }
    return false;
  }

  if (responseBody.length() > 0) {
    Serial.println(responseBody);
  }

  pendingBikeCount = 0;
  scheduleDigitResync(millis());
  return true;
}

void flushPendingBikeCountIfDue(unsigned long now) {
  if (pendingBikeCount == 0) {
    return;
  }

  if (now - lastSendAttemptTime < SEND_INTERVAL_MS) {
    return;
  }

  lastSendAttemptTime = now;
  sendPendingBikeCount();
}

void handleDetection(unsigned long now) {
  int sensorValue = analogRead(SENSOR_PIN);
  if (sensorValue > detectionThreshold &&
      (now - lastDetectionTime > MIN_DELAY_BETWEEN_BIKES)) {
    lastDetectionTime = now;
    if (pendingBikeCount == 0) {
      lastSendAttemptTime = now;
    }
    pendingBikeCount++;

    notifyDigitViaUdp(1);

    Serial.print("Passage detecte, capteur=");
    Serial.print(sensorValue);
    Serial.print(" | seuil=");
    Serial.print(detectionThreshold);
    Serial.print(" | en attente=");
    Serial.println(pendingBikeCount);
  }
}

void setup() {
  beginSerial();
  Serial.println("Initialisation du compteur velo en WiFi...");
  initWatchdog();
  startThresholdCalibration(millis(), "demarrage");

  while (thresholdCalibrationInProgress) {
    unsigned long now = millis();
    refreshWatchdog();
    processThresholdCalibration(now);
    delay(5);
  }

  connectToWiFi();

  Serial.println("Compteur pret : UDP immediat vers digit + batch serveur toutes les 5 minutes.");
}

void loop() {
  unsigned long now = millis();

  refreshWatchdog();
  ensureWiFiConnected(now);
  handleUdpCommands();
  recalibrateThresholdIfDue(now);
  processThresholdCalibration(now);
  handleDetection(now);
  flushPendingBikeCountIfDue(now);
  sendDigitResyncIfDue(now);
  refreshWatchdog();
}
