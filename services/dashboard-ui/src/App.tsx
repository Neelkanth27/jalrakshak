import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DiagnosisBanner } from './components/DiagnosisBanner';
import { HistoryTable } from './components/HistoryTable';
import { WqiGauge } from './components/WqiGauge';
import { MetricCards } from './components/MetricCards';
import { TelemetryChart } from './components/TelemetryChart';
import { TelegramModal } from './components/TelegramModal';
import { generateInspectionCertificate } from './utils/pdfGenerator';
import { TelemetryData } from './types';

const INITIAL_TELEMETRY: TelemetryData = {
  turbidity_ntu: 1.8,
  tds_ppm: 195.0,
  temp_c: 24.8,
  z_turb: 0.1,
  z_tds: 0.2,
  z_temp: 0.1,
  anomaly_score: 0.22,
  state: 'NORMAL',
  device_id: 'ESP32_JALRAKSHAK_01',
  wqi: 94.5,
  wqi_grade: 'Grade A (Pristine Baseline)',
  contaminant_signature: 'Nominal Quiescent Baseline',
  received_at: new Date().toISOString(),
};

// Defensive normalizer to guarantee zero runtime crashes from partial API payloads
const normalizeTelemetry = (raw: any): TelemetryData => {
  if (!raw) return INITIAL_TELEMETRY;
  const turb = typeof raw.turbidity_ntu === 'number' ? raw.turbidity_ntu : 2.0;
  const tds = typeof raw.tds_ppm === 'number' ? raw.tds_ppm : 150.0;
  const temp = typeof raw.temp_c === 'number' ? raw.temp_c : 25.0;
  const wqi = typeof raw.wqi === 'number' ? raw.wqi : 95.0;

  let state = raw.state || 'NORMAL';
  if (state === 'ALARM') state = 'HIGH ANOMALY';

  let wqi_grade = raw.wqi_grade;
  if (!wqi_grade) {
    if (wqi >= 90) wqi_grade = 'Grade A (Pristine Baseline)';
    else if (wqi >= 75) wqi_grade = 'Grade B (Nominal Quiescent)';
    else if (wqi >= 50) wqi_grade = 'Grade C (Caution / Degrading)';
    else wqi_grade = 'Grade D (Critical Anomaly)';
  }

  // Derive Z-scores if not explicitly provided
  const z_turb = typeof raw.z_turb === 'number' ? raw.z_turb : Math.max(0, (turb - 2.0) / 3.0);
  const z_tds = typeof raw.z_tds === 'number' ? raw.z_tds : Math.max(0, (tds - 150.0) / 50.0);
  const z_temp = typeof raw.z_temp === 'number' ? raw.z_temp : Math.max(0, (temp - 25.0) / 2.0);
  const anomaly_score = typeof raw.anomaly_score === 'number' ? raw.anomaly_score : Math.sqrt(z_turb**2 + z_tds**2);

  return {
    turbidity_ntu: turb,
    tds_ppm: tds,
    temp_c: temp,
    z_turb: Number(z_turb.toFixed(2)),
    z_tds: Number(z_tds.toFixed(2)),
    z_temp: Number(z_temp.toFixed(2)),
    anomaly_score: Number(anomaly_score.toFixed(2)),
    state: state as any,
    device_id: raw.device_id || 'ESP32_JALRAKSHAK_01',
    wqi: Number(wqi.toFixed(1)),
    wqi_grade: wqi_grade,
    contaminant_signature: raw.contaminant_signature || 'Nominal Quiescent Baseline',
    received_at: raw.received_at || raw.timestamp || new Date().toISOString(),
    alarm_acknowledged: Boolean(raw.alarm_acknowledged),
  };
};

