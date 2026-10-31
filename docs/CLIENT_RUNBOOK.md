# JalRakshak: Client Demonstration & Secure Handover Guide

This guide describes the standard operating procedures, hardware powering instructions, and DevSecOps protocols for demonstrating, running, and securely handing over the **JalRakshak Single-Unit Hardware & Cloud Monitoring System**.

---

## 1. Hardware Power & Deployment Profile (Laptop-Powered)

### Zero External Battery Dependency
To maximize operational simplicity and eliminate battery degradation/safety concerns during client demonstrations:
* **Power Source**: Standard **5V USB Port** (USB 2.0 / 3.0 / USB-C) from the **client's or demonstrator's laptop**.
* **Power Budget & Consumption**:
  * ESP32 Wi-Fi TX burst: ~180–240 mA peak.
  * Analog Sensor Shield (Turbidity + TDS + DS18B20 1-Wire): ~40–60 mA.
  * 0.96" I2C OLED Display: ~20 mA.
  * **Total Worst-Case Consumption**: ~320 mA at 5V DC ($\approx 1.6\text{ Watts}$).
  * Standard laptop USB 2.0 provides 500 mA (2.5W); USB 3.0 provides 900 mA (4.5W). **The hardware runs well within the safe operational limits of any modern laptop port.**
* **Connection Procedure**:
  1. Plug the provided USB cable into the ESP32 DevKit V1 and into any active laptop USB port.
  2. The hardware boots in under 1.5 seconds, performs sensor stabilization, and begins baseline calibration.
  3. No power banks, wall adapters, or external battery charging are needed.

---

## 2. Zero-Trust Security Handover Protocol

### The Security Principle
To adhere to ISO/IEC 27001 and CIS benchmarks for cloud and IoT credential management:
* **Never transmit bot tokens or credentials via email, chat, or version control.**
* The source repository contains **zero secrets**. Only template files (`deploy/.env.example`) are tracked in Git.
* The client has exclusive ownership of the alert bot and telemetry stream.

### Hardware-to-Cloud Authentication (`X-Device-Key`)
When deployed to public cloud environments (such as Vercel + Neon Postgres):
* The single hardware unit includes a burned-in hardware authentication token (`DEVICE_API_KEY`).
* Every HTTP/HTTPS telemetry packet sent by the ESP32 includes the `X-Device-Key: <secret_key>` header.
* The ingestion API rejects any unauthorized payload attempting to spoof water quality readings (HTTP 401 Unauthorized), preventing external tampering with audit logs or false alerts.

### Recommended Handover Option: Bot Ownership Transfer
If you created `@jalrakshak_test_bot` during development and wish to hand over this exact bot to the client:
1. Open Telegram and message `@BotFather`.
2. Send `/mybots` and select your bot (`@jalrakshak_test_bot`).
3. Click **Bot Settings** → **Transfer Ownership**.
4. Enter the client's Telegram username.
5. Provide your 2-Factor Authentication (2FA) password to finalize the transfer.
6. **Result**: The client now cryptographically owns the bot. You no longer have admin rights, and the client can revoke or regenerate the API token at any time.

### Alternative Option: Client-Generated Bot (Isolated Environment)
If the client prefers a brand-new internal bot:
1. The client opens Telegram and messages `@BotFather`.
2. Sends `/newbot` and names their company bot (e.g. `AcmeWaterAlertBot`).
3. Obtains their private API token and pastes it into `deploy/.env` or Vercel Environment Variables:
   ```ini
   TELEGRAM_BOT_TOKEN=<client_private_token>
   TELEGRAM_CHAT_ID=<client_numeric_id_or_group_id>
   DEVICE_API_KEY=<client_hardware_api_key>
   ```
4. Executes `docker compose up -d` or triggers Vercel deploy.

---

## 3. Multi-Stakeholder Boardroom Demonstration (Group Mode)

To present the system to multiple product buyers or executive teams simultaneously:
1. Create a Telegram Group (e.g. *"JalRakshak Water Quality Live Monitor"*).
2. Add the alert bot to the group.
3. Invite the product buyers into the group.
4. Retrieve the Group ID (using `@RawDataBot` or `@userinfobot`) and set it in `deploy/.env`:
   ```ini
   TELEGRAM_CHAT_ID=-100xxxxxxxxxx
   ```
5. Restart the alert worker:
   ```bash
   docker compose restart alert-worker
   ```
6. When water quality shifts from `NORMAL` to `WARNING` or `ALARM`, **every buyer's device will receive the push notification simultaneously with audio chimes.**

---

## 4. Mobile Progressive Web App (PWA) Access

* **Desktop / Local Wi-Fi**: Accessible via `http://<laptop-ip>:3000` on any device on the local network.
* **Production Mobile App (Vercel / HTTPS)**: Once deployed to Vercel over automated SSL/TLS (HTTPS), mobile Chrome/Edge enables the native **"Install App" / "Add to Home Screen"** prompt. The client can tap install to get a full-screen standalone application with custom app icon.

---

## 5. 1-Command Startup & Teardown (Local Docker)

### Starting the System
```bash
cd jalrakshak
docker compose -f deploy/docker-compose.yml up -d
```
Access endpoints:
* **Web Dashboard**: `http://localhost:3000`
* **Interactive API Docs (Swagger UI)**: `http://localhost:8000/docs`
* **MQTT Telemetry Broker**: `localhost:1883`

### Stopping the System
```bash
docker compose -f deploy/docker-compose.yml down
```
To wipe historical telemetry and reset to clean state:
```bash
docker compose -f deploy/docker-compose.yml down -v
```
