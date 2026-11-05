import React, { useState } from 'react';
import { Database, Search, Filter, RefreshCw, AlertTriangle, ShieldCheck, AlertOctagon } from 'lucide-react';
import { TelemetryData } from '../types';

interface HistoryTableProps {
  history: TelemetryData[];
  onRefresh: () => void;
  onExportCsv?: () => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onRefresh, onExportCsv }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter records with defensive null-checks
  const filteredRecords = [...history].reverse().filter((record) => {
    const sig = (record.contaminant_signature || '').toLowerCase();
    const grade = (record.wqi_grade || '').toLowerCase();
    const st = (record.state || '').toLowerCase();
    const q = searchTerm.toLowerCase();

    const matchesSearch = sig.includes(q) || grade.includes(q) || st.includes(q);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ANOMALIES_ONLY' && record.state !== 'NORMAL') ||
      record.state === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'NORMAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> NORMAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="h-3 w-3 text-amber-400" /> WARNING
          </span>
        );
      case 'HIGH ANOMALY':
      case 'ALARM' as any:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-500/50">
            <AlertOctagon className="h-3 w-3 text-rose-400" /> ALARM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {state}
          </span>
        );
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-900/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Historical Telemetry & Audit Trail
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">Persisted in Neon PostgreSQL (US-East) • Total: {history.length} events</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 font-mono">
            <Filter className="h-3 w-3 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL">All States</option>
              <option value="ANOMALIES_ONLY">Anomalies Only</option>
              <option value="NORMAL">Normal Only</option>
              <option value="WARNING">Warning Only</option>
              <option value="HIGH ANOMALY">Alarm Only</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            title="Refresh from Neon Postgres"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto max-h-96">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400 sticky top-0 z-10 backdrop-blur">
            <tr>
              <th className="py-2.5 px-3.5 font-semibold">Timestamp</th>
              <th className="py-2.5 px-3 font-semibold">WQI</th>
              <th className="py-2.5 px-3 font-semibold">State</th>
              <th className="py-2.5 px-3 font-semibold">Turbidity</th>
              <th className="py-2.5 px-3 font-semibold">TDS</th>
              <th className="py-2.5 px-3 font-semibold">Temp</th>
              <th className="py-2.5 px-3.5 font-semibold">Contaminant Signature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No records match current filter criteria.
                </td>
              </tr>
            ) : (
              filteredRecords.slice(0, 50).map((record, index) => (
                <tr key={index} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap text-[11px]">
                    {formatTimestamp(record.received_at)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                    {record.wqi.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {getStatusBadge(record.state)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {record.turbidity_ntu.toFixed(1)} NTU
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {record.tds_ppm.toFixed(1)} ppm
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {record.temp_c.toFixed(1)} °C
                  </td>
                  <td className="py-2.5 px-3.5 font-sans text-slate-300 max-w-xs truncate text-[11px]">
                    {record.contaminant_signature}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
