import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, AlertOctagon, Wrench, Send, FileDown } from 'lucide-react';
import { SystemState } from '../types';

interface HeaderProps {
  state: SystemState;
  isConnected: boolean;
  onOpenTelegram: () => void;
  onExportReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isConnected,
  onOpenTelegram,
  onExportReport,
}) => {
  const getStateBadge = () => {
    switch (state) {
      case 'NORMAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
          text: 'NORMAL (BASELINE STABLE)',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400 animate-pulse',
          icon: AlertTriangle,
          text: 'WARNING (PARAMETER DEVIATION)',
        };
      case 'HIGH ANOMALY':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-400 animate-ping',
          icon: AlertOctagon,
          text: 'CRITICAL WATER ANOMALY',
        };
      case 'HARDWARE FAULT':
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
          dot: 'bg-purple-400',
          icon: Wrench,
          text: 'HARDWARE / PROBE FAULT',
        };
    }
  };

  const badge = getStateBadge();
  const Icon = badge.icon;

  return (
    <header className="border-b border-gray-800 bg-[#0d1322]/80 backdrop-blur sticky top-0 z-40 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">JALRAKSHAK</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                EDGE-ESP32
              </span>
            </div>
            <p className="text-xs text-gray-400">Multi-Sensor Water Anomaly Detection & Telemetry</p>
          </div>
        </div>

        {/* State Badge & Actions */}
        <div className="flex items-center flex-wrap gap-3">
          {/* WebSocket Pulse */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs text-gray-300 font-mono">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
            {isConnected ? 'LIVE WS CONNECTED' : 'DISCONNECTED'}
          </div>

          {/* Operational State Badge */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-semibold tracking-wide ${badge.bg}`}>
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            <Icon className="h-4 w-4" />
            <span>{badge.text}</span>
          </div>

          {/* Connect Telegram Alerts Button */}
          <button
            onClick={onOpenTelegram}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium transition"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Phone Alerts</span>
          </button>

          {/* Export PDF Report Button */}
          <button
            onClick={onExportReport}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Export Certificate</span>
          </button>
        </div>
      </div>
    </header>
  );
};
