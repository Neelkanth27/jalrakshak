import React from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const botUsername = 'jalrakshak_test_bot';
  const botLink = `https://t.me/${botUsername}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(botLink)}&bgcolor=11-18-27&color=6-182-212`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-gray-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="h-12 w-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center mx-auto mb-4">
          <Send className="h-6 w-6" />
        </div>

        <h3 className="text-xl font-bold text-white">Subscribe to Mobile Alerts</h3>
        <p className="text-xs text-gray-400 mt-1">
          Scan the QR code with your phone camera or click the link to receive real-time contamination notifications.
        </p>

        {/* QR Code Container */}
        <div className="my-6 p-4 rounded-2xl bg-gray-950 border border-gray-800 inline-block shadow-inner">
          <img
            src={qrCodeUrl}
            alt="Telegram Bot QR Code"
            className="w-44 h-44 rounded-lg mx-auto"
          />
        </div>

        {/* Instructions */}
        <div className="text-left bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs text-gray-300 space-y-2 mb-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>1. Open Telegram & tap <b>Start</b> on <b>@{botUsername}</b></span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <span>2. Receive instant alarms on Warning or Silt intrusion</span>
          </div>
        </div>

        <a
          href={botLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition shadow-lg shadow-sky-500/20"
        >
          Open in Telegram App
        </a>
      </div>
    </div>
  );
};
