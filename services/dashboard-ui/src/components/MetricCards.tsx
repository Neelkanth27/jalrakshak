import React from 'react';
import { Eye, Zap, Thermometer } from 'lucide-react';
import { TelemetryData } from '../types';

interface MetricCardsProps {
  telemetry: TelemetryData;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ telemetry }) => {
  // Turbidity thresholds (BIS IS 10500: Desirable <= 1 NTU, Permissible <= 5 NTU)
  const turbPct = Math.min(100, Math.max(0, (telemetry.turbidity_ntu / 30.0) * 100));
  const getTurbStatus = () => {
    if (telemetry.turbidity_ntu <= 1.0) return { label: 'Desirable Baseline (IS 10500)', color: 'text-emerald-400', badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' };
    if (telemetry.turbidity_ntu <= 5.0) return { label: 'Permissible Limit (Potable)', color: 'text-teal-400', badge: 'bg-teal-950/60 text-teal-300 border-teal-500/40' };
    if (telemetry.turbidity_ntu <= 25.0) return { label: 'Moderate Sediment Intrusion', color: 'text-amber-400', badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40' };
    return { label: 'Severe Sediment Contamination', color: 'text-rose-400', badge: 'bg-rose-950/60 text-rose-300 border-rose-500/50' };
  };
  const turbStatus = getTurbStatus();

  // TDS thresholds (BIS IS 10500: Desirable <= 500 ppm, Permissible <= 2000 ppm)
  const tdsPct = Math.min(100, Math.max(0, (telemetry.tds_ppm / 1200.0) * 100));
  const getTdsStatus = () => {
    if (telemetry.tds_ppm <= 300) return { label: 'Low Mineral / Pristine', color: 'text-emerald-400', badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' };
    if (telemetry.tds_ppm <= 500) return { label: 'Desirable Mineral Content', color: 'text-teal-400', badge: 'bg-teal-950/60 text-teal-300 border-teal-500/40' };
    if (telemetry.tds_ppm <= 1000) return { label: 'Permissible Hard Water', color: 'text-amber-400', badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40' };
    return { label: 'Chemical / Saline Ingress', color: 'text-rose-400', badge: 'bg-rose-950/60 text-rose-300 border-rose-500/50' };
  };
  const tdsStatus = getTdsStatus();

  // Temp status (Benchmark 25.0 C)
  const tempDiff = Math.abs(telemetry.temp_c - 25.0);
  const tempPct = Math.min(100, Math.max(0, ((telemetry.temp_c - 10) / 40) * 100));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* 1. Turbidity Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/80 text-cyan-400">
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Optical Turbidity
              </span>
              <span className="text-[10px] text-slate-500 font-mono">SEN0189 • ADC1_CH6 (D34)</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-semibold">
            Z: +{(telemetry.z_turb ?? 0).toFixed(2)}σ
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.turbidity_ntu.toFixed(1)}
          </span>
          <span className="text-sm font-bold text-slate-400 font-mono">NTU</span>
        </div>

        {/* Visual Threshold Gauge Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                telemetry.turbidity_ntu > 5.0 ? 'bg-rose-500' : telemetry.turbidity_ntu > 1.0 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${turbPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0 NTU</span>
            <span>Desirable: 1.0</span>
            <span>Permissible: 5.0</span>
            <span>30+ NTU</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">BIS IS 10500 Verdict:</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${turbStatus.badge}`}>
            {turbStatus.label}
          </span>
        </div>
      </div>

      {/* 2. TDS / Conductivity Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-950/60 border border-blue-800/80 text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Total Dissolved Solids
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Analog TDS • ADC1_CH7 (D35)</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-semibold">
            Z: +{(telemetry.z_tds ?? 0).toFixed(2)}σ
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.tds_ppm.toFixed(1)}
          </span>
          <span className="text-sm font-bold text-slate-400 font-mono">ppm (mg/L)</span>
        </div>

        {/* Visual Threshold Gauge Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                telemetry.tds_ppm > 500 ? 'bg-rose-500' : telemetry.tds_ppm > 300 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${tdsPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0 ppm</span>
            <span>Target: 300</span>
            <span>Limit: 500</span>
            <span>1200+</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Saline Matrix:</span>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${tdsStatus.badge}`}>
            {tdsStatus.label}
          </span>
        </div>
      </div>

      {/* 3. Fluid Temperature Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-950/60 border border-teal-800/80 text-teal-400">
              <Thermometer className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Fluid Temperature
              </span>
              <span className="text-[10px] text-slate-500 font-mono">DS18B20 • 1-Wire Digital (D4)</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-semibold">
            Z: +{(telemetry.z_temp ?? 0).toFixed(2)}σ
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.temp_c.toFixed(1)}
          </span>
          <span className="text-sm font-bold text-slate-400 font-mono">°C</span>
        </div>

        {/* Visual Threshold Gauge Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 ${
                tempDiff > 5.0 ? 'bg-amber-400' : 'bg-teal-400'
              }`}
              style={{ width: `${tempPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>10 °C</span>
            <span>Benchmark: 25.0 °C (EC25)</span>
            <span>50 °C</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Thermal State:</span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 border border-teal-500/40">
            {tempDiff > 3.0 ? `Deviation: ±${tempDiff.toFixed(1)} °C` : 'Nominal Ambient Quiescent'}
          </span>
        </div>
      </div>
    </div>
  );
};
