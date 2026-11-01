"""JalRakshak Serverless Cloud API (Vercel + Neon Postgres).

Features:
- Telemetry Ingestion (POST /api/telemetry) with X-Device-Key security header
- 0-100 Water Quality Index (WQI) computation & Smart Contaminant Classifier
- Telemetry History (GET /api/telemetry/history) from Neon Postgres
- Telegram Alert Dispatcher via HTTP REST (no long-running background worker required)
"""

import os
import json
import logging
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
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "").strip()

RAW_DB_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:///./jalrakshak_cloud.db"
if RAW_DB_URL.startswith("postgres://"):
    DATABASE_URL = RAW_DB_URL.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = RAW_DB_URL

# SQLAlchemy Setup
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
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


# Auto-create tables on import
Base.metadata.create_all(bind=engine)


# Pydantic Schemas
class TelemetryIn(BaseModel):
    device_id: str = "ESP32_JALRAKSHAK_01"
    turbidity_ntu: float = Field(..., ge=0.0, description="Optical Turbidity in NTU")
    tds_ppm: float = Field(..., ge=0.0, description="TDS in ppm (EC25 compensated)")
    temp_c: float = Field(..., ge=-10.0, le=100.0, description="Temperature in Celsius")
    state: Optional[str] = "NORMAL"


class TelemetryOut(BaseModel):
    timestamp: str
    device_id: str
    turbidity_ntu: float
    tds_ppm: float
    temp_c: float
    wqi: float
    state: str
    contaminant_signature: str

    class Config:
        from_attributes = True


# Smart WQI & Contaminant Classification Logic
def calculate_wqi_and_signature(turbidity: float, tds: float, temp: float):
    """Computes composite 0-100 WQI and classifies contaminant signature."""
    # Quiescent baseline expectations
    # Turbidity nominal: ~2.0 NTU, limit: 15.0 NTU
    # TDS nominal: ~150 ppm, limit: 500 ppm
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


# Telegram Dispatch Helper
def dispatch_telegram_alert(out: TelemetryOut):
    """Sends a rich instant Telegram alert if bot credentials are configured."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    emoji = "🚨" if out.state == "ALARM" else "⚠️"
    msg = (
        f"{emoji} *JALRAKSHAK CLOUD ALERT: {out.state}*\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"⏱ *Timestamp:* `{out.timestamp}` (UTC)\n"
        f"📊 *Water Quality Index (WQI):* `{out.wqi} / 100`\n"
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
        "database": "Neon Postgres" if "postgres" in DATABASE_URL else "SQLite",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/telemetry/latest", response_model=TelemetryOut)
@app.get("/telemetry/latest", response_model=TelemetryOut)
def get_latest_telemetry():
    db = SessionLocal()
    try:
        latest = db.query(TelemetryRecord).order_by(desc(TelemetryRecord.timestamp)).first()
        if latest:
            return TelemetryOut(
                timestamp=latest.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                device_id=latest.device_id,
                turbidity_ntu=latest.turbidity_ntu,
                tds_ppm=latest.tds_ppm,
                temp_c=latest.temp_c,
                wqi=latest.wqi,
                state=latest.state,
                contaminant_signature=latest.contaminant_signature or "Baseline / Quiescent Nominal",
            )
        # Default baseline if DB is empty
        return TelemetryOut(
            timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            device_id="ESP32_JALRAKSHAK_01",
            turbidity_ntu=2.1,
            tds_ppm=142.0,
            temp_c=24.5,
            wqi=96.4,
            state="NORMAL",
            contaminant_signature="Baseline / Quiescent Nominal",
        )
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
            # Return baseline if no records in DB yet
            return [
                TelemetryOut(
                    timestamp=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                    device_id="ESP32_JALRAKSHAK_01",
                    turbidity_ntu=2.1,
                    tds_ppm=142.0,
                    temp_c=24.5,
                    wqi=96.4,
                    state="NORMAL",
                    contaminant_signature="Baseline / Quiescent Nominal",
                )
            ]
        # Return in ascending order for trend graph plotting
        ordered = list(reversed(records))
        return [
            TelemetryOut(
                timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                device_id=r.device_id,
                turbidity_ntu=r.turbidity_ntu,
                tds_ppm=r.tds_ppm,
                temp_c=r.temp_c,
                wqi=r.wqi,
                state=r.state,
                contaminant_signature=r.contaminant_signature or "Baseline / Quiescent Nominal",
            )
            for r in ordered
        ]
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
    finally:
        db.close()

    result = TelemetryOut(
        timestamp=now.strftime("%Y-%m-%d %H:%M:%S"),
        device_id=data.device_id,
        turbidity_ntu=data.turbidity_ntu,
        tds_ppm=data.tds_ppm,
        temp_c=data.temp_c,
        wqi=wqi,
        state=state,
        contaminant_signature=signature,
    )

    if state in ["WARNING", "ALARM"]:
        dispatch_telegram_alert(result)

    return result
