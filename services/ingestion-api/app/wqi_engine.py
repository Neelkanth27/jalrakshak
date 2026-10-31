"""Water Quality Index (WQI) & Contaminant Fingerprint Analytics Engine.

Translates complex Euclidean Z-scores and multi-parametric deviations into
actionable, buyer-friendly metrics:
1. Unified 0-100 Water Quality Index (WQI)
2. Letter grade classification (A to D)
3. Probable contaminant signature diagnosis
"""

from typing import Tuple
from app.schemas import SystemState, TelemetryIn


def calculate_wqi(anomaly_score: float) -> Tuple[float, str]:
    """Computes an intuitive 0-100 Water Quality Index from S_composite.

    Formula:
        WQI = max(0.0, min(100.0, 100.0 - (S_composite * 25.0)))

    Grading Scale:
        90 - 100: Grade A (Pristine / Baseline)
        75 - 89 : Grade B (Acceptable / Nominal)
        50 - 74 : Grade C (Caution / Moderate Deviation)
        < 50    : Grade D (Critical Anomaly / High Contamination)
    """
    raw_wqi = 100.0 - (anomaly_score * 25.0)
    wqi = round(max(0.0, min(100.0, raw_wqi)), 1)

    if wqi >= 90.0:
        grade = "Grade A (Pristine Baseline)"
    elif wqi >= 75.0:
        grade = "Grade B (Nominal Conditions)"
    elif wqi >= 50.0:
        grade = "Grade C (Caution / Elevated Deviation)"
    else:
        grade = "Grade D (Critical Anomaly / Contaminated)"

    return wqi, grade


def diagnose_contaminant_signature(telemetry: TelemetryIn) -> str:
    """Diagnoses the probable cause of water quality degradation.

    Analyzes individual channel deviations (z_turb, z_tds, z_temp) when
    S_composite crosses threshold boundaries.
    """
    if telemetry.state == SystemState.HARDWARE_FAULT:
        return "HARDWARE FAULT: Sensor probe disconnected or ADC out-of-bounds."

    if telemetry.anomaly_score < 1.5 and telemetry.state == SystemState.NORMAL:
        return "Baseline Stable: Water parameters within normal quiescent bounds."

    # Significant anomaly: evaluate dominant deviation signatures
    z_turb = telemetry.z_turb
    z_tds = telemetry.z_tds
    z_temp = telemetry.z_temp

    # High turbidity + Normal TDS -> Suspended particulate matter
    if z_turb >= 2.0 and z_tds < 2.0:
        return "Sediment / Pipe Erosion Signature (High suspended solids, silt, or rust flakes)"

    # Normal turbidity + High TDS -> Dissolved ionic minerals / chemical salts
    if z_tds >= 2.0 and z_turb < 2.0:
        return "Chemical / Saline Infiltration (Dissolved salts, hard minerals, or fertilizer runoff)"

    # Both high -> Severe composite intrusion
    if z_turb >= 2.0 and z_tds >= 2.0:
        return "Severe Surface Runoff / Wastewater Influx (Sludge, untreated runoff, or biological loading)"

    # Extreme temperature deviation
    if z_temp >= 2.5:
        return "Thermal Anomaly (Coolant leakage, thermal shock, or industrial effluent)"

    return "Multi-Parametric Shift: Moderate concurrent variance across all channels"
