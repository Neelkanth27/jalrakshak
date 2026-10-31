import React from 'react';
import { TrendingUp } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryChartProps {
  history: TelemetryData[];
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ history }) => {
  // If only 1 sample exists, project a steady baseline line across the chart
  const displayHistory = history.length === 1 ? [history[0], history[0]] : history;

  // Draw SVG sparkline for WQI
  const height = 140;
  const width = 600;
  const padding = 20;

  const points = displayHistory.slice(-25).map((item, index, arr) => {
    const x = padding + (index / (arr.length - 1)) * (width - 2 * padding);
    const y = height - padding - (item.wqi / 100) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
            Real-Time Water Quality Index (WQI) Trend
          </h3>
        </div>
        <span className="text-xs font-mono text-gray-500">Live Window: Last {Math.min(25, history.length)} Samples</span>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36">
          {/* Subtle Grid Lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#1f2937" strokeDasharray="4 4" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#1f2937" strokeDasharray="4 4" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1f2937" />

          {/* Reference labels */}
          <text x={padding + 4} y={padding + 12} fill="#6b7280" fontSize="10" fontFamily="monospace">100 (Pristine)</text>
          <text x={padding + 4} y={height / 2 - 4} fill="#6b7280" fontSize="10" fontFamily="monospace">50 (Caution)</text>
          <text x={padding + 4} y={height - padding - 4} fill="#6b7280" fontSize="10" fontFamily="monospace">0 (Anomaly)</text>

          {/* WQI Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest Point Pulsing Dot */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].split(',')[0]}
              cy={points[points.length - 1].split(',')[1]}
              r="5"
              fill="#22d3ee"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
