"""AquaSure Core Ingestion & Telemetry Microservice.

FastAPI application providing:
- PostgreSQL persistence (compatible with Vercel Postgres & Docker)
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
from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    AnomalyEventRecord,
    SessionLocal,
    TelemetryRecord,
    init_db,
)
from app.schemas import AlertEvent, SystemState, TelemetryIn, TelemetryOut
from app.wqi_engine import calculate_wqi, diagnose_contaminant_signature

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ingestion-api")

# Configuration from environment
MQTT_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt-broker")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", "1883"))
TELEMETRY_TOPIC = os.getenv("MQTT_TELEMETRY_TOPIC", "jalrakshak/telemetry")
ALERTS_TOPIC = os.getenv("MQTT_ALERTS_TOPIC", "jalrakshak/alerts")
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "jal_sec_dev_local_key").strip()


def verify_device_key(x_device_key: Optional[str] = Header(None)):
    """Validates the hardware cryptographic secret header X-Device-Key."""
    if DEVICE_API_KEY and x_device_key != DEVICE_API_KEY:
        logger.warning(f"Blocked unauthorized telemetry POST request (Invalid X-Device-Key: '{x_device_key}')")
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Missing or invalid X-Device-Key hardware security header.",
        )
    return x_device_key

app = FastAPI(
    title="AquaSure Ingestion & Telemetry API",
    version="1.0.0",
    description="Real-time telemetry ingestion, PostgreSQL persistence, WQI scoring, and anomaly event pipeline for AquaSure.",
)

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory ring buffer fallback
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
    """Enriches raw sensor readings with WQI, saves to PostgreSQL, and broadcasts."""
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

    # 1. Persist to PostgreSQL / Database Layer
    try:
        db = SessionLocal()
        record = TelemetryRecord(
            device_id=enriched.device_id,
            timestamp=enriched.received_at,
            turbidity_ntu=enriched.turbidity_ntu,
            tds_ppm=enriched.tds_ppm,
            temp_c=enriched.temp_c,
            z_turb=enriched.z_turb,
            z_tds=enriched.z_tds,
            z_temp=enriched.z_temp,
            anomaly_score=enriched.anomaly_score,
            state=enriched.state.value,
            wqi=enriched.wqi,
            wqi_grade=enriched.wqi_grade,
            contaminant_signature=enriched.contaminant_signature,
        )
        db.add(record)

        # Check for state transition to trigger alert notification and audit event
        if raw.state != previous_system_state:
            logger.warning(
                f"SYSTEM STATE TRANSITION DETECTED: {previous_system_state.value} -> {raw.state.value}"
            )
            event_id = str(uuid.uuid4())
            event_rec = AnomalyEventRecord(
                id=event_id,
                timestamp=datetime.utcnow(),
                device_id=raw.device_id,
                previous_state=previous_system_state.value,
                current_state=raw.state.value,
                anomaly_score=raw.anomaly_score,
                wqi=wqi,
                contaminant_signature=signature,
            )
            db.add(event_rec)

            alert = AlertEvent(
                event_id=event_id,
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

        db.commit()
        db.close()
    except Exception as db_err:
        logger.error(f"Database persistence error: {db_err}")

    # 2. Broadcast to connected UI dashboards
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

    # Initialize Database Tables
    try:
        logger.info("Initializing PostgreSQL / Database schema...")
        init_db()
        logger.info("Database schema initialized successfully.")
    except Exception as db_init_err:
        logger.error(f"Failed to initialize database tables: {db_init_err}")

    # Initialize MQTT client in background thread
    mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="aquasure-ingestion-api")
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
        "service": "aquasure-ingestion-api",
        "mqtt_connected": mqtt_client.is_connected() if mqtt_client else False,
        "active_ws_clients": len(active_websockets),
        "history_count": len(telemetry_history),
    }


@app.get("/telemetry/latest", response_model=Optional[TelemetryOut], tags=["Telemetry"])
def get_latest_telemetry():
    """Returns the most recent real-time sensor reading and computed WQI."""
    if latest_telemetry:
        return latest_telemetry

    try:
        db = SessionLocal()
        record = db.query(TelemetryRecord).order_by(TelemetryRecord.id.desc()).first()
        db.close()
        if record:
            return TelemetryOut(
                device_id=record.device_id,
                turbidity_ntu=record.turbidity_ntu,
                tds_ppm=record.tds_ppm,
                temp_c=record.temp_c,
                z_turb=record.z_turb,
                z_tds=record.z_tds,
                z_temp=record.z_temp,
                anomaly_score=record.anomaly_score,
                state=record.state,
                wqi=record.wqi,
                wqi_grade=record.wqi_grade,
                contaminant_signature=record.contaminant_signature,
                received_at=record.timestamp,
            )
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="No telemetry received yet from edge node.")


@app.get("/telemetry/history", response_model=List[TelemetryOut], tags=["Telemetry"])
def get_telemetry_history():
    """Returns the rolling history of sensor readings from the database."""
    try:
        db = SessionLocal()
        records = db.query(TelemetryRecord).order_by(TelemetryRecord.id.desc()).limit(50).all()
        db.close()
        if records:
            return [
                TelemetryOut(
                    device_id=r.device_id,
                    turbidity_ntu=r.turbidity_ntu,
                    tds_ppm=r.tds_ppm,
                    temp_c=r.temp_c,
                    z_turb=r.z_turb,
                    z_tds=r.z_tds,
                    z_temp=r.z_temp,
                    anomaly_score=r.anomaly_score,
                    state=r.state,
                    wqi=r.wqi,
                    wqi_grade=r.wqi_grade,
                    contaminant_signature=r.contaminant_signature,
                    received_at=r.timestamp,
                )
                for r in reversed(records)
            ]
    except Exception as e:
        logger.warning(f"Database query fallback to in-memory deque: {e}")

    return list(telemetry_history)


@app.get("/events", tags=["Audit Log"])
def get_anomaly_events():
    """Returns the historical audit trail of water anomaly transitions."""
    try:
        db = SessionLocal()
        events = db.query(AnomalyEventRecord).order_by(AnomalyEventRecord.timestamp.desc()).limit(20).all()
        db.close()
        return events
    except Exception as e:
        return []


@app.post("/telemetry", response_model=TelemetryOut, dependencies=[Depends(verify_device_key)], tags=["Telemetry"])
def post_telemetry(telemetry: TelemetryIn):
    """HTTP endpoint to ingest telemetry directly with X-Device-Key security validation."""
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
