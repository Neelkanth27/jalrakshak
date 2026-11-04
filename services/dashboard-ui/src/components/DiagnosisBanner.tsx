import React from 'react';
import { Microscope, AlertTriangle, ShieldCheck, Flame, Wrench, VolumeX, CheckCircle } from 'lucide-react';
import { SystemState } from '../types';

interface DiagnosisBannerProps {
  signature: string;
  state: SystemState;
  isMuted?: boolean;
  onAcknowledgeAlarm?: () => void;
}

export const DiagnosisBanner: React.FC<DiagnosisBannerProps> = ({ signature, state, isMuted, onAcknowledgeAlarm }) => {
  const isAlarmOrWarning = state === 'HIGH ANOMALY' || (state as string) === 'ALARM' || state === 'WARNING';

  const getBannerStyle = () => {
    switch (state) {
      case 'NORMAL':
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          icon: ShieldCheck,
          iconColor: 'text-emerald-400',
          title: 'Nominal Quiescent Baseline',
        };
      case 'WARNING':
        return {
          border: 'border-amber-500/40',
          bg: 'bg-amber-950/25',
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          title: 'Anomaly Pattern Identified',
        };
      case 'HIGH ANOMALY':
      case 'ALARM' as any:
        return {
          border: 'border-rose-500/50',
          bg: 'bg-rose-950/30',
          icon: Flame,
          iconColor: 'text-rose-400',
          title: 'High Contamination Signature',
        };
      case 'HARDWARE FAULT':
        return {
          border: 'border-purple-500/40',
          bg: 'bg-purple-950/30',
          icon: Wrench,
          iconColor: 'text-purple-400',
          title: 'Physical Instrumentation Fault',
        };
      default:
        return {
          border: 'border-emerald-500/30',
          bg: 'bg-emerald-950/20',
          icon: ShieldCheck,
          iconColor: 'text-emerald-400',
          title: 'Nominal Quiescent Baseline',
        };
    }
  };

  const style = getBannerStyle();
  const Icon = style.icon;

  return (
    <div className={`rounded-2xl border p-5 ${style.bg} ${style.border} transition-all duration-300 shadow-lg`}>
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gray-900/80 border border-gray-800 shrink-0">
          <Icon className={`h-6 w-6 ${style.iconColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Microscope className="h-3.5 w-3.5 text-cyan-400" />
                Smart Contaminant Diagnosis
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">{signature}</h3>
            </div>
            {isAlarmOrWarning && onAcknowledgeAlarm && (
              <div className="shrink-0">
                {isMuted ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold shadow-inner">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Alarm Acknowledged (Buzzer Muted)
                  </div>
                ) : (
                  <button
                    onClick={onAcknowledgeAlarm}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950/50 hover:shadow-rose-900/60 transition-all active:scale-95 animate-pulse cursor-pointer border border-rose-400/30"
                  >
                    <VolumeX className="h-4 w-4" />
                    Acknowledge & Mute Buzzer
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            Multivariate fingerprint engine continuously cross-references optical turbidity deviations, ionic conductance shifts, and thermal coefficients to differentiate sediment intrusion from chemical/saline ingress.
          </p>
        </div>
      </div>
    </div>
  );
};
