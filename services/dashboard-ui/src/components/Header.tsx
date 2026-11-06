import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Wrench, Send, FileDown, FileSpreadsheet, Server, Volume2, VolumeX } from 'lucide-react';
import { SystemState } from '../types';

interface HeaderProps {
  state: SystemState;
  isConnected: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenTelegram: () => void;
  onExportReport: () => void;
  onExportCsv: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  isConnected,
  isMuted,
  onToggleMute,
  onOpenTelegram,
  onExportReport,
  onExportCsv,
}) => {
  const isAlarm = state === 'HIGH ANOMALY' || (state as string) === 'ALARM';

  const getStateBadge = () => {
    if (!isConnected) {
      return {
        bg: 'bg-slate-800/80 border-slate-700 text-slate-400',
        dot: 'bg-rose-500 animate-pulse',
        icon: Server,
        text: 'NODE OFFLINE • UNPOWERED',
      };
    }
    switch (state) {
      case 'NORMAL':
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
          text: 'NORMAL • BIS COMPLIANT',
        };
      case 'WARNING':
        return {
          bg: 'bg-amber-950/60 border-amber-500/50 text-amber-300',
          dot: 'bg-amber-400 animate-pulse',
          icon: AlertTriangle,
          text: 'WARNING • PERMISSIBLE LIMIT EXCEEDED',
        };
      case 'HIGH ANOMALY':
      case 'ALARM' as any:
        return {
          bg: 'bg-rose-950/70 border-rose-500/60 text-rose-300',
          dot: 'bg-rose-400 animate-ping',
          icon: AlertOctagon,
          text: 'CRITICAL ANOMALY • NON-POTABLE',
        };
      case 'HARDWARE FAULT':
        return {
          bg: 'bg-purple-950/60 border-purple-500/40 text-purple-300',
          dot: 'bg-purple-400',
          icon: Wrench,
          text: 'INSTRUMENTATION FAULT',
        };
      default:
        return {
          bg: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
          text: 'NORMAL • BIS COMPLIANT',
        };
    }
  };

  const badge = getStateBadge();
  const Icon = badge.icon;

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3.5">
        {/* Brand & Technical Metadata */}
        <div className="flex items-center gap-3.5 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white font-mono">JALRAKSHAK</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  NODE-ESP32-01
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 hidden sm:inline">
                  BIS IS 10500:2012
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Continuous Multi-Parameter Water Quality SCADA Station</p>
            </div>
          </div>

          {/* Mobile Status Dot */}
          <div className="lg:hidden">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {state}
            </span>
          </div>
        </div>

        {/* State Indicators & Action Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-end">
          {/* Cloud Ingestion Pulse */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'}`} />
            <span>{isConnected ? 'LIVE INGESTION (3.0s)' : 'DISCONNECTED (OFFLINE)'}</span>
          </div>

          {/* Operational State Badge */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide ${badge.bg}`}>
            <span className={`h-2 w-2 rounded-full ${badge.dot}`} />
            <Icon className="h-4 w-4" />
            <span>{badge.text}</span>
          </div>

          {/* Buzzer Mute / Unmute Quick Toggle: Disabled during NORMAL & WARNING; Active during ALARM */}
          {onToggleMute && (
            <button
              onClick={isAlarm ? onToggleMute : undefined}
              disabled={!isAlarm}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition select-none ${
                !isAlarm
                  ? 'bg-slate-900/60 border-slate-800 text-slate-400 cursor-not-allowed opacity-75'
                  : isMuted
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900 cursor-pointer shadow-sm active:scale-95'
                  : 'bg-rose-600 hover:bg-rose-500 border-rose-400 text-white cursor-pointer shadow-md active:scale-95 animate-pulse'
              }`}
              title={
                !isAlarm
                  ? 'Siren is armed & in standby mode. Controls unlock during ALARM.'
                  : isMuted
                  ? 'Buzzer is currently muted. Click to turn buzzer back ON'
                  : 'Alarm is sounding! Click to acknowledge and silence buzzer'
              }
            >
              {isMuted ? (
                <Volume2 className={`h-3.5 w-3.5 ${isAlarm ? 'text-emerald-400' : 'text-slate-500'}`} />
              ) : (
                <VolumeX className={`h-3.5 w-3.5 ${isAlarm ? 'text-white' : 'text-slate-500'}`} />
              )}
              <span>
                {!isAlarm
                  ? isMuted
                    ? 'Siren Muted'
                    : 'Siren Armed'
                  : isMuted
                  ? 'Buzzer Muted (Turn ON)'
                  : 'Acknowledge & Mute Siren'}
              </span>
            </button>
          )}

          {/* Telegram Incident Alerts */}
          <button
            onClick={onOpenTelegram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            title="Configure Telegram Mobile Alert Dispatcher"
          >
            <Send className="h-3.5 w-3.5 text-sky-400" />
            <span>Alerts</span>
          </button>

          {/* Export CSV Data Button */}
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            title="Download full historical telemetry in CSV format"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Export PDF Audit Certificate */}
          <button
            onClick={onExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white border border-cyan-600 text-xs font-bold transition shadow-sm"
            title="Generate Signed PDF Inspection Certificate"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Inspection PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
