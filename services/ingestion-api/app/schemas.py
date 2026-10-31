"""Pydantic Data Models for JalRakshak Telemetry & Anomaly Analysis.

Enforces strict type validation on incoming MQTT / REST payloads from
the ESP32 microcontroller edge node.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SystemState(str, Enum):
    NORMAL = "NORMAL"
    WARNING = "WARNING"
    HIGH_ANOMALY = "HIGH ANOMALY"
    HARDWARE_FAULT = "HARDWARE FAULT"


class TelemetryIn(BaseModel):
    """Raw telemetry payload transmitted by the ESP32 edge node."""
    turbidity_ntu: float = Field(..., description="Nephelometric Turbidity Units (0-3000)")
    tds_ppm: float = Field(..., description="Total Dissolved Solids in ppm (EC25 compensated)")
    temp_c: float = Field(..., description="Fluid temperature in Celsius")
    z_turb: float = Field(default=0.0, description="Normalized deviation Z-score for turbidity")
    z_tds: float = Field(default=0.0, description="Normalized deviation Z-score for TDS")
    z_temp: float = Field(default=0.0, description="Normalized deviation Z-score for temperature")
    anomaly_score: float = Field(..., description="Composite Euclidean anomaly score S_composite")
    state: SystemState = Field(..., description="Operational state evaluated on edge")
    device_id: str = Field(default="jalrakshak-edge-01", description="Identifier of the ESP32 device")


class TelemetryOut(TelemetryIn):
    """Enriched telemetry returned to dashboards and downstream services."""
    wqi: float = Field(..., description="Computed 0-100 Water Quality Index")
    wqi_grade: str = Field(..., description="Letter classification (Grade A, B, C, D)")
    contaminant_signature: str = Field(..., description="Probable cause diagnosis of the anomaly")
    received_at: datetime = Field(default_factory=datetime.utcnow, description="UTC ingest timestamp")


class AlertEvent(BaseModel):
    """Event dispatched to the alert worker and notification channels."""
    event_id: str
    timestamp: datetime
    device_id: str
    previous_state: SystemState
    current_state: SystemState
    anomaly_score: float
    wqi: float
    contaminant_signature: str
    turbidity_ntu: float
    tds_ppm: float
    temp_c: float
