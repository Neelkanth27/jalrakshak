"""JalRakshak Serverless Cloud API (Vercel + Neon Postgres).

Features:
- Telemetry Ingestion (POST /api/telemetry) with X-Device-Key security header
- 0-100 Water Quality Index (WQI) computation & Smart Contaminant Classifier
- Telemetry History (GET /api/telemetry/history) from Neon Postgres
- Telegram Alert Dispatcher via HTTP REST
"""

import os
import json
import ssl
import time
import logging
import urllib.parse
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    desc,
)
from sqlalchemy.orm import declarative_base, sessionmaker

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("jalrakshak-cloud-api")

# Environment & Database Configuration
DEVICE_API_KEY = os.getenv("DEVICE_API_KEY", "jal_sec_dev_local_key").strip()
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "9183317918:AAFgXyi5NLRb2dgVNvFrxMDyOQkBWioCaO4").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "6809883846").strip()

_last_telegram_alert_state = None
_last_telegram_alert_time = 0.0

RAW_DB_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:////tmp/jalrakshak_cloud.db"

# SQLAlchemy Setup with resilient fallback
Base = declarative_base()


class TelemetryRecord(Base):
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    device_id = Column(String(64), default="ESP32_JALRAKSHAK_01")
    turbidity_ntu = Column(Float, nullable=False)
    tds_ppm = Column(Float, nullable=False)
    temp_c = Column(Float, nullable=False)
    wqi = Column(Float, nullable=False)
    state = Column(String(32), nullable=False)
    contaminant_signature = Column(String(64), nullable=True)


class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    device_id = Column(String(64), default="ESP32_JALRAKSHAK_01")
    wqi = Column(Float, nullable=False)
    state = Column(String(32), nullable=False)
    contaminant_signature = Column(String(64), nullable=False)
    diagnostics = Column(Text, nullable=True)


ACTIVE_DB_TYPE = "SQLite (/tmp)"


