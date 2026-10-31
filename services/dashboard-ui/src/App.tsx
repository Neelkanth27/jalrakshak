import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WqiGauge } from './components/WqiGauge';
import { DiagnosisBanner } from './components/DiagnosisBanner';
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

export const App: React.FC = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [history, setHistory] = useState<TelemetryData[]>([INITIAL_TELEMETRY]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);

  // Setup WebSocket connection to backend
  useEffect(() => {
    const apiHost = window.location.hostname || 'localhost';
    const wsUrl = `ws://${apiHost}:8000/ws/telemetry`;
    const httpUrl = `http://${apiHost}:8000/telemetry`;

    // Initial HTTP fetch: load rolling telemetry history from backend
    fetch(`${httpUrl}/history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TelemetryData[]) => {
        if (data && data.length > 0) {
          setHistory(data);
          setTelemetry(data[data.length - 1]);
        }
      })
      .catch(() => console.log('Waiting for initial telemetry stream...'));

    // WebSocket listener
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connectWebSocket = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to JalRakshak Telemetry WebSocket stream.');
      };

      ws.onmessage = (event) => {
        try {
          const freshData: TelemetryData = JSON.parse(event.data);
          setTelemetry(freshData);
          setHistory((prev) => [...prev.slice(-30), freshData]);
        } catch (e) {
          console.error('Failed to parse WebSocket telemetry packet:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

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
        {/* Top Section: Smart Contaminant Diagnosis Banner */}
        <DiagnosisBanner signature={telemetry.contaminant_signature} state={telemetry.state} />

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
