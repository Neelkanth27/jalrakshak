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
#define PIN_BUZZER          5      // Active 5V Buzzer

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

float readTurbidity(float vTemp) {
    float voltage = readAdcVoltage(PIN_TURBIDITY, 64);
    float ntu = 0.0f;
    if (voltage < 2.5f) {
        ntu = 3000.0f;
    } else if (voltage >= 3.2f) {
        ntu = 0.5f;
    } else {
        ntu = (3.2f - voltage) * (3000.0f / 0.7f);
    }
    if (ntu < 0.0f) ntu = 0.0f;
    if (ntu > 3000.0f) ntu = 3000.0f;
    return ntu;
}

float readTDS(float temperatureC) {
    float voltage = readAdcVoltage(PIN_TDS, 64);
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
// 5. LOCAL ANOMALY CLASSIFICATION
// ==========================================
WaterDiagnosis evaluateWaterQuality(float turb, float tds, float temp) {
    float zTurb = max(0.0f, (turb - 2.0f) / 3.0f);
    float zTds  = max(0.0f, (tds - 150.0f) / 50.0f);
    float compositeAnomaly = sqrt(zTurb * zTurb + zTds * zTds);

    float wqi = max(0.0f, min(100.0f, 100.0f - (compositeAnomaly * 25.0f)));

    WaterDiagnosis diag;
    diag.wqi = wqi;

    if (compositeAnomaly < 1.0f) {
        diag.state = "NORMAL";
        diag.signature = "Baseline / Pristine Quiescent";
        digitalWrite(PIN_LED_GREEN, HIGH);
        digitalWrite(PIN_LED_YELLOW, LOW);
        digitalWrite(PIN_LED_RED, LOW);
        noTone(PIN_BUZZER);
        digitalWrite(PIN_BUZZER, LOW);
    } else if (compositeAnomaly < 2.0f) {
        diag.state = "WARNING";
        diag.signature = (turb > 10.0f) ? "Turbidity Drift / Sediments" : "Elevated Mineral Dissolution";
        digitalWrite(PIN_LED_GREEN, LOW);
        digitalWrite(PIN_LED_YELLOW, HIGH);
        digitalWrite(PIN_LED_RED, LOW);
        // Intermittent warning pulse
        if (millis() % 1000 < 200) {
            tone(PIN_BUZZER, 2000);
        } else {
            noTone(PIN_BUZZER);
            digitalWrite(PIN_BUZZER, LOW);
        }
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
        // Loud audible alarm tone (works on both Passive and Active buzzers)
        tone(PIN_BUZZER, 2600);
    }

    return diag;
}

// ==========================================
// 6. OLED GRAPHICAL DISPLAY RENDERER
// (Universal Hardware Driver for SH1106 & SSD1306)
// ==========================================
void sendOledCommand(uint8_t addr, uint8_t cmd) {
    Wire.beginTransmission(addr);
    Wire.write(0x00); // Co=0, D/C#=0 (Command byte)
    Wire.write(cmd);
    Wire.endTransmission();
}

void initUniversalOled(uint8_t addr) {
    // 1. Turn display off during setup
    sendOledCommand(addr, 0xAE); // Display OFF

    // 2. Clock & timing
    sendOledCommand(addr, 0xD5); // Set Display Clock Divide / Osc Freq
    sendOledCommand(addr, 0x80); // Suggested ratio 0x80

    // 3. Multiplex ratio
    sendOledCommand(addr, 0xA8); // Set Multiplex Ratio
    sendOledCommand(addr, 0x3F); // 64 MUX (1/64 duty)

    // 4. Display offset & start line
    sendOledCommand(addr, 0xD3); // Set Display Offset
    sendOledCommand(addr, 0x00); // 0 offset
    sendOledCommand(addr, 0x40); // Start line 0

    // 5. POWER PUMP: Charge pump for SSD1306 AND DC-DC converter for SH1106
    // Both commands are sent. The SSD1306 recognizes 0x8D and ignores 0xAD.
    // The SH1106 recognizes 0xAD and ignores 0x8D.
    sendOledCommand(addr, 0x8D); // SSD1306 Charge Pump command
    sendOledCommand(addr, 0x14); // Enable Charge Pump (7.5V boost)
    sendOledCommand(addr, 0xAD); // SH1106 DC-DC Converter command
    sendOledCommand(addr, 0x8B); // Enable Built-in DC-DC Converter (0x8B = ON)
    sendOledCommand(addr, 0x33); // Set VPP to 9V (SH1106)

    // 6. Addressing & orientation
    sendOledCommand(addr, 0xA1); // Segment re-map (A1 = column 127 mapped to SEG0)
    sendOledCommand(addr, 0xC8); // COM Output Scan Direction (C8 = remapped mode)
    sendOledCommand(addr, 0xDA); // COM Pins Hardware Configuration
    sendOledCommand(addr, 0x12); // Alternative COM pin config

    // 7. Contrast & precharge
    sendOledCommand(addr, 0x81); // Contrast Control
    sendOledCommand(addr, 0xFF); // Maximum brightness (0xFF)
    sendOledCommand(addr, 0xD9); // Set Pre-charge Period
    sendOledCommand(addr, 0x22); // Precharge period
    sendOledCommand(addr, 0xDB); // Set VCOMH Deselect Level
    sendOledCommand(addr, 0x40); // ~0.77 x VCC

    // 8. Normal display & resume from RAM
    sendOledCommand(addr, 0xA6); // Normal display (0 in RAM = off, 1 in RAM = on)
    sendOledCommand(addr, 0xA4); // Output follows RAM content

    // 9. Turn display ON!
    sendOledCommand(addr, 0xAF); // Display ON!
}

void oledFlush(uint8_t addr, const uint8_t* buf, uint8_t colOffset = 2) {
    if (!buf) return;
    for (uint8_t page = 0; page < 8; page++) {
        sendOledCommand(addr, 0xB0 + page);                      // Set Page Address (0-7)
        sendOledCommand(addr, 0x00 + (colOffset & 0x0F));        // Lower Column Address
        sendOledCommand(addr, 0x10 + ((colOffset >> 4) & 0x0F)); // Higher Column Address

        // Stream 128 bytes of pixel data in 16-byte chunks (17 bytes total per transmission)
        for (uint8_t chunk = 0; chunk < 8; chunk++) {
            Wire.beginTransmission(addr);
            Wire.write(0x40); // Data mode (D/C# = 1)
            for (uint8_t b = 0; b < 16; b++) {
                Wire.write(buf[page * 128 + chunk * 16 + b]);
            }
            Wire.endTransmission();
        }
    }
}

void renderScreen(Adafruit_GFX& disp, float turb, float tds, float temp, const WaterDiagnosis& diag) {
    disp.setTextSize(1);
    disp.setTextColor(1); // 1 = White
    disp.setCursor(0, 0);
    disp.print("JALRAKSHAK | ");
    disp.print(diag.state);

    disp.drawLine(0, 10, 127, 10, 1);

    disp.setCursor(0, 14);
    disp.setTextSize(2);
    disp.print("WQI:");
    disp.print((int)diag.wqi);
    disp.setTextSize(1);
    disp.print("/100");

    disp.setTextSize(1);
    disp.setCursor(0, 32);
    disp.print("Turb: ");
    disp.print(turb, 1);
    disp.print(" NTU");

    disp.setCursor(0, 42);
    disp.print("TDS : ");
    disp.print((int)tds);
    disp.print(" ppm");

    disp.setCursor(0, 52);
    disp.print("Temp: ");
    disp.print(temp, 1);
    disp.print(" C  ");
    disp.print(wifiConnected ? "[Cloud OK]" : "[Offline]");
}

void updateOledDisplay(float turb, float tds, float temp, const WaterDiagnosis& diag) {
    if (oledReady) {
        displaySSD.clearDisplay();
        renderScreen(displaySSD, turb, tds, temp, diag);
        oledFlush(targetOledAddr, displaySSD.getBuffer(), 2);
    }
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

    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, HIGH);
    delay(400);
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);

    tempSensors.begin();

    // Lock I2C pins for ESP32 Arduino Core 3.x so library calls to Wire.begin() do not unbind pins
    Wire.setPins(OLED_SDA, OLED_SCL);
    Wire.begin(OLED_SDA, OLED_SCL);
    Wire.setClock(100000);  // 100 kHz standard mode for rock-solid breadboard I2C
    delay(50);

    // Active I2C Bus Diagnostics & Auto-Pin-Swap Detection
    Serial.println("\n[I2C] Scanning I2C bus (Attempt 1: SDA=GPIO21, SCL=GPIO22)...");
    byte foundDevices = 0;
    byte detectedAddr = 0;
    for (byte addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        byte error = Wire.endTransmission();
        if (error == 0) {
            Serial.printf("[I2C] >>> SUCCESS: Device discovered at address 0x%02X <<<\n", addr);
            if (addr == 0x3C || addr == 0x3D) {
                detectedAddr = addr;
            }
            foundDevices++;
            break; // Stop immediately upon finding display to prevent bus stress
        }
    }

    // If 0 devices found, automatically test swapped lines (SDA=GPIO22, SCL=GPIO21)
    if (foundDevices == 0) {
        Serial.println("[I2C] No device at 21/22. Testing SWAPPED pins (Attempt 2: SDA=GPIO22, SCL=GPIO21)...");
        Wire.end();
        delay(50);
        Wire.setPins(22, 21);
        Wire.begin(22, 21);
        Wire.setClock(100000);
        delay(50);

        for (byte addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            byte error = Wire.endTransmission();
            if (error == 0) {
                Serial.printf("[I2C] >>> SUCCESS with SWAPPED pins: Device discovered at address 0x%02X! <<<\n", addr);
                if (addr == 0x3C || addr == 0x3D) {
                    detectedAddr = addr;
                }
                foundDevices++;
                break;
            }
        }
    }

    if (foundDevices == 0) {
        Serial.println("[I2C] >>> ALERT: 0 I2C devices acknowledged on both pin combinations! <<<");
        Serial.println("[I2C] Fix 1: Connect OLED VDD to 5V (VIN rail). Model M-130-12864 has a 3.3V LDO regulator that needs 5V input!");
        Serial.println("[I2C] Fix 2: Check Terminal 5 (D21) & Terminal 2 (D22) - ensure bare metal wire is clamped, not plastic.");
        Serial.println("[I2C] Fix 3: Check breadboard rows - ensure wires line up with GND, VDD, SCK, SDA.");
    }

    targetOledAddr = (detectedAddr != 0) ? detectedAddr : 0x3C;
    Serial.printf("[OLED] Activating Universal Hardware Driver for 1.3\" / 0.96\" OLED at 0x%02X...\n", targetOledAddr);

    // Initialize displaySSD in memory to provide Adafruit GFX text & graphics rendering canvas
    if (displaySSD.begin(SSD1306_SWITCHCAPVCC, targetOledAddr, false, false)) {
        oledReady = true;

        // Apply native hardware configuration (energizes both SH1106 DC-DC booster & SSD1306 charge pump)
        initUniversalOled(targetOledAddr);

        // Hardware test flash: illuminate entire panel for 400ms to visually verify OLED glass & power
        Serial.println("[OLED] Visual verification flash: Turning entire display solid white for 400ms...");
        sendOledCommand(targetOledAddr, 0xA5); // All pixels ON
        delay(400);
        sendOledCommand(targetOledAddr, 0xA4); // Resume RAM mode

        // Draw boot splash screen on display canvas
        displaySSD.clearDisplay();
        displaySSD.drawRect(0, 0, 128, 64, SSD1306_WHITE);
        displaySSD.setTextSize(1);
        displaySSD.setTextColor(SSD1306_WHITE);
        displaySSD.setCursor(15, 18);
        displaySSD.println("JALRAKSHAK");
        displaySSD.setCursor(15, 32);
        displaySSD.println("1.3\" OLED ONLINE");
        displaySSD.setCursor(15, 46);
        displaySSD.println("Connecting WiFi...");

        // Push splash frame directly to SH1106/SSD1306 RAM
        oledFlush(targetOledAddr, displaySSD.getBuffer(), 2);
        Serial.printf("[OLED] >>> SUCCESS: 1.3\" M130-12864 OLED initialized and rendered at 0x%02X! <<<\n", targetOledAddr);
    } else {
        Serial.println("[OLED] Initialization failed. Check I2C wiring (SDA=21, SCL=22).");
    }

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

    float tempC = readFluidTemp();
    float turbNtu = readTurbidity(tempC);
    float tdsPpm = readTDS(tempC);

    WaterDiagnosis diag = evaluateWaterQuality(turbNtu, tdsPpm, tempC);
    updateOledDisplay(turbNtu, tdsPpm, tempC, diag);

    if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
        lastTelemetryTime = currentMillis;

        Serial.printf("[Sensor Read] Turbidity: %.1f NTU | TDS: %.1f ppm | Temp: %.1f C | State: %s | WQI: %.0f\n",
                      turbNtu, tdsPpm, tempC, diag.state.c_str(), diag.wqi);

        postTelemetryToCloud(turbNtu, tdsPpm, tempC, diag.state);
    }

    delay(50);
}