def get_engine():
    global ACTIVE_DB_TYPE

    if "sqlite" in RAW_DB_URL:
        ACTIVE_DB_TYPE = "SQLite (/tmp)"
        eng = create_engine("sqlite:////tmp/jalrakshak_cloud.db", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=eng)
        return eng

    # Strategy 1: Try psycopg2 with sslmode=require and without channel_binding
    try:
        parsed = urllib.parse.urlsplit(RAW_DB_URL)
        q_params = urllib.parse.parse_qsl(parsed.query)
        filtered_params = [(k, v) for k, v in q_params if k != "channel_binding"]
        if not any(k == "sslmode" for k, _ in filtered_params):
            filtered_params.append(("sslmode", "require"))
        new_query = urllib.parse.urlencode(filtered_params)
        url_psycopg2 = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, new_query, ""))
        url_psycopg2 = url_psycopg2.replace("postgres://", "postgresql+psycopg2://", 1)
        if url_psycopg2.startswith("postgresql://"):
            url_psycopg2 = url_psycopg2.replace("postgresql://", "postgresql+psycopg2://", 1)

        eng = create_engine(url_psycopg2, pool_pre_ping=True)
        Base.metadata.create_all(bind=eng)
        ACTIVE_DB_TYPE = "Neon Postgres (psycopg2)"
        logger.info(f"Connected to Neon Postgres via psycopg2")
        return eng
    except Exception as e1:
        logger.warning(f"psycopg2 attempt failed: {e1}. Trying pg8000 with clean ssl_context...")

    # Strategy 2: Try pg8000 with standard Python ssl_context (strip all query args like sslmode/channel_binding)
    try:
        parsed = urllib.parse.urlsplit(RAW_DB_URL)
        clean_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
        clean_url = clean_url.replace("postgres://", "postgresql+pg8000://", 1)
        if clean_url.startswith("postgresql://"):
            clean_url = clean_url.replace("postgresql://", "postgresql+pg8000://", 1)

        ssl_ctx = ssl.create_default_context()
        eng = create_engine(clean_url, connect_args={"ssl_context": ssl_ctx}, pool_pre_ping=True)
        Base.metadata.create_all(bind=eng)
        ACTIVE_DB_TYPE = "Neon Postgres (pg8000)"
        logger.info(f"Connected to Neon Postgres via pg8000")
        return eng
    except Exception as e2:
        logger.error(f"pg8000 attempt failed: {e2}. Falling back to SQLite.")

    # Strategy 3: Safe local SQLite fallback
    ACTIVE_DB_TYPE = "SQLite (/tmp fallback)"
    fallback_eng = create_engine("sqlite:////tmp/jalrakshak_cloud.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=fallback_eng)
    return fallback_eng


engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Pydantic Schemas
class TelemetryIn(BaseModel):
    device_id: str = "ESP32_JALRAKSHAK_01"
    turbidity_ntu: float = Field(..., ge=0.0, description="Optical Turbidity in NTU")
    tds_ppm: float = Field(..., ge=0.0, description="TDS in ppm (EC25 compensated)")
    temp_c: float = Field(..., ge=-10.0, le=100.0, description="Temperature in Celsius")
    state: Optional[str] = "NORMAL"


class TelemetryOut(BaseModel):
    timestamp: str
    received_at: str
    device_id: str
    turbidity_ntu: float
    tds_ppm: float
    temp_c: float
    wqi: float
    wqi_grade: str
    anomaly_score: float
    z_turb: float
    z_tds: float
    z_temp: float
    state: str
    contaminant_signature: str
    alarm_acknowledged: bool = False

    class Config:
        from_attributes = True


_alarm_acknowledged = False


def make_telemetry_out(r: TelemetryRecord) -> TelemetryOut:
    turb = r.turbidity_ntu
    tds = r.tds_ppm
    temp = r.temp_c
    wqi = r.wqi

    z_turb = max(0.0, round((turb - 2.0) / 3.0, 2))
    z_tds = max(0.0, round((tds - 150.0) / 50.0, 2))
    z_temp = max(0.0, round(abs(temp - 25.0) / 2.0, 2))
    anomaly_score = round((z_turb**2 + z_tds**2)**0.5, 2)

    if wqi >= 90.0:
        wqi_grade = "Grade A (Pristine Baseline)"
    elif wqi >= 75.0:
        wqi_grade = "Grade B (Nominal Quiescent)"
    elif wqi >= 50.0:
        wqi_grade = "Grade C (Caution / Degrading)"
    else:
        wqi_grade = "Grade D (Critical Anomaly)"

    state = "HIGH ANOMALY" if r.state in ["ALARM", "HIGH ANOMALY"] else r.state
    ts = r.timestamp.strftime("%Y-%m-%d %H:%M:%S")

    return TelemetryOut(
        timestamp=ts,
        received_at=ts,
        device_id=r.device_id,
        turbidity_ntu=turb,
        tds_ppm=tds,
        temp_c=temp,
        wqi=wqi,
        wqi_grade=wqi_grade,
        anomaly_score=anomaly_score,
        z_turb=z_turb,
        z_tds=z_tds,
        z_temp=z_temp,
        state=state,
        contaminant_signature=r.contaminant_signature or "Baseline / Quiescent Nominal",
        alarm_acknowledged=_alarm_acknowledged,
    )


# Smart WQI & Contaminant Classification Logic
def calculate_wqi_and_signature(turbidity: float, tds: float, temp: float):
    turb_score = max(0.0, (turbidity - 2.0) / 13.0)
    tds_score = max(0.0, (tds - 150.0) / 350.0)
    
    composite_s = (turb_score**2 + tds_score**2) ** 0.5
    wqi = max(0.0, min(100.0, round(100.0 - (composite_s * 25.0), 1)))

    if wqi >= 75.0:
        state = "NORMAL"
        signature = "Baseline / Quiescent Nominal"
    elif wqi >= 50.0:
        state = "WARNING"
        if turbidity > 15.0 and tds <= 300.0:
            signature = "Sediment / Pipe Erosion Signature"
        elif tds > 300.0 and turbidity <= 15.0:
            signature = "Chemical / Mineral Runoff"
        else:
            signature = "Elevated Dissolved Solids & Turbidity"
    else:
        state = "ALARM"
        if turbidity > 25.0 and tds > 500.0:
            signature = "Severe Runoff / Surface Intrusion"
        elif turbidity > 25.0:
            signature = "Severe Sediment / Particulate Intrusion"
        elif tds > 500.0:
            signature = "Chemical / Saline Infiltration"
        else:
            signature = "Multi-Parameter Critical Contamination"

    return wqi, state, signature


# Telegram Dispatch Helper with intelligent debouncing
def dispatch_telegram_alert(out: TelemetryOut):
    global _last_telegram_alert_state, _last_telegram_alert_time
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    now = time.time()
    # Debounce: Alert only on state transition (e.g. NORMAL -> WARNING/ALARM) or every 5 minutes if persisting
    state_changed = (out.state != _last_telegram_alert_state)
    time_elapsed = (now - _last_telegram_alert_time) > 300.0  # 5 minutes

    if not (state_changed or time_elapsed):
        return

    _last_telegram_alert_state = out.state
    _last_telegram_alert_time = now

    emoji = "🚨" if out.state == "ALARM" else "⚠️"
    msg = (
        f"{emoji} *JALRAKSHAK CLOUD ALERT: {out.state}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"⏱ *Timestamp:* `{out.timestamp}` (UTC)\n"
        f"📊 *Water Quality Index (WQI):* `{out.wqi:.1f} / 100`\n"
        f"🔍 *Diagnosis:* {out.contaminant_signature}\n\n"
        f"📈 *Live Telemetry:*\n"
        f"  • Turbidity: `{out.turbidity_ntu:.1f} NTU`\n"
        f"  • TDS (EC25): `{out.tds_ppm:.1f} ppm`\n"
        f"  • Temperature: `{out.temp_c:.1f} °C`\n\n"
        f"⚡ *Action:* Open live dashboard: https://jalrakshak-rosy.vercel.app"
    )
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        httpx.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "Markdown"}, timeout=4.0)
        logger.info(f"Telegram alert dispatched successfully for state {out.state}")
    except Exception as e:
        logger.warning(f"Telegram dispatch failed: {e}")


