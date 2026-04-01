#include <WiFiS3.h>
#include <WiFiSSLClient.h>
#include <WiFiUdp.h>

#if !defined(ARDUINO_UNOR4_WIFI)
#error "Ce sketch est prevu uniquement pour Arduino UNO R4 WiFi."
#endif

const int SENSOR_PIN = A0;
const int DETECTION_THRESHOLD = 114;
const unsigned long MIN_DELAY_BETWEEN_BIKES = 800; // ms

const char *WIFI_SSID = "AndroidAP";
const char *WIFI_PASSWORD = "totototo";
const char *BIKE_HTTP_HOST = "n4l6c21u76.execute-api.eu-west-3.amazonaws.com";
const char *BIKE_COUNTER_POST_PATH = "/prod/bike/counter";
const char *BIKE_AUTH_HEADER = "Basic Zm9vZDpwZXBkZXV4";
const uint16_t BIKE_HTTPS_PORT = 443;

const uint16_t DIGIT_UDP_PORT = 4210;
const uint16_t COUNTER_UDP_LOCAL_PORT = 4211;

const uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
const uint32_t SEND_INTERVAL_MS = 10000;
const uint16_t HTTP_TIMEOUT_MS = 10000;
const uint32_t SERIAL_WAIT_MS = 3000;

unsigned long lastDetectionTime = 0;
unsigned long lastWiFiConnectAttempt = 0;
unsigned long lastSendAttemptTime = 0;
uint16_t pendingBikeCount = 0;
bool udpStarted = false;

using SecureClient = WiFiSSLClient;
WiFiUDP udp;

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
    }

    if (millis() - lastDataAt > HTTP_TIMEOUT_MS) {
      break;
    }

    delay(10);
  }

  return true;
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

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connecte, IP=");
    Serial.println(WiFi.localIP());
    startUdpTransport();
  } else {
    Serial.println("Connexion WiFi impossible, nouvel essai plus tard.");
  }
}

void ensureWiFiConnected(unsigned long now) {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  udpStarted = false;

  if (now - lastWiFiConnectAttempt < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  connectToWiFi();
}

void notifyDigitViaUdp(uint16_t increment) {
  if (WiFi.status() != WL_CONNECTED || !udpStarted) {
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

void handleUdpCommands() {
  if (!udpStarted) {
    return;
  }

  char packetBuffer[64];

  while (true) {
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

    if (payload != "RESET_SESSION_FLUSH") {
      continue;
    }

    bool flushOk = sendPendingBikeCount();

    if (udp.beginPacket(udp.remoteIP(), udp.remotePort())) {
      udp.print(flushOk ? "RESET_SESSION_READY" : "RESET_SESSION_FAILED");
      udp.endPacket();
    }

    Serial.println(flushOk ? "Flush demande par digit -> OK" : "Flush demande par digit -> ECHEC");
  }
}

bool sendPendingBikeCount() {
  if (pendingBikeCount == 0) {
    return true;
  }

  if (WiFi.status() != WL_CONNECTED) {
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
  if (sensorValue > DETECTION_THRESHOLD &&
      (now - lastDetectionTime > MIN_DELAY_BETWEEN_BIKES)) {
    lastDetectionTime = now;
    if (pendingBikeCount == 0) {
      lastSendAttemptTime = now;
    }
    pendingBikeCount++;

    notifyDigitViaUdp(1);

    Serial.print("Passage detecte, capteur=");
    Serial.print(sensorValue);
    Serial.print(" | en attente=");
    Serial.println(pendingBikeCount);
  }
}

void setup() {
  beginSerial();
  Serial.println("Initialisation du compteur velo en WiFi...");

  connectToWiFi();

  Serial.println("Compteur pret : UDP immediat vers digit + batch serveur toutes les 10 secondes.");
}

void loop() {
  unsigned long now = millis();

  ensureWiFiConnected(now);
  handleUdpCommands();
  handleDetection(now);
  flushPendingBikeCountIfDue(now);
}
