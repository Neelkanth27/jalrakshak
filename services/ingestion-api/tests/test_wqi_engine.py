"""Unit tests for Water Quality Index (WQI) calculation and Contaminant Fingerprinting."""

import pytest
from app.schemas import SystemState, TelemetryIn
from app.wqi_engine import calculate_wqi, diagnose_contaminant_signature


def test_wqi_calculation_bounds():
    # Pristine water: Anomaly score = 0.0 -> WQI = 100.0, Grade A
    wqi_0, grade_0 = calculate_wqi(0.0)
    assert wqi_0 == 100.0
    assert "Grade A" in grade_0

    # Mild deviation: Anomaly score = 1.0 -> WQI = 75.0, Grade B
    wqi_1, grade_1 = calculate_wqi(1.0)
    assert wqi_1 == 75.0
    assert "Grade B" in grade_1

    # Warning threshold: Anomaly score = 2.0 -> WQI = 50.0, Grade C
    wqi_2, grade_2 = calculate_wqi(2.0)
    assert wqi_2 == 50.0
    assert "Grade C" in grade_2

    # High Anomaly: Anomaly score = 3.5 -> WQI = 12.5, Grade D
    wqi_3, grade_3 = calculate_wqi(3.5)
    assert wqi_3 == 12.5
    assert "Grade D" in grade_3

    # Clamping at zero: Anomaly score = 5.0 -> WQI = 0.0
    wqi_max, grade_max = calculate_wqi(5.0)
    assert wqi_max == 0.0
    assert "Grade D" in grade_max


def test_contaminant_signature_diagnosis():
    # Scenario 1: Clean Baseline
    clean_sample = TelemetryIn(
        turbidity_ntu=8.0,
        tds_ppm=180.0,
        temp_c=24.5,
        z_turb=0.2,
        z_tds=0.3,
        z_temp=0.1,
        anomaly_score=0.4,
        state=SystemState.NORMAL,
    )
    assert "Baseline Stable" in diagnose_contaminant_signature(clean_sample)

    # Scenario 2: Silt / Pipe Rust (Turbidity spike only)
    silt_sample = TelemetryIn(
        turbidity_ntu=180.0,
        tds_ppm=185.0,
        temp_c=24.5,
        z_turb=3.4,
        z_tds=0.4,
        z_temp=0.1,
        anomaly_score=2.2,
        state=SystemState.WARNING,
    )
    assert "Sediment / Pipe Erosion" in diagnose_contaminant_signature(silt_sample)

    # Scenario 3: Chemical / Saline Infiltration (TDS spike only)
    saline_sample = TelemetryIn(
        turbidity_ntu=9.0,
        tds_ppm=850.0,
        temp_c=24.5,
        z_turb=0.3,
        z_tds=4.1,
        z_temp=0.2,
        anomaly_score=2.8,
        state=SystemState.WARNING,
    )
    assert "Chemical / Saline Infiltration" in diagnose_contaminant_signature(saline_sample)

    # Scenario 4: Severe Surface Runoff / Sludge (Both high)
    runoff_sample = TelemetryIn(
        turbidity_ntu=250.0,
        tds_ppm=920.0,
        temp_c=25.0,
        z_turb=4.2,
        z_tds=4.5,
        z_temp=0.5,
        anomaly_score=3.8,
        state=SystemState.HIGH_ANOMALY,
    )
    assert "Severe Surface Runoff" in diagnose_contaminant_signature(runoff_sample)

    # Scenario 5: Hardware Disconnect Fault
    fault_sample = TelemetryIn(
        turbidity_ntu=0.0,
        tds_ppm=0.0,
        temp_c=-127.0,
        z_turb=9.9,
        z_tds=9.9,
        z_temp=9.9,
        anomaly_score=9.9,
        state=SystemState.HARDWARE_FAULT,
    )
    assert "HARDWARE FAULT" in diagnose_contaminant_signature(fault_sample)
