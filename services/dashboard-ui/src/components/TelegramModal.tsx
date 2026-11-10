import React, { useState } from 'react';
import { X, Send, CheckCircle2, Bell, Shield, ExternalLink, Zap } from 'lucide-react';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  const [testSent, setTestSent] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const botUsername = 'jalrakshak_test_bot';
  const botLink = `https://t.me/${botUsername}`;
  const subscriberId = '6809883846';

  const handleSendTestAlert = () => {
    setIsSending(true);
    // Ping API endpoint or simulate test trigger
    fetch('/api/telemetry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Key': 'jal_sec_dev_local_key',
      },
      body: JSON.stringify({
        device_id: 'ESP32_AQUASURE_01',
        turbidity_ntu: 28.5,
        tds_ppm: 620.0,
        temp_c: 26.5,
        state: 'ALARM',
      }),
    })
      .then(() => {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 5000);
      })
      .catch((err) => {
        console.error('Test notification trigger error:', err);
      })
      .finally(() => {
        setIsSending(false);
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Incident Alert Dispatcher</h3>
              <p className="text-xs text-slate-400">Automated Push Alerts via Telegram Bot Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configuration Matrix */}
        <div className="my-5 space-y-3">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider block">Gateway Service</span>
              <span className="text-slate-200 font-medium font-mono">api.telegram.org (HTTPS)</span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider block">Gateway Status</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Live & Armored
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider block">Bot Identity</span>
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline font-mono inline-flex items-center gap-1"
              >
                @{botUsername} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[11px] uppercase tracking-wider block">Primary Subscriber</span>
              <span className="text-slate-200 font-mono">UID: {subscriberId}</span>
            </div>
          </div>

          {/* Trigger Conditions */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300 space-y-2">
            <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">Alert Policy & Debounce Matrix</span>
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><b>Immediate Dispatch:</b> Fires instantly on transition from <code>NORMAL</code> to <code>WARNING</code> or <code>ALARM</code>.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><b>Smart Debounce:</b> Rate-limited to max 1 alert per 5 minutes during ongoing contamination to avoid channel spam.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-300">
              <Shield className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <span><b>Payload Integrity:</b> Telemetry includes WQI, Turbidity (NTU), TDS (ppm), Fluid Temp (°C), and Root-Cause Diagnosis.</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <a
            href={botLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition shadow-md"
          >
            <Send className="h-3.5 w-3.5" />
            Open @{botUsername}
          </a>

          <button
            onClick={handleSendTestAlert}
            disabled={isSending}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition ${
              testSent
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Zap className={`h-3.5 w-3.5 ${testSent ? 'text-emerald-400' : 'text-amber-400'}`} />
            {isSending ? 'Sending...' : testSent ? 'Test Alert Dispatched!' : 'Send Test Notification'}
          </button>
        </div>
      </div>
    </div>
  );
};
