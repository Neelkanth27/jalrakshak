import React from 'react';
import { Droplets, ShieldCheck, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

interface WqiGaugeProps {
  wqi: number;
  grade: string;
  anomalyScore: number;
  zTurb?: number;
  zTds?: number;
  zTemp?: number;
}

export const WqiGauge: React.FC<WqiGaugeProps> = ({
  wqi,
  grade,
  anomalyScore,
  zTurb = 0,
  zTds = 0,
  zTemp = 0,
}) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, wqi)) / 100) * circumference;

  const getMetricStyle = (score: number) => {
    if (score >= 90) {
      return {
        stroke: '#10b981',
        text: 'text-emerald-400',
        badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
        potability: 'POTABLE • SAFE FOR CONSUMPTION',
      };
    }
    if (score >= 75) {
      return {
        stroke: '#34d399',
        text: 'text-emerald-300',
        badge: 'bg-teal-950/60 text-teal-300 border-teal-500/40',
        potability: 'POTABLE • NOMINAL MUNICIPAL GRADE',
      };
    }
    if (score >= 50) {
      return {
        stroke: '#f59e0b',
        text: 'text-amber-400',
        badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
        potability: 'CAUTION • PRE-FILTRATION ADVISED',
      };
    }
    return {
      stroke: '#ef4444',
      text: 'text-rose-400',
      badge: 'bg-rose-950/60 text-rose-300 border-rose-500/50',
      potability: 'NON-POTABLE • HAZARDOUS WATER',
    };
  };

  const style = getMetricStyle(wqi);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm relative">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Water Quality Index (WQI)
          </h3>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
          CPCB / BIS Method
        </span>
      </div>

      {/* Dial Gauge */}
      <div className="relative flex items-center justify-center my-4">
        <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 180 180">
          {/* Background Track */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke="#1e293b"
            strokeWidth="12"
            fill="transparent"
          />
          {/* Progress Arc */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            stroke={style.stroke}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Center Score Readout */}
        <div className="absolute flex flex-col items-center text-center">
          <span className={`text-4xl font-extrabold font-mono tracking-tight ${style.text}`}>
            {wqi.toFixed(1)}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">Score / 100</span>
        </div>
      </div>

      {/* Classification & Standards Status */}
      <div className="space-y-3">
        <div className="text-center">
          <div className={`inline-block px-3 py-1 rounded-md border text-xs font-bold tracking-wide ${style.badge}`}>
            {grade}
          </div>
          <div className="text-[11px] font-mono text-slate-400 font-semibold mt-1.5">
            {style.potability}
          </div>
        </div>

        {/* Anomaly Vector Sub-Telemetry */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center font-mono text-xs">
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">Z_Turb</span>
            <span className={`font-semibold ${zTurb > 2.0 ? 'text-rose-400' : 'text-slate-200'}`}>
              +{zTurb.toFixed(2)}σ
            </span>
          </div>
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">Z_TDS</span>
            <span className={`font-semibold ${zTds > 2.0 ? 'text-rose-400' : 'text-slate-200'}`}>
              +{zTds.toFixed(2)}σ
            </span>
          </div>
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 block">S_comp</span>
            <span className={`font-semibold ${anomalyScore > 2.0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {anomalyScore.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
