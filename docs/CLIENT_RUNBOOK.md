# JalRakshak: Client Demonstration & Secure Handover Guide

This guide describes the standard operating procedures and DevSecOps protocols for running, demonstrating, and securely managing the **JalRakshak** system.

---

## 1. Zero-Trust Security Handover Protocol

### The Security Principle
To adhere to ISO/IEC 27001 and CIS benchmarks for cloud and IoT credential management:
* **Never transmit bot tokens or credentials via email, chat, or version control.**
* The source repository contains **zero secrets**. Only template files (`deploy/.env.example`) are tracked in Git.
* The client has exclusive ownership of the alert bot and telemetry stream.

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
3. Obtains their private API token and pastes it into `deploy/.env`:
   ```ini
   TELEGRAM_BOT_TOKEN=<client_private_token>
   TELEGRAM_CHAT_ID=<client_numeric_id_or_group_id>
   ```
4. Executes `docker compose up -d` to launch the stack.

---

## 2. Multi-Stakeholder Boardroom Demonstration (Group Mode)

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

## 3. 1-Command Startup & Teardown

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
