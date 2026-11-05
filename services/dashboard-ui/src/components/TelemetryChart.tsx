import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryChartProps {
  history: TelemetryData[];
}

type MetricMode = 'WQI' | 'TURBIDITY' | 'TDS' | 'TEMP';

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ history }) => {
  const [mode, setMode] = useState<MetricMode>('WQI');

  // If only 1 sample exists, duplicate to draw a baseline line
  const displayHistory = history.length === 1 ? [history[0], history[0]] : history;
  const recentSlice = displayHistory.slice(-30);

  // Extract values based on selected mode
  const getValues = (): { vals: number[]; unit: string; maxLimit: number; thresholdLabel: string; thresholdVal: number; strokeColor: string; fillColor: string } => {
    switch (mode) {
      case 'TURBIDITY':
        return {
          vals: recentSlice.map((d) => d.turbidity_ntu),
          unit: 'NTU',
          maxLimit: 30,
          thresholdLabel: 'BIS Limit (5.0 NTU)',
          thresholdVal: 5.0,
          strokeColor: '#06b6d4', // cyan-500
          fillColor: 'rgba(6, 182, 212, 0.1)',
        };
      case 'TDS':
        return {
          vals: recentSlice.map((d) => d.tds_ppm),
          unit: 'ppm',
          maxLimit: 1000,
          thresholdLabel: 'BIS Limit (500 ppm)',
          thresholdVal: 500,
          strokeColor: '#3b82f6', // blue-500
          fillColor: 'rgba(59, 130, 246, 0.1)',
        };
      case 'TEMP':
        return {
          vals: recentSlice.map((d) => d.temp_c),
          unit: '°C',
          maxLimit: 40,
          thresholdLabel: 'Benchmark (25.0 °C)',
          thresholdVal: 25.0,
          strokeColor: '#14b8a6', // teal-500
          fillColor: 'rgba(20, 184, 166, 0.1)',
        };
      case 'WQI':
      default:
        return {
          vals: recentSlice.map((d) => d.wqi),
          unit: 'WQI',
          maxLimit: 100,
          thresholdLabel: 'Permissible Baseline (75 WQI)',
          thresholdVal: 75.0,
          strokeColor: '#10b981', // emerald-500
          fillColor: 'rgba(16, 185, 129, 0.1)',
        };
    }
  };

  const config = getValues();
  const rawValues = config.vals;

  // Statistics calculation
  const currentVal = rawValues.length > 0 ? rawValues[rawValues.length - 1] : 0;
  const minVal = rawValues.length > 0 ? Math.min(...rawValues) : 0;
  const maxVal = rawValues.length > 0 ? Math.max(...rawValues) : 0;
  const meanVal = rawValues.length > 0 ? rawValues.reduce((a, b) => a + b, 0) / rawValues.length : 0;

  // Chart layout dimensions
  const height = 150;
  const width = 600;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 25;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  // Coordinate mapper
  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(config.maxLimit, val));
    return paddingTop + (1 - clamped / config.maxLimit) * plotHeight;
  };

  const points = rawValues.map((v, index, arr) => {
    const x = paddingLeft + (arr.length > 1 ? (index / (arr.length - 1)) * plotWidth : 0);
    const y = getY(v);
    return `${x},${y}`;
  });

  const pathLine = `M ${points.join(' L ')}`;
  const pathArea = points.length > 0
    ? `M ${points[0].split(',')[0]},${paddingTop + plotHeight} L ${points.join(' L ')} L ${points[points.length - 1].split(',')[0]},${paddingTop + plotHeight} Z`
    : '';

  const thresholdY = getY(config.thresholdVal);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
      {/* Header & Parameter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Real-Time Parameter Trend Analyzer
          </h3>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-xs">
          {(['WQI', 'TURBIDITY', 'TDS', 'TEMP'] as MetricMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                mode === m
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Engineering Stats Ribbon */}
      <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs py-1">
        <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">CURRENT</span>
          <span className="font-bold text-white">{currentVal.toFixed(1)} {config.unit}</span>
        </div>
        <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">ROLLING MEAN</span>
          <span className="font-bold text-slate-300">{meanVal.toFixed(1)} {config.unit}</span>
        </div>
        <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">PEAK (MAX)</span>
          <span className="font-bold text-rose-400">{maxVal.toFixed(1)} {config.unit}</span>
        </div>
        <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
          <span className="text-[10px] text-slate-500 block">TROUGH (MIN)</span>
          <span className="font-bold text-emerald-400">{minVal.toFixed(1)} {config.unit}</span>
        </div>
      </div>

      {/* SVG Chart Plot */}
      <div className="w-full overflow-hidden pt-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
          {/* Y-Axis Reference Labels */}
          <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
            {config.maxLimit}
          </text>
          <text x={paddingLeft - 8} y={paddingTop + plotHeight / 2 + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
            {(config.maxLimit / 2).toFixed(0)}
          </text>
          <text x={paddingLeft - 8} y={paddingTop + plotHeight + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">
            0
          </text>

          {/* Grid lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={paddingTop + plotHeight / 2} x2={width - paddingRight} y2={paddingTop + plotHeight / 2} stroke="#1e293b" strokeDasharray="3 3" />
          <line x1={paddingLeft} y1={paddingTop + plotHeight} x2={width - paddingRight} y2={paddingTop + plotHeight} stroke="#1e293b" />
          <line x1={paddingLeft} y1={paddingTop - 4} x2={paddingLeft} y2={paddingTop + plotHeight} stroke="#1e293b" />

          {/* BIS / Safety Reference Threshold Line */}
          {config.thresholdVal > 0 && (
            <g>
              <line
                x1={paddingLeft}
                y1={thresholdY}
                x2={width - paddingRight}
                y2={thresholdY}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text x={width - paddingRight} y={thresholdY - 3} textAnchor="end" fill="#f59e0b" fontSize="9" fontFamily="monospace">
                {config.thresholdLabel}
              </text>
            </g>
          )}

          {/* Shaded Area Fill */}
          {pathArea && <path d={pathArea} fill={config.fillColor} />}

          {/* Trend Line Path */}
          {pathLine && (
            <path
              d={pathLine}
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Current Live Point */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].split(',')[0]}
              cy={points[points.length - 1].split(',')[1]}
              r="4.5"
              fill={config.strokeColor}
              stroke="#0f172a"
              strokeWidth="2"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