# Security Header Verification
def verify_device_key(x_device_key: Optional[str] = Header(None)):
    if DEVICE_API_KEY and x_device_key != DEVICE_API_KEY:
        logger.warning(f"Blocked unauthorized telemetry (Key: {x_device_key})")
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid X-Device-Key")
    return x_device_key


# FastAPI Application
app = FastAPI(
    title="JalRakshak Cloud Serverless API",
    description="Edge-to-Cloud Telemetry Ingestion and Neon Postgres Persistence",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
@app.get("/api")
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "JalRakshak Cloud Ingestion API",
        "database": ACTIVE_DB_TYPE,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/telemetry/latest", response_model=TelemetryOut)
@app.get("/telemetry/latest", response_model=TelemetryOut)
def get_latest_telemetry():
    db = SessionLocal()
    try:
        latest = db.query(TelemetryRecord).order_by(desc(TelemetryRecord.timestamp)).first()
        if latest:
            return make_telemetry_out(latest)
        # Default baseline if DB is empty
        dummy = TelemetryRecord(
            timestamp=datetime.utcnow(),
            device_id="ESP32_JALRAKSHAK_01",
            turbidity_ntu=2.1,
            tds_ppm=142.0,
            temp_c=24.5,
            wqi=96.4,
            state="NORMAL",
            contaminant_signature="Baseline / Quiescent Nominal",
        )
        return make_telemetry_out(dummy)
    finally:
        db.close()


@app.get("/api/telemetry/history", response_model=List[TelemetryOut])
@app.get("/telemetry/history", response_model=List[TelemetryOut])
def get_telemetry_history(limit: int = 50):
    db = SessionLocal()
    try:
        records = (
            db.query(TelemetryRecord)
            .order_by(desc(TelemetryRecord.timestamp))
            .limit(limit)
            .all()
        )
        if not records:
            dummy = TelemetryRecord(
                timestamp=datetime.utcnow(),
                device_id="ESP32_JALRAKSHAK_01",
                turbidity_ntu=2.1,
                tds_ppm=142.0,
                temp_c=24.5,
                wqi=96.4,
                state="NORMAL",
                contaminant_signature="Baseline / Quiescent Nominal",
            )
            return [make_telemetry_out(dummy)]
        ordered = list(reversed(records))
        return [make_telemetry_out(r) for r in ordered]
    finally:
        db.close()


@app.post("/api/telemetry", response_model=TelemetryOut, dependencies=[Depends(verify_device_key)])
@app.post("/telemetry", response_model=TelemetryOut, dependencies=[Depends(verify_device_key)])
def ingest_telemetry(data: TelemetryIn):
    wqi, state, signature = calculate_wqi_and_signature(data.turbidity_ntu, data.tds_ppm, data.temp_c)
    now = datetime.utcnow()

    record = TelemetryRecord(
        timestamp=now,
        device_id=data.device_id,
        turbidity_ntu=data.turbidity_ntu,
        tds_ppm=data.tds_ppm,
        temp_c=data.temp_c,
        wqi=wqi,
        state=state,
        contaminant_signature=signature,
    )

    db = SessionLocal()
    try:
        db.add(record)
        if state in ["WARNING", "ALARM"]:
            event = AnomalyEvent(
                timestamp=now,
                device_id=data.device_id,
                wqi=wqi,
                state=state,
                contaminant_signature=signature,
                diagnostics=f"Turbidity: {data.turbidity_ntu} NTU, TDS: {data.tds_ppm} ppm, Temp: {data.temp_c} C",
            )
            db.add(event)
        db.commit()
        db.refresh(record)
    finally:
        db.close()

    result = make_telemetry_out(record)

    if state in ["WARNING", "ALARM"]:
        dispatch_telegram_alert(result)
    elif state == "NORMAL":
        global _last_telegram_alert_state, _alarm_acknowledged
        _last_telegram_alert_state = "NORMAL"
        _alarm_acknowledged = False

    return result


@app.post("/api/telemetry/acknowledge")
@app.post("/telemetry/acknowledge")
def acknowledge_alarm():
    global _alarm_acknowledged
    _alarm_acknowledged = True
    logger.info("Operator acknowledged alarm via Web UI. Buzzer mute armed for ESP32.")
    return {
        "status": "ok",
        "alarm_acknowledged": True,
        "message": "Alarm acknowledged. Hardware buzzer will be muted on next sync.",
    }


@app.post("/api/telemetry/reset-alarm")
@app.post("/telemetry/reset-alarm")
def reset_alarm_acknowledgment():
    global _alarm_acknowledged
    _alarm_acknowledged = False
    logger.info("Alarm acknowledge state manually reset.")
    return {
        "status": "ok",
        "alarm_acknowledged": False,
        "message": "Alarm acknowledge state reset.",
    }
