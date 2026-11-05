import React from 'react';
import { Microscope, AlertTriangle, ShieldCheck, Flame, Wrench, VolumeX, Volume2 } from 'lucide-react';
import { SystemState } from '../types';

interface DiagnosisBannerProps {
  signature: string;
  state: SystemState;
  isMuted?: boolean;
  onAcknowledgeAlarm?: () => void;
}

export const DiagnosisBanner: React.FC<DiagnosisBannerProps> = ({
  signature,
  state,
  isMuted,
  onAcknowledgeAlarm,
}) => {
  const isAlarmOrWarning = state === 'HIGH ANOMALY' || (state as string) === 'ALARM' || state === 'WARNING';

  const getBannerDetails = () => {
    switch (state) {
      case 'NORMAL':
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          icon: ShieldCheck,
          iconColor: 'text-emerald-400',
          complianceStatus: 'BIS IS 10500:2012 COMPLIANT • POTABLE DRINKING WATER',
          complianceBadge: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
          recommendation: 'Baseline water quality conforms to Indian Standard IS 10500 specifications. Suitable for direct municipal delivery and human consumption.',
        };
      case 'WARNING':
        return {
          border: 'border-amber-500/40',
          bg: 'bg-amber-950/20',
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          complianceStatus: 'ACCEPTABLE UNDER EMERGENCY • FILTRATION STRONGLY ADVISED',
          complianceBadge: 'bg-amber-900/40 text-amber-300 border-amber-500/40',
          recommendation: 'Turbidity or dissolved solids exceed Desirable Limits but remain within maximum Permissible limits. Secondary particulate filtration recommended prior to use.',
        };
      case 'HIGH ANOMALY':
      case 'ALARM' as any:
        return {
          border: 'border-rose-500/50',
          bg: 'bg-rose-950/25',
          icon: Flame,
          iconColor: 'text-rose-400',
          complianceStatus: 'NON-POTABLE • CRITICAL PARAMETER LIMITS EXCEEDED (IS 10500)',
          complianceBadge: 'bg-rose-900/50 text-rose-300 border-rose-500/50',
          recommendation: 'Severe anomaly detected exceeding permissible safety thresholds. Immediate automated shutdown or diversion of supply line required. Do not consume without industrial remediation.',
        };
      case 'HARDWARE FAULT':
        return {
          border: 'border-purple-500/40',
          bg: 'bg-purple-950/20',
          icon: Wrench,
          iconColor: 'text-purple-400',
          complianceStatus: 'INSTRUMENTATION FAULT • PROBE RECALIBRATION REQUIRED',
          complianceBadge: 'bg-purple-900/40 text-purple-300 border-purple-500/40',
          recommendation: 'ADC signal out-of-range or 1-Wire bus communication timeout. Inspect physical wiring, 4.7kΩ pull-up resistor, and probe electrode condition.',
        };
      default:
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          icon: ShieldCheck,
          iconColor: 'text-emerald-400',
          complianceStatus: 'BIS IS 10500:2012 COMPLIANT • POTABLE DRINKING WATER',
          complianceBadge: 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30',
          recommendation: 'Baseline water quality conforms to Indian Standard IS 10500 specifications.',
        };
    }
  };

  const details = getBannerDetails();
  const Icon = details.icon;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${details.bg} ${details.border} transition-all duration-200`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Icon & Diagnostic Root Cause */}
        <div className="flex items-start gap-3.5 flex-1">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
            <Icon className={`h-5 w-5 ${details.iconColor}`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Microscope className="h-3.5 w-3.5 text-cyan-400" />
                Root-Cause Signature:
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${details.complianceBadge}`}>
                {details.complianceStatus}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {signature}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              {details.recommendation}
            </p>
          </div>
        </div>

        {/* Right Side: Remote Mute / Unmute Siren Action */}
        {isAlarmOrWarning && onAcknowledgeAlarm && (
          <div className="shrink-0 flex items-center md:self-center">
            {isMuted ? (
              <button
                onClick={onAcknowledgeAlarm}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm"
                title="Siren is silenced. Click to turn siren back ON"
              >
                <Volume2 className="h-4 w-4 text-emerald-400" />
                <span>Buzzer Muted (Turn ON)</span>
              </button>
            ) : (
              <button
                onClick={onAcknowledgeAlarm}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm border border-rose-400/30"
                title="Alarm is sounding. Click to acknowledge and silence buzzer"
              >
                <VolumeX className="h-4 w-4" />
                <span>Acknowledge & Mute Siren</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