export const App: React.FC = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [history, setHistory] = useState<TelemetryData[]>([INITIAL_TELEMETRY]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const getApiUrl = useCallback((path: string) => {
    const customApi = import.meta.env.VITE_API_URL;
    if (customApi) {
      return `${customApi.replace(/\/$/, '')}${path}`;
    }
    const apiHost = window.location.hostname || 'localhost';
    const isHttps = window.location.protocol === 'https:';
    if (isHttps) {
      return `/api${path}`;
    }
    return `http://${apiHost}:8000${path}`;
  }, []);

  const handleAcknowledgeAlarm = useCallback(() => {
    if (isMuted) {
      // Toggle back ON: Unmute / Re-arm Buzzer
      setIsMuted(false);
      fetch(getApiUrl('/telemetry/reset-alarm'), { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          console.log('Buzzer unmuted / re-armed:', data);
        })
        .catch((err) => {
          console.error('Failed to unmute buzzer:', err);
        });
    } else {
      // Toggle OFF: Mute / Acknowledge Buzzer
      setIsMuted(true);
      fetch(getApiUrl('/telemetry/acknowledge'), { method: 'POST' })
        .then((res) => res.json())
        .then((data) => {
          console.log('Alarm acknowledged / muted:', data);
        })
        .catch((err) => {
          console.error('Failed to acknowledge alarm:', err);
        });
    }
  }, [isMuted, getApiUrl]);

  const getWsUrl = useCallback(() => {
    const customWs = import.meta.env.VITE_WS_URL;
    if (customWs) return customWs;
    const apiHost = window.location.hostname || 'localhost';
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${apiHost}:8000/ws/telemetry`;
  }, []);

  const fetchHistory = useCallback(() => {
    fetch(getApiUrl('/telemetry/history'))
      .then((res) => {
        if (res.ok) {
          setIsConnected(true);
          return res.json();
        }
        throw new Error('Cloud API returned non-200 status');
      })
      .then((data: any[]) => {
        if (data && data.length > 0) {
          const normalized = data.map(normalizeTelemetry);
          setHistory(normalized);
          const latest = normalized[normalized.length - 1];
          setTelemetry(latest);
          if (latest.alarm_acknowledged !== undefined) {
            setIsMuted(latest.alarm_acknowledged);
          }
        }
      })
      .catch(() => {
        if (window.location.protocol === 'https:') {
          setIsConnected(false);
        }
        console.log('Waiting for telemetry stream...');
      });
  }, [getApiUrl]);

  const handleExportCsv = useCallback(() => {
    if (!history || history.length === 0) return;
    const headers = [
      'Timestamp (ISO)',
      'Device ID',
      'Water Quality Index (WQI)',
      'Grade',
      'Operational State',
      'Turbidity (NTU)',
      'TDS (ppm)',
      'Temperature (C)',
      'Anomaly Score (S_comp)',
      'Contaminant Diagnosis',
    ];

    const rows = history.map((r) => [
      `"${r.received_at}"`,
      `"${r.device_id}"`,
      r.wqi,
      `"${r.wqi_grade}"`,
      `"${r.state}"`,
      r.turbidity_ntu,
      r.tds_ppm,
      r.temp_c,
      r.anomaly_score,
      `"${(r.contaminant_signature || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `jalrakshak_telemetry_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [history]);

  useEffect(() => {
    fetchHistory();

    const wsUrl = getWsUrl();
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pollingInterval: ReturnType<typeof setInterval>;

    const connectWebSocket = () => {
      if (window.location.protocol === 'https:' && !import.meta.env.VITE_WS_URL) {
        return;
      }

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          console.log('Connected to JalRakshak Telemetry WebSocket stream.');
        };

        ws.onmessage = (event) => {
          try {
            const raw = JSON.parse(event.data);
            const freshData: TelemetryData = normalizeTelemetry(raw);
            setTelemetry(freshData);
            setHistory((prev: TelemetryData[]) => [...prev.slice(-49), freshData]);
          } catch (e) {
            console.error('Failed to parse WebSocket telemetry packet:', e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimer = setTimeout(connectWebSocket, 4000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 4000);
      }
    };

    connectWebSocket();

    pollingInterval = setInterval(() => {
      fetchHistory();
    }, 3000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(pollingInterval);
      if (ws) ws.close();
    };
  }, [fetchHistory, getWsUrl]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* SCADA Station Top Header */}
      <Header
        state={telemetry.state}
        isConnected={isConnected}
        isMuted={isMuted || telemetry.alarm_acknowledged}
        onToggleMute={handleAcknowledgeAlarm}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
        onExportReport={() => generateInspectionCertificate(telemetry)}
        onExportCsv={handleExportCsv}
      />

      {/* Main SCADA Telemetry Console */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Top: Contaminant Diagnosis & Regulatory Compliance Banner */}
        <DiagnosisBanner
          signature={telemetry.contaminant_signature}
          state={telemetry.state}
          isMuted={isMuted || telemetry.alarm_acknowledged}
          onAcknowledgeAlarm={handleAcknowledgeAlarm}
        />

        {/* Analytics Grid: Industrial WQI Dial + Parameter Trend Analyzer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <WqiGauge
              wqi={telemetry.wqi}
              grade={telemetry.wqi_grade}
              anomalyScore={telemetry.anomaly_score}
              zTurb={telemetry.z_turb}
              zTds={telemetry.z_tds}
              zTemp={telemetry.z_temp}
            />
          </div>
          <div className="lg:col-span-2">
            <TelemetryChart history={history} />
          </div>
        </div>

        {/* Physical Sensor Instrumentation Telemetry Cards */}
        <MetricCards telemetry={telemetry} />

        {/* Historical Telemetry & Audit Trail Log */}
        <HistoryTable
          history={history}
          onRefresh={fetchHistory}
          onExportCsv={handleExportCsv}
        />
      </main>

      {/* Incident Alert Dispatcher Modal (Clean, Zero-QR) */}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* Industrial SCADA Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-3.5 px-6 text-center text-xs text-slate-500 font-mono">
        JALRAKSHAK SCADA TELEMETRY • STATION: STN-MH-PUNE-01 • CONTROLLER: ESP32-WROOM-32 (FreeRTOS) • COMPLIANCE: BIS IS 10500:2012
      </footer>
    </div>
  );
};
