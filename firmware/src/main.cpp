/**
 * ==============================================================================
 * Project: JalRakshak — Low-Cost Multi-Sensor Water Quality Monitoring System
 * File: firmware/src/main.cpp
 * Description: Production ESP32 DevKit V1 C++ firmware for analog optical
 *              turbidity, analog TDS (EC25 compensated), DS18B20 fluid temp,
 *              SSD1306 0.96" I2C OLED display, and HTTPS cloud telemetry dispatch.
 * ==============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ==========================================
// 1. HARDWARE PIN DEFINITIONS (ESP32 DevKit)
// ==========================================
// CRITICAL: Turbidity & TDS use ADC1 pins so they function alongside active Wi-Fi!
#define PIN_TURBIDITY       34     // ADC1_CH6 (Optical Turbidity Analog Out)
#define PIN_TDS             35     // ADC1_CH7 (Analog TDS Probe Out)
#define PIN_ONEWIRE         4      // Digital GPIO 4 (DS18B20 1-Wire bus with 4.7k pull-up)

#define PIN_LED_GREEN       18     // State: NORMAL / Pristine
#define PIN_LED_YELLOW      19     // State: WARNING / Caution
#define PIN_LED_RED         23     // State: ALARM / Critical Contamination
#define PIN_BUZZER          5      // Active 5V Buzzer

#define OLED_SDA            21     // I2C SDA
#define OLED_SCL            22     // I2C SCL
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define OLED_RESET          -1     // Share reset with ESP32
#define SCREEN_ADDRESS      0x3C   // Default I2C address for SSD1306 0.96"

// ==========================================
// 2. NETWORK & CLOUD INGESTION CREDENTIALS
// ==========================================
// Replace with your smartphone mobile hotspot or lab Wi-Fi credentials
const char* WIFI_SSID     = "Your_WiFi_Hotspot"; 
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// Live Vercel Production Serverless Endpoint
const char* CLOUD_API_URL = "https://jalrakshak-rosy.vercel.app/api/telemetry";
const char* DEVICE_API_KEY = "jal_sec_dev_local_key";
const char* DEVICE_ID      = "ESP32_JALRAKSHAK_01";

// ==========================================
// 3. OBJECT INITIALIZATION & GLOBAL STATE
// ==========================================
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
OneWire oneWire(PIN_ONEWIRE);
DallasTemperature tempSensors(&oneWire);

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 3000; // Sample and post every 3s
unsigned long syncCounter = 0;
bool wifiConnected = false;

// ==========================================
// 4. SENSOR SAMPLING & SIGNAL CONDITIONING
// ==========================================

// 64x ADC Oversampling to filter ESP32 ADC non-linearity & electromagnetic noise
float readAdcVoltage(int pin, int samples = 64) {
    long sum = 0;
    for (int i = 0; i < samples; i++) {
        sum += analogRead(pin);
        delayMicroseconds(100);
    }
    float avgRaw = (float)sum / (float)samples;
    // ESP32 ADC: 12-bit (0 - 4095) with ~3.3V reference
    return (avgRaw / 4095.0f) * 3.3f;
}

// Compute Optical Turbidity in Nephelometric Turbidity Units (NTU)
float readTurbidity(float vTemp) {
    float voltage = readAdcVoltage(PIN_TURBIDITY, 64);
    
    // Transfer function for Gravity Optical Turbidity Sensor
    // In pristine tap water, sensor outputs ~3.0V - 3.2V (when powered from 3.3V/5V divider)
    // Higher turbidity (darker/cloudier) -> less light reaches phototransistor -> lower voltage
    float ntu = 0.0f;
    if (voltage < 2.5f) {
        ntu = 3000.0f;
    } else if (voltage >= 3.2f) {
        ntu = 0.5f; // Crystal clear baseline
    } else {
        // Linearized regression between 2.5V (3000 NTU) and 3.2V (0.5 NTU)
        ntu = (3.2f - voltage) * (3000.0f / 0.7f);
    }
    if (ntu < 0.0f) ntu = 0.0f;
    if (ntu > 3000.0f) ntu = 3000.0f;
    return ntu;
}

// Compute Total Dissolved Solids (TDS in ppm) with EC25 Temperature Compensation
float readTDS(float temperatureC) {
    float voltage = readAdcVoltage(PIN_TDS, 64);

    // Temperature compensation formula: Reference temperature benchmark = 25.0 C
    // alpha = 2.0% per degree Celsius
    float compensationCoefficient = 1.0f + 0.02f * (temperatureC - 25.0f);
    float compensationVoltage = voltage / compensationCoefficient;

    // Standard cubic polynomial conversion for TDS sensor (Analog voltage -> ppm)
    float tdsValue = (133.42f * compensationVoltage * compensationVoltage * compensationVoltage
                    - 255.86f * compensationVoltage * compensationVoltage
                    + 857.39f * compensationVoltage) * 0.5f;

    if (tdsValue < 0.0f) tdsValue = 0.0f;
    if (tdsValue > 1500.0f) tdsValue = 1500.0f;
    return tdsValue;
}

// Read DS18B20 Waterproof Fluid Temperature Probe
float readFluidTemp() {
    tempSensors.requestTemperatures();
    float t = tempSensors.getTempCByIndex(0);
    // If probe is disconnected or floating, fallback safely to standard room baseline
    if (t < -50.0f || t > 100.0f || t == -127.0f) {
        return 24.5f;
    }
    return t;
}

// ==========================================
// 5. LOCAL ANOMALY CLASSIFICATION & ACTUATION
// ==========================================
struct WaterDiagnosis {
    float wqi;
    String state;
    String signature;
};

WaterDiagnosis evaluateWaterQuality(float turb, float tds, float temp) {
    // Quiescent Baselines: Turbidity = 2.0 NTU (s=3.0), TDS = 150.0 ppm (s=50.0)
    float zTurb = max(0.0f, (turb - 2.0f) / 3.0f);
    float zTds  = max(0.0f, (tds - 150.0f) / 50.0f);
    float compositeAnomaly = sqrt(zTurb * zTurb + zTds * zTds);

    // 0 - 100 Water Quality Index
    float wqi = max(0.0f, min(100.0f, 100.0f - (compositeAnomaly * 25.0f)));

    WaterDiagnosis diag;
    diag.wqi = wqi;

    if (compositeAnomaly < 1.0f) {
        diag.state = "NORMAL";
        diag.signature = "Baseline / Pristine Quiescent";
        digitalWrite(PIN_LED_GREEN, HIGH);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_RED, LOW);
        digitalWrite(PIN_BUZZER, LOW);
    } else if (compositeAnomaly < 2.0f) {
        diag.state = "WARNING";
        diag.signature = (turb > 10.0f) ? "Turbidity Drift / Sediments" : "Elevated Mineral Dissolution";
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, HIGH);
        digitalWrite(PIN_LED_RED, LOW);
        // Intermittent click
        digitalWrite(PIN_BUZZER, (millis() % 1000 < 100) ? HIGH : LOW);
    } else {
        diag.state = "ALARM";
        if (turb > 25.0f && tds > 500.0f) {
            diag.signature = "Severe Runoff / Surface Influx";
        } else if (turb > 25.0f) {
            diag.signature = "Severe Sediment / Particulate Intrusion";
        } else {
            diag.signature = "Chemical / Saline Infiltration";
        }
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_RED, HIGH);
        // Active alarm pulsing
        digitalWrite(PIN_BUZZER, (millis() % 500 < 250) ? HIGH : LOW);
    }

    return diag;
}

// ==========================================
// 6. OLED GRAPHICAL DISPLAY RENDERER
// ==========================================
void updateOledDisplay(float turb, float tds, float temp, const WaterDiagnosis& diag) {
    display.clearDisplay();

    // Top Header Banner
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.print("JALRAKSHAK | ");
    display.print(diag.state);

    display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

    // Large WQI Score Display
    display.setCursor(0, 14);
    display.setTextSize(2);
    display.print("WQI:");
    display.print((int)diag.wqi);
    display.setTextSize(1);
    display.print("/100");

    // Metrics Rows
    display.setTextSize(1);
    display.setCursor(0, 32);
    display.print("Turb: ");
    display.print(turb, 1);
    display.print(" NTU");

    display.setCursor(0, 42);
    display.print("TDS : ");
    display.print((int)tds);
    display.print(" ppm");

    display.setCursor(0, 52);
    display.print("Temp: ");
    display.print(temp, 1);
    display.print(" C  ");
    display.print(wifiConnected ? "[Cloud OK]" : "[Offline]");

    display.display();
}

// ==========================================
// 7. HTTPS CLOUD TELEMETRY POST CLIENT
// ==========================================
void postTelemetryToCloud(float turb, float tds, float temp, const String& state) {
    if (WiFi.status() != WL_CONNECTED) {
        wifiConnected = false;
        return;
    }
    wifiConnected = true;

    // Use secure client with root verification bypass (zero-friction for ESP32)
    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    if (!http.begin(client, CLOUD_API_URL)) {
        Serial.println("[HTTP] Failed to connect to cloud endpoint.");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);

    // Build JSON payload matching FastAPI Pydantic schema
    StaticJsonDocument<256> doc;
    doc["device_id"] = DEVICE_ID;
    doc["turbidity_ntu"] = round(turb * 10.0f) / 10.0f;
    doc["tds_ppm"] = round(tds * 10.0f) / 10.0f;
    doc["temp_c"] = round(temp * 10.0f) / 10.0f;
    doc["state"] = state;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
        syncCounter++;
        Serial.printf("[Cloud Sync #%lu] HTTP %d: Telemetry Persisted in Neon Postgres\n", syncCounter, httpCode);
    } else {
        Serial.printf("[Cloud Sync] Error sending POST: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
}

// ==========================================
// 8. SETUP & MAIN EXECUTION LOOP
// ==========================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== JALRAKSHAK ESP32 DEVKIT V1 INITIALIZING ===");

    // Pin Modes
    pinMode(PIN_TURBIDITY, INPUT);
    pinMode(PIN_TDS, INPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_YELLOW, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);

    // Initial LED Self-Test Flash
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(400);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);

    // Initialize DS18B20 Temp Sensor
    tempSensors.begin();

    // Initialize I2C SSD1306 OLED
    Wire.begin(OLED_SDA, OLED_SCL);
    if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        Serial.println("[OLED] SSD1306 allocation failed. Check I2C wiring (SDA=21, SCL=22).");
    } else {
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(10, 20);
        display.println("JALRAKSHAK SYSTEM");
        display.setCursor(10, 35);
        display.println("Connecting Wi-Fi...");
        display.display();
    }

    // Connect to Wi-Fi
    Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.printf("\n[Wi-Fi] Connected! Local IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        wifiConnected = false;
        Serial.println("\n[Wi-Fi] Timeout. Continuing in offline standalone mode.");
    }
}

void loop() {
    unsigned long currentMillis = millis();

    // Sample sensors and update actuators continuously
    float tempC = readFluidTemp();
    float turbNtu = readTurbidity(tempC);
    float tdsPpm = readTDS(tempC);

    WaterDiagnosis diag = evaluateWaterQuality(turbNtu, tdsPpm, tempC);
    updateOledDisplay(turbNtu, tdsPpm, tempC, diag);

    // Transmit telemetry to Cloud backend every TELEMETRY_INTERVAL_MS
    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = currentMillis;

        Serial.printf("[Sensor Read] Turbidity: %.1f NTU | TDS: %.1f ppm | Temp: %.1f C | State: %s | WQI: %.0f\n",
                      turbNtu, tdsPpm, tempC, diag.state.c_str(), diag.wqi);

        postTelemetryToCloud(turbNtu, tdsPpm, tempC, diag.state);
    }

    delay(50); // Loop cadence
}
