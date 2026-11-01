import React from 'react';
import { Eye, Zap, Thermometer } from 'lucide-react';
import { TelemetryData } from '../types';

interface MetricCardsProps {
  telemetry: TelemetryData;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ telemetry }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* 1. Turbidity Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-gray-400 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-400">
              <Eye className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">Turbidity (Clarity)</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-400">
            Z: {(telemetry.z_turb ?? 0).toFixed(2)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.turbidity_ntu.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-gray-400">NTU</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-800/80">
          <span>Target: &lt; 5.0 NTU (Potable)</span>
          <span className={telemetry.turbidity_ntu > 20 ? 'text-amber-400' : 'text-emerald-400'}>
            {telemetry.turbidity_ntu > 20 ? 'Elevated Silt' : 'Clean / Clear'}
          </span>
        </div>
      </div>

      {/* 2. TDS / Conductivity Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-gray-400 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">TDS / Minerals (EC25)</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-400">
            Z: {(telemetry.z_tds ?? 0).toFixed(2)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.tds_ppm.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-gray-400">ppm</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-800/80">
          <span>Target: 50 – 300 ppm</span>
          <span className={telemetry.tds_ppm > 500 ? 'text-rose-400' : 'text-emerald-400'}>
            {telemetry.tds_ppm > 500 ? 'High Salinity / Hard' : 'Nominal Minerals'}
          </span>
        </div>
      </div>

      {/* 3. Fluid Temperature Card */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between text-gray-400 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-950/60 border border-teal-800 text-teal-400">
              <Thermometer className="h-4 w-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">Water Temperature</span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-400">
            Z: {(telemetry.z_temp ?? 0).toFixed(2)}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight font-mono">
            {telemetry.temp_c.toFixed(1)}
          </span>
          <span className="text-sm font-semibold text-gray-400">°C</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-800/80">
          <span>Comp Benchmark: 25.0 °C</span>
          <span className="text-teal-400">Thermally Stable</span>
        </div>
      </div>
    </div>
  );
};
