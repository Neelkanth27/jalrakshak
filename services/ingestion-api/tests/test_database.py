"""Unit tests for the Database Persistence Layer."""

from datetime import datetime
from app.database import Base, SessionLocal, TelemetryRecord, AnomalyEventRecord, engine


def setup_module():
    Base.metadata.create_all(bind=engine)


def test_telemetry_record_crud():
    db = SessionLocal()
    sample = TelemetryRecord(
        device_id="test-edge-node",
        timestamp=datetime.utcnow(),
        turbidity_ntu=7.5,
        tds_ppm=190.0,
        temp_c=24.6,
        z_turb=0.2,
        z_tds=0.3,
        z_temp=0.1,
        anomaly_score=0.4,
        state="NORMAL",
        wqi=90.0,
        wqi_grade="Grade A (Pristine)",
        contaminant_signature="Baseline Stable",
    )
    db.add(sample)
    db.commit()

    retrieved = db.query(TelemetryRecord).filter_by(device_id="test-edge-node").first()
    assert retrieved is not None
    assert retrieved.turbidity_ntu == 7.5
    assert retrieved.wqi == 90.0
    db.close()


def test_anomaly_event_audit():
    db = SessionLocal()
    event = AnomalyEventRecord(
        id="test-event-uuid-001",
        timestamp=datetime.utcnow(),
        device_id="test-edge-node",
        previous_state="NORMAL",
        current_state="WARNING",
        anomaly_score=2.8,
        wqi=30.0,
        contaminant_signature="Sediment / Silt Intrusion",
    )
    db.add(event)
    db.commit()

    retrieved_event = db.query(AnomalyEventRecord).filter_by(id="test-event-uuid-001").first()
    assert retrieved_event is not None
    assert retrieved_event.current_state == "WARNING"
    db.close()
