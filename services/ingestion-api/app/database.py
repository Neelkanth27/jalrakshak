"""PostgreSQL Database Layer for JalRakshak Telemetry & Anomaly Logging.

Engineered for 12-Factor App cloud portability:
- Supports Vercel Postgres / Neon via POSTGRES_URL
- Supports Standard PostgreSQL via DATABASE_URL
- Fallback to local SQLite when running standalone without external services
"""

import os
from datetime import datetime
from typing import List, Optional

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

# Detect database URL from environment (Vercel uses POSTGRES_URL)
RAW_DATABASE_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "sqlite:///./jalrakshak.db"

# SQLAlchemy 2.0 requires 'postgresql://' instead of legacy 'postgres://'
if RAW_DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = RAW_DATABASE_URL.replace("postgres://", "postgresql://", 1)
else:
    DATABASE_URL = RAW_DATABASE_URL

# Connect arguments for SQLite vs PostgreSQL
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class TelemetryRecord(Base):
    """Stores full time-series records of edge telemetry and computed scores."""
    __tablename__ = "telemetry_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(64), index=True, default="jalrakshak-edge-01")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Physical Sensor Measurements
    turbidity_ntu = Column(Float, nullable=False)
    tds_ppm = Column(Float, nullable=False)
    temp_c = Column(Float, nullable=False)

    # Edge Z-Scores
    z_turb = Column(Float, default=0.0)
    z_tds = Column(Float, default=0.0)
    z_temp = Column(Float, default=0.0)

    # Composite Analytics
    anomaly_score = Column(Float, nullable=False)
    state = Column(String(32), nullable=False, index=True)
    wqi = Column(Float, nullable=False)
    wqi_grade = Column(String(64), nullable=False)
    contaminant_signature = Column(Text, nullable=False)


class AnomalyEventRecord(Base):
    """Audit log of state transitions (NORMAL -> WARNING -> HIGH ANOMALY)."""
    __tablename__ = "anomaly_events"

    id = Column(String(64), primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    device_id = Column(String(64), index=True)
    previous_state = Column(String(32), nullable=False)
    current_state = Column(String(32), nullable=False)
    anomaly_score = Column(Float, nullable=False)
    wqi = Column(Float, nullable=False)
    contaminant_signature = Column(Text, nullable=False)


def init_db():
    """Idempotently initializes all database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
