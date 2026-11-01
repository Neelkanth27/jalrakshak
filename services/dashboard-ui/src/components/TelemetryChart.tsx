import React from 'react';
import { TrendingUp } from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryChartProps {
  history: TelemetryData[];
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ history }) => {
  // If only 1 sample exists, project a steady baseline line across the chart
  const displayHistory = history.length === 1 ? [history[0], history[0]] : history;

  // Chart layout dimensions with dedicated left gutter for labels
  const height = 150;
  const width = 600;
  const paddingLeft = 85; // Gutter for Y-axis text
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 25;

  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const y100 = paddingTop;
  const y50 = paddingTop + plotHeight / 2;
  const y0 = paddingTop + plotHeight;

  const points = displayHistory.slice(-25).map((item, index, arr) => {
    const x = paddingLeft + (arr.length > 1 ? (index / (arr.length - 1)) * plotWidth : 0);
    const wqi = typeof item.wqi === 'number' ? item.wqi : 95;
    const y = paddingTop + (1 - wqi / 100) * plotHeight;
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
          {/* Y-Axis Reference Labels (Placed in left gutter outside the plot area) */}
          <text x={paddingLeft - 8} y={y100 + 3.5} textAnchor="end" fill="#6b7280" fontSize="10" fontFamily="monospace">
            100 (Pristine)
          </text>
          <text x={paddingLeft - 8} y={y50 + 3.5} textAnchor="end" fill="#6b7280" fontSize="10" fontFamily="monospace">
            50 (Caution)
          </text>
          <text x={paddingLeft - 8} y={y0 + 3.5} textAnchor="end" fill="#6b7280" fontSize="10" fontFamily="monospace">
            0 (Anomaly)
          </text>

          {/* Grid lines strictly inside the plot area */}
          <line x1={paddingLeft} y1={y100} x2={width - paddingRight} y2={y100} stroke="#1f2937" strokeDasharray="4 4" />
          <line x1={paddingLeft} y1={y50} x2={width - paddingRight} y2={y50} stroke="#1f2937" strokeDasharray="4 4" />
          <line x1={paddingLeft} y1={y0} x2={width - paddingRight} y2={y0} stroke="#1f2937" />

          {/* Y-Axis vertical boundary line */}
          <line x1={paddingLeft} y1={paddingTop - 6} x2={paddingLeft} y2={y0} stroke="#1f2937" />

          {/* WQI Trend Line (Never overlaps labels) */}
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
