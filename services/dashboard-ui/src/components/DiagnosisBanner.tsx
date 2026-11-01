import React from 'react';
import { Microscope, AlertTriangle, ShieldCheck, Flame, Wrench } from 'lucide-react';
import { SystemState } from '../types';

interface DiagnosisBannerProps {
  signature: string;
  state: SystemState;
}

export const DiagnosisBanner: React.FC<DiagnosisBannerProps> = ({ signature, state }) => {
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Microscope className="h-3.5 w-3.5 text-cyan-400" />
              Smart Contaminant Diagnosis
            </span>
          </div>
          <h3 className="text-base font-bold text-white mt-0.5">{signature}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Multivariate fingerprint engine continuously cross-references optical turbidity deviations, ionic conductance shifts, and thermal coefficients to differentiate sediment intrusion from chemical/saline ingress.
          </p>
        </div>
      </div>
    </div>
  );
};
