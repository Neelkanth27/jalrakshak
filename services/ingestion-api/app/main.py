"""JalRakshak Core Ingestion & Telemetry Microservice.

FastAPI application providing:
- MQTT background listener for ESP32 telemetry
- Real-time WebSocket broadcasting to web dashboard clients
- REST APIs for metrics, status, and historical data
- Anomaly transition event publishing for alert workers
"""

import asyncio
import json
import logging
import os
import uuid
from collections import deque
from datetime import datetime
from typing import Deque, List, Optional

import paho.mqtt.client as mqtt
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import AlertEvent, SystemState, TelemetryIn, TelemetryOut
from app.wqi_engine import calculate_wqi, diagnose_contaminant_signature

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ingestion-api")

# Configuration from environment
MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
TELEMETRY_TOPIC = os.getenv("MQTT_TELEMETRY_TOPIC", "jalrakshak/telemetry")
ALERTS_TOPIC = os.getenv("MQTT_ALERTS_TOPIC", "jalrakshak/alerts")

app = FastAPI(
    title="JalRakshak Ingestion & Telemetry API",
    version="1.0.0",
    description="Real-time telemetry ingestion, WQI scoring, and anomaly event pipeline for JalRakshak.",
)

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory ring buffer for live streaming and historical plots (last 200 samples)
telemetry_history: Deque[TelemetryOut] = deque(maxlen=200)
latest_telemetry: Optional[TelemetryOut] = None
previous_system_state: SystemState = SystemState.NORMAL

# Active WebSocket connections pool
active_websockets: List[WebSocket] = []

# Global MQTT Client instance
mqtt_client: Optional[mqtt.Client] = None
loop: Optional[asyncio.AbstractEventLoop] = None


class ConnectionManager:
    """Manages active browser WebSocket subscriptions."""

    @staticmethod
    async def connect(websocket: WebSocket):
        await websocket.accept()
        active_websockets.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(active_websockets)}")

    @staticmethod
    def disconnect(websocket: WebSocket):
        if websocket in active_websockets:
            active_websockets.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(active_websockets)}")

    @staticmethod
    async def broadcast(message: dict):
        dead_clients = []
        for connection in active_websockets:
            try:
                await connection.send_json(message)
            except Exception:
                dead_clients.append(connection)

        for dead in dead_clients:
            if dead in active_websockets:
                active_websockets.remove(dead)


def process_and_enrich_telemetry(raw: TelemetryIn) -> TelemetryOut:
    """Enriches raw sensor readings with WQI and diagnostic fingerprint."""
    global latest_telemetry, previous_system_state

    wqi, grade = calculate_wqi(raw.anomaly_score)
    signature = diagnose_contaminant_signature(raw)

    enriched = TelemetryOut(
        **raw.model_dump(),
        wqi=wqi,
        wqi_grade=grade,
        contaminant_signature=signature,
        received_at=datetime.utcnow(),
    )

    latest_telemetry = enriched
    telemetry_history.append(enriched)

    # Check for state transition to trigger alert notification
    if raw.state != previous_system_state:
        logger.warning(
            f"SYSTEM STATE TRANSITION DETECTED: {previous_system_state.value} -> {raw.state.value}"
        )
        alert = AlertEvent(
            event_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            device_id=raw.device_id,
            previous_state=previous_system_state,
            current_state=raw.state,
            anomaly_score=raw.anomaly_score,
            wqi=wqi,
            contaminant_signature=signature,
            turbidity_ntu=raw.turbidity_ntu,
            tds_ppm=raw.tds_ppm,
            temp_c=raw.temp_c,
        )
        previous_system_state = raw.state

        # Publish alert to MQTT for alert worker
        if mqtt_client and mqtt_client.is_connected():
            mqtt_client.publish(ALERTS_TOPIC, alert.model_dump_json())

    # Broadcast to connected UI dashboards
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(
            ConnectionManager.broadcast(json.loads(enriched.model_dump_json())),
            loop,
        )

    return enriched


# MQTT Callbacks
def on_mqtt_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info(f"Connected to Mosquitto Broker at {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(TELEMETRY_TOPIC)
        logger.info(f"Subscribed to MQTT topic: {TELEMETRY_TOPIC}")
    else:
        logger.error(f"MQTT connection failed with code {rc}")


def on_mqtt_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode("utf-8")
        data = json.loads(payload_str)
        telemetry_in = TelemetryIn(**data)
        process_and_enrich_telemetry(telemetry_in)
    except Exception as e:
        logger.error(f"Failed to parse incoming telemetry message: {e}")


@app.on_event("startup")
async def startup_event():
    global mqtt_client, loop
    loop = asyncio.get_running_loop()

    # Initialize MQTT client in background thread
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="jalrakshak-ingestion-api")
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_message = on_mqtt_message

    try:
        logger.info(f"Attempting to connect to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
        mqtt_client.connect_async(MQTT_HOST, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        logger.warning(f"Could not connect to MQTT broker immediately: {e}. Will retry in background.")


@app.on_event("shutdown")
def shutdown_event():
    global mqtt_client
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


# REST Endpoints
@app.get("/health", tags=["Diagnostics"])
def healthcheck():
    """Healthcheck endpoint for Docker Compose and monitoring probes."""
    return {
        "status": "healthy",
        "service": "jalrakshak-ingestion-api",
        "mqtt_connected": mqtt_client.is_connected() if mqtt_client else False,
        "active_ws_clients": len(active_websockets),
        "history_count": len(telemetry_history),
    }


@app.get("/telemetry/latest", response_model=Optional[TelemetryOut], tags=["Telemetry"])
def get_latest_telemetry():
    """Returns the most recent real-time sensor reading and computed WQI."""
    if not latest_telemetry:
        raise HTTPException(status_code=404, detail="No telemetry received yet from edge node.")
    return latest_telemetry


@app.get("/telemetry/history", response_model=List[TelemetryOut], tags=["Telemetry"])
def get_telemetry_history():
    """Returns the rolling history of sensor readings for real-time charts."""
    return list(telemetry_history)


@app.post("/telemetry", response_model=TelemetryOut, tags=["Telemetry"])
def post_telemetry(telemetry: TelemetryIn):
    """HTTP fallback endpoint to ingest telemetry directly."""
    return process_and_enrich_telemetry(telemetry)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """WebSocket streaming endpoint for reactive web dashboards."""
    await ConnectionManager.connect(websocket)
    try:
        while True:
            # Keep socket alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ConnectionManager.disconnect(websocket)
