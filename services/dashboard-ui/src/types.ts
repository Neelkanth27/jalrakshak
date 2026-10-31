export type SystemState = 'NORMAL' | 'WARNING' | 'HIGH ANOMALY' | 'HARDWARE FAULT';

export interface TelemetryData {
  turbidity_ntu: number;
  tds_ppm: number;
  temp_c: number;
  z_turb: number;
  z_tds: number;
  z_temp: number;
  anomaly_score: number;
  state: SystemState;
  device_id: string;
  wqi: number;
  wqi_grade: string;
  contaminant_signature: string;
  received_at: string;
}
