/**
 * ==============================================================================
 * Project: JalRakshak — Low-Cost Multi-Sensor Water Quality Monitoring System
 * File: firmware/firmware.ino (Arduino IDE compatible single-file sketch)
 * ==============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>  // 1.3" I2C OLED (SH1106)
#include <Adafruit_SSD1306.h> // Universal support for SSD1306 OLEDs
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ==========================================
// DATA STRUCTURES & FORWARD DECLARATIONS
// (Must be at the top for Arduino IDE compiler)
// ==========================================
struct WaterDiagnosis {
    float wqi;
    String state;
    String signature;
};

WaterDiagnosis evaluateWaterQuality(float turb, float tds, float temp);
void updateOledDisplay(float turb, float tds, float temp, const WaterDiagnosis& diag);

// ==========================================
// 1. HARDWARE PIN DEFINITIONS (ESP32 DevKit)
// ==========================================
#define PIN_TURBIDITY       34     // ADC1_CH6 (Optical Turbidity Analog Out)
#define PIN_TDS             35     // ADC1_CH7 (Analog TDS Probe Out)
#define PIN_ONEWIRE         4      // Digital GPIO 4 (DS18B20 1-Wire bus with 4.7k pull-up)

#define PIN_LED_GREEN       18     // State: NORMAL / Pristine
#define PIN_LED_YELLOW      19     // State: WARNING / Caution
#define PIN_LED_RED         23     // State: ALARM / Critical Contamination
#define PIN_BUZZER          5      // Active 5V Buzzer (Active-Low sink)
#define PIN_MUTE_BOOT_BTN   0      // Built-in ESP32 BOOT button (Zero extra wiring required!)
#define PIN_MUTE_EXT_BTN    13     // Optional external push button / toggle switch (D13 to GND)

#define OLED_SDA            21     // Hardware I2C SDA
#define OLED_SCL            22     // Hardware I2C SCL
#define SCREEN_WIDTH        128
#define SCREEN_HEIGHT       64
#define SCREEN_ADDRESS      0x3C   // Default I2C address for 1.3" OLED

// ==========================================
// 2. NETWORK & CLOUD INGESTION CREDENTIALS
// ==========================================
// Enter your smartphone mobile hotspot name and password below:
const char* WIFI_SSID     = "Aths"; 
const char* WIFI_PASSWORD = "s27gb9yu";

// Live Vercel Production Serverless Endpoint
const char* CLOUD_API_URL = "https://jalrakshak-rosy.vercel.app/api/telemetry";
const char* DEVICE_API_KEY = "jal_sec_dev_local_key";
const char* DEVICE_ID      = "ESP32_JALRAKSHAK_01";

// ==========================================
// 3. OBJECT INITIALIZATION & GLOBAL STATE
// ==========================================
// Universal OLED Driver state (Native support for 1.3" SH1106 and 0.96" SSD1306)
Adafruit_SSD1306 displaySSD = Adafruit_SSD1306(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
uint8_t targetOledAddr = 0x3C;
bool oledReady = false;

OneWire oneWire(PIN_ONEWIRE);
DallasTemperature tempSensors(&oneWire);

unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 3000;
unsigned long syncCounter = 0;
bool wifiConnected = false;
bool alarmAcknowledged = false; // Operator alarm acknowledge/mute latch

// ==========================================
// 4. SENSOR SAMPLING & SIGNAL CONDITIONING
// ==========================================
float readAdcVoltage(int pin, int samples = 64) {
    long sum = 0;
    for (int i = 0; i < samples; i++) {
        sum += analogRead(pin);
        delayMicroseconds(100);
    }
    float avgRaw = (float)sum / (float)samples;
    return (avgRaw / 4095.0f) * 3.3f;
}

float lastTurbVoltage = 0.0f;
float lastTdsVoltage = 0.0f;

// Exponential Moving Average (EMA) filters to prevent rapid LED flickering from liquid ripples or bubbles
static float smoothTurbVoltage = -1.0f;
static float smoothTdsVoltage  = -1.0f;

float readTurbidity(float vTemp) {
    float rawVoltage = readAdcVoltage(PIN_TURBIDITY, 64);
    if (smoothTurbVoltage < 0.0f) {
        smoothTurbVoltage = rawVoltage;
    } else {
        smoothTurbVoltage = (0.4f * rawVoltage) + (0.6f * smoothTurbVoltage);
    }
    lastTurbVoltage = smoothTurbVoltage;

    float voltage = smoothTurbVoltage;
    float ntu = 0.0f;
    // Calibrated for 3.3V VCC supply with EMA smoothing:
    // In clean tap water, voltage sits around 2.0V - 3.2V (Pristine: 0.5 - 5.0 NTU)
    // In turbid/silty water, voltage drops between 1.0V and 2.0V (Warning: 5 - 25 NTU)
    // In dark/slurry/blocked conditions, voltage drops below 1.0V (Severe: > 25 NTU)
    if (voltage >= 2.0f) {
        ntu = 0.5f + max(0.0f, (2.8f - voltage) * 2.0f);
    } else if (voltage >= 1.0f) {
        ntu = 5.0f + (2.0f - voltage) * (20.0f / 1.0f);
    } else {
        ntu = 25.0f + (1.0f - voltage) * (1000.0f / 1.0f);
    }
    if (ntu < 0.5f) ntu = 0.5f;
    if (ntu > 3000.0f) ntu = 3000.0f;
    return ntu;
}

float readTDS(float temperatureC) {
    float rawVoltage = readAdcVoltage(PIN_TDS, 64);
    if (smoothTdsVoltage < 0.0f) {
        smoothTdsVoltage = rawVoltage;
    } else {
        smoothTdsVoltage = (0.4f * rawVoltage) + (0.6f * smoothTdsVoltage);
    }
    lastTdsVoltage = smoothTdsVoltage;

    float voltage = smoothTdsVoltage;
    float compensationCoefficient = 1.0f + 0.02f * (temperatureC - 25.0f);
    float compensationVoltage = voltage / compensationCoefficient;

    float tdsValue = (133.42f * compensationVoltage * compensationVoltage * compensationVoltage
                    - 255.86f * compensationVoltage * compensationVoltage
                    + 857.39f * compensationVoltage) * 0.5f;

    if (tdsValue < 0.0f) tdsValue = 0.0f;
    if (tdsValue > 1500.0f) tdsValue = 1500.0f;
    return tdsValue;
}

float readFluidTemp() {
    tempSensors.requestTemperatures();
    float t = tempSensors.getTempCByIndex(0);
    if (t < -50.0f || t > 100.0f || t == -127.0f) {
        return 24.5f;
    }
    return t;
}

// ==========================================
// 5. LOCAL ANOMALY CLASSIFICATION & BUZZER DRIVER
// ==========================================
void silenceBuzzer() {
    noTone(PIN_BUZZER);
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, HIGH); // Logic HIGH stops active-low sink
    pinMode(PIN_BUZZER, INPUT);     // High-Z disconnects ground sink completely
}

void soundBuzzer(unsigned int freq = 2600) {
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);  // Active-low sink: 0V draws current from VIN (5V)
    tone(PIN_BUZZER, freq);
}

// Industrial SCADA State Machine with Schmitt-Trigger Hysteresis
static String systemState = "NORMAL";

WaterDiagnosis evaluateWaterQuality(float turb, float tds, float temp) {
    // BIS IS 10500:2012 Indian Drinking Water Standards:
    // Turbidity: Desirable < 5.0 NTU, Permissible < 15.0 NTU
    // TDS: Desirable < 500 ppm, Permissible < 2000 ppm
    float zTurb = max(0.0f, (turb - 5.0f) / 8.0f);
    float zTds  = max(0.0f, (tds - 500.0f) / 250.0f);
    float compositeAnomaly = sqrt(zTurb * zTurb + zTds * zTds);

    float wqi = max(0.0f, min(100.0f, 100.0f - (compositeAnomaly * 25.0f)));

    // Schmitt-trigger hysteresis transitions prevent rapid LED/relay flickering
    if (systemState == "NORMAL") {
        if (compositeAnomaly >= 2.1f) {
            systemState = "ALARM";
        } else if (compositeAnomaly >= 1.25f) {
            systemState = "WARNING";
        }
    } else if (systemState == "WARNING") {
        if (compositeAnomaly >= 2.1f) {
            systemState = "ALARM";
        } else if (compositeAnomaly < 0.85f) {
            systemState = "NORMAL";
        }
    } else { // ALARM
        if (compositeAnomaly < 0.85f) {
            systemState = "NORMAL";
        } else if (compositeAnomaly < 1.75f) {
            systemState = "WARNING";
        }
    }

    WaterDiagnosis diag;
    diag.wqi = wqi;
    diag.state = systemState;

    if (systemState == "NORMAL") {
        diag.signature = "Baseline / Pristine Quiescent";
        digitalWrite(PIN_LED_GREEN, HIGH);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_RED, LOW);
        if (alarmAcknowledged) {
            alarmAcknowledged = false;
            Serial.println("[ALARM] Water quality normalized. Mute latch reset.");
        }
        silenceBuzzer();
    } else if (systemState == "WARNING") {
        diag.signature = (turb > 10.0f) ? "Turbidity Drift / Sediments" : "Elevated Mineral Dissolution";
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, HIGH);
        digitalWrite(PIN_LED_RED, LOW);
        // Intermittent warning pulse (unless muted)
        if (alarmAcknowledged) {
            silenceBuzzer();
        } else if (millis() % 1000 < 200) {
            soundBuzzer(2000);
        } else {
            silenceBuzzer();
        }
    } else {
        if (turb > 20.0f && tds > 750.0f) {
            diag.signature = "Severe Runoff / Surface Influx";
        } else if (turb > 20.0f) {
            diag.signature = "Severe Sediment / Particulate Intrusion";
        } else {
            diag.signature = "Chemical / Saline Infiltration";
        }
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_RED, HIGH);

        // Audible alarm: Silence if acknowledged/muted by operator, otherwise sound loudly
        if (alarmAcknowledged) {
            silenceBuzzer();
        } else {
            soundBuzzer(2600);
        }
    }

    return diag;
}

// ==========================================
// 6. LOCAL VISUAL & AUDITORY DRIVER
// (Headless SCADA mode — visual state handled via 3-State LEDs & live Web PWA)
// ==========================================
void updateOledDisplay(float turb, float tds, float temp, const WaterDiagnosis& diag) {
    // Headless telemetry mode: visual alerts rendered locally via D18(Green), D19(Yellow), D23(Red)
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

    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    if (!http.begin(client, CLOUD_API_URL)) {
        Serial.println("[HTTP] Failed to connect to cloud endpoint.");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);

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

        // Check response payload for remote cloud commands (e.g. Alarm Acknowledge / Mute from Web UI)
        if (httpCode == 200) {
            String resp = http.getString();
            bool cloudMute = (resp.indexOf("\"alarm_acknowledged\":true") >= 0 || resp.indexOf("\"alarm_acknowledged\": true") >= 0);
            if (cloudMute) {
                if (!alarmAcknowledged) {
                    alarmAcknowledged = true;
                    Serial.println("\n[REMOTE CLOUD COMMAND] >>> Operator turned Buzzer OFF (Mute) from Web/Phone app! <<<");
                }
                silenceBuzzer();
            } else {
                if (alarmAcknowledged) {
                    alarmAcknowledged = false;
                    Serial.println("\n[REMOTE CLOUD COMMAND] >>> Operator turned Buzzer ON (Unmute) from Web/Phone app! <<<");
                }
            }
        }
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

    pinMode(PIN_TURBIDITY, INPUT);
    pinMode(PIN_TDS, INPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_YELLOW, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, HIGH); // Off initially for active-low sink

    // Configure Mute / Acknowledge Buttons (Active LOW with internal pull-ups)
    pinMode(PIN_MUTE_BOOT_BTN, INPUT_PULLUP); // Built-in BOOT button (GPIO 0)
    pinMode(PIN_MUTE_EXT_BTN, INPUT_PULLUP);  // External push button (GPIO 13 to GND)

    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(400);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);

    tempSensors.begin();

    Serial.println("[Hardware] Headless Industrial Telemetry Node Active (OLED bypassed)");
    Serial.println("[Hardware] Alert Actuators Ready: D18(Green), D19(Yellow), D23(Red), D5(Buzzer)");

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

    // Check Alarm Acknowledge / Mute button press (Bidirectional Toggle with 500ms debounce)
    static unsigned long lastBtnPress = 0;
    if ((digitalRead(PIN_MUTE_BOOT_BTN) == LOW || digitalRead(PIN_MUTE_EXT_BTN) == LOW) && (currentMillis - lastBtnPress > 500)) {
        lastBtnPress = currentMillis;
        alarmAcknowledged = !alarmAcknowledged;
        if (alarmAcknowledged) {
            Serial.println("[ALARM] >>> Operator Pressed Hardware Button: Buzzer Muted <<<");
            silenceBuzzer();
        } else {
            Serial.println("[ALARM] >>> Operator Pressed Hardware Button: Buzzer Unmuted / Armed <<<");
        }
    }

    float tempC = readFluidTemp();
    float turbNtu = readTurbidity(tempC);
    float tdsPpm = readTDS(tempC);

    WaterDiagnosis diag = evaluateWaterQuality(turbNtu, tdsPpm, tempC);
    updateOledDisplay(turbNtu, tdsPpm, tempC, diag);

    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = currentMillis;

        Serial.printf("[Sensor Read] Turb: %.1f NTU (%.2fV) | TDS: %.1f ppm (%.2fV) | Temp: %.1f C | State: %s | WQI: %.0f\n",
                      turbNtu, lastTurbVoltage, tdsPpm, lastTdsVoltage, tempC, diag.state.c_str(), diag.wqi);

        postTelemetryToCloud(turbNtu, tdsPpm, tempC, diag.state);
    }

    delay(50);
}
