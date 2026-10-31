"""JalRakshak Telegram Alert Worker Microservice.

Subscribes to 'jalrakshak/alerts' on MQTT and dispatches formatted,
real-time notifications directly to the user's phone via Telegram Bot API.
"""

import json
import logging
import os
import time
from datetime import datetime
import httpx
import paho.mqtt.client as mqtt

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("alert-worker")

MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
ALERTS_TOPIC = os.getenv("MQTT_ALERTS_TOPIC", "jalrakshak/alerts")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

# Minimum cooldown seconds between repeat alerts of the same state
ALERT_COOLDOWN_SECONDS = 10
last_alert_time = 0.0
last_state_alerted = None


def send_telegram_notification(message: str) -> bool:
    """Dispatches a message using the official Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning(
            "Telegram credentials not configured. Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in deploy/.env"
        )
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
    }

    try:
        response = httpx.post(url, json=payload, timeout=10.0)
        if response.status_code == 200:
            logger.info("Successfully delivered Telegram alert notification to client phone.")
            return True
        else:
            logger.error(f"Telegram API rejected message with HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Network error while connecting to Telegram API: {e}")
        return False


def format_alert_message(data: dict) -> str:
    """Formats rich alert copy with diagnostic emojis and metrics."""
    state = data.get("current_state", "UNKNOWN")
    wqi = data.get("wqi", 0.0)
    signature = data.get("contaminant_signature", "Unknown anomaly")
    turb = data.get("turbidity_ntu", 0.0)
    tds = data.get("tds_ppm", 0.0)
    temp = data.get("temp_c", 0.0)
    anomaly_score = data.get("anomaly_score", 0.0)
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    if state == "NORMAL":
        return (
            f"✅ <b>JALRAKSHAK: Water Restored to Baseline</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"⏱ <b>Timestamp:</b> {timestamp}\n"
            f"📊 <b>Water Quality Index:</b> {wqi} / 100 (Grade A)\n"
            f"🟢 <b>Status:</b> All sensors within normal quiescent limits.\n"
        )

    header = "🚨 <b>JALRAKSHAK CRITICAL ALARM</b>" if state == "HIGH ANOMALY" else "⚠️ <b>JALRAKSHAK WARNING</b>"

    return (
        f"{header}\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"⏱ <b>Timestamp:</b> {timestamp}\n"
        f"📊 <b>Water Quality Index:</b> {wqi} / 100\n"
        f"🔍 <b>Diagnosis:</b> {signature}\n\n"
        f"📈 <b>Live Telemetry:</b>\n"
        f"  • Turbidity: <b>{turb:.1f} NTU</b>\n"
        f"  • TDS (EC25): <b>{tds:.1f} ppm</b>\n"
        f"  • Fluid Temp: <b>{temp:.1f} °C</b>\n"
        f"  • S_composite: <b>{anomaly_score:.2f}</b>\n\n"
        f"⚡ <b>Action:</b> Inspect sample vessel and check upstream inflow."
    )


def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info(f"Connected to Mosquitto at {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(ALERTS_TOPIC)
        logger.info(f"Subscribed to alerts topic: {ALERTS_TOPIC}")

        # Send startup confirmation to Telegram if configured
        if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
            startup_msg = "🤖 <b>JalRakshak Alert Worker Online</b>\nLive monitoring active. Alerts will be posted here."
            send_telegram_notification(startup_msg)
    else:
        logger.error(f"MQTT connection failed with code {rc}")


def on_message(client, userdata, msg):
    global last_alert_time, last_state_alerted
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
        state = payload.get("current_state")
        now = time.time()

        # Enforce rate-limiting for repeated alerts
        if state == last_state_alerted and (now - last_alert_time) < ALERT_COOLDOWN_SECONDS:
            logger.info(f"Skipping duplicate alert for {state} (cooldown active).")
            return

        text = format_alert_message(payload)
        success = send_telegram_notification(text)
        if success:
            last_alert_time = now
            last_state_alerted = state

    except Exception as e:
        logger.error(f"Error processing alert event: {e}")


def main():
    logger.info("Starting JalRakshak Alert Worker Microservice...")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="jalrakshak-alert-worker")
    client.on_connect = on_connect
    client.on_message = on_message

    while True:
        try:
            logger.info(f"Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
            client.connect(MQTT_HOST, MQTT_PORT, 60)
            client.loop_forever()
        except Exception as e:
            logger.warning(f"MQTT connection error: {e}. Retrying in 5 seconds...")
            time.sleep(5)


if __name__ == "__main__":
    main()
