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
  turbidity_ntu: 6.2,
  tds_ppm: 185.0,
  temp_c: 24.8,
  z_turb: 0.2,
  z_tds: 0.3,
  z_temp: 0.1,
  anomaly_score: 0.35,
  state: 'NORMAL',
  device_id: 'jalrakshak-edge-01',
  wqi: 91.2,
  wqi_grade: 'Grade A (Pristine Baseline)',
  contaminant_signature: 'Baseline Stable: Water parameters within normal quiescent bounds.',
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
    contaminant_signature: raw.contaminant_signature || 'Baseline Stable: Water parameters within nominal bounds.',
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
    // If on https (e.g. Vercel), route directly to serverless /api prefix
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

  // Setup WebSocket connection and initial history fetch
  useEffect(() => {
    fetchHistory();

    const wsUrl = getWsUrl();
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pollingInterval: ReturnType<typeof setInterval>;

    const connectWebSocket = () => {
      // In cloud HTTPS environments without WebSockets, rely on HTTP polling
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

    // Fallback periodic poll to ensure live updates across both HTTP and HTTPS cloud environments
    pollingInterval = setInterval(() => {
      fetchHistory();
    }, 4000);

    return () => {
      clearTimeout(reconnectTimer);
      clearInterval(pollingInterval);
      if (ws) ws.close();
    };
  }, [fetchHistory, getWsUrl]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        state={telemetry.state}
        isConnected={isConnected}
        onOpenTelegram={() => setIsTelegramModalOpen(true)}
        onExportReport={() => generateInspectionCertificate(telemetry)}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Top Section: Smart Contaminant Diagnosis Banner with Remote Mute Action */}
        <DiagnosisBanner
          signature={telemetry.contaminant_signature}
          state={telemetry.state}
          isMuted={isMuted || telemetry.alarm_acknowledged}
          onAcknowledgeAlarm={handleAcknowledgeAlarm}
        />

        {/* Core Analytics Grid: Circular WQI Gauge + Trend Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <WqiGauge
              wqi={telemetry.wqi}
              grade={telemetry.wqi_grade}
              anomalyScore={telemetry.anomaly_score}
            />
          </div>
          <div className="lg:col-span-2">
            <TelemetryChart history={history} />
          </div>
        </div>

        {/* Physical Sensor Metric Cards */}
        <MetricCards telemetry={telemetry} />

        {/* Historical Telemetry & Audit Log Table (Placed cleanly at the bottom) */}
        <HistoryTable history={history} onRefresh={fetchHistory} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 bg-[#070A12] py-4 text-center text-xs text-gray-500">
        JalRakshak Multi-Sensor Anomaly Detection System • Powered by ESP32 Edge Computing, Mosquitto MQTT & FastAPI
      </footer>

      {/* Telegram Connection QR Modal */}
      <TelegramModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />
    </div>
  );
};

export default App;
