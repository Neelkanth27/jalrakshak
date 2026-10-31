import React, { useState } from 'react';
import { Database, Search, Filter, RefreshCw, AlertTriangle, ShieldCheck, AlertOctagon } from 'lucide-react';
import { TelemetryData } from '../types';

interface HistoryTableProps {
  history: TelemetryData[];
  onRefresh: () => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter records
  const filteredRecords = [...history].reverse().filter((record) => {
    const matchesSearch =
      record.contaminant_signature.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.wqi_grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.state.toLowerCase().includes(searchTerm.toLowerCase());

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="h-3 w-3" /> NORMAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-3 w-3" /> WARNING
          </span>
        );
      case 'HIGH ANOMALY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertOctagon className="h-3 w-3" /> ALARM
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
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
    <div className="bg-[#111827] border border-gray-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row items-center justify-between gap-3 bg-[#0d1322]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-400">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Historical Telemetry & Audit Log</h3>
            <p className="text-xs text-gray-400">Total Persisted Records: {history.length}</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:w-60">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search diagnosis or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-300">
            <Filter className="h-3 w-3 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-gray-300 focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-gray-900">All Records</option>
              <option value="NORMAL" className="bg-gray-900">Normal Only</option>
              <option value="ANOMALIES_ONLY" className="bg-gray-900">Anomalies Only</option>
              <option value="WARNING" className="bg-gray-900">Warning Only</option>
              <option value="HIGH ANOMALY" className="bg-gray-900">Alarm Only</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition"
            title="Refresh database records"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b0f19] text-gray-400 font-semibold border-b border-gray-800 sticky top-0 z-10 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Time</th>
              <th className="py-2.5 px-4">State</th>
              <th className="py-2.5 px-4">WQI</th>
              <th className="py-2.5 px-4">Turbidity</th>
              <th className="py-2.5 px-4">TDS (EC25)</th>
              <th className="py-2.5 px-4">Temp</th>
              <th className="py-2.5 px-4">Smart Diagnosis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                  No records match the current filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-800/30 transition">
                  <td className="py-2.5 px-4 text-gray-400 whitespace-nowrap">
                    {formatTimestamp(item.received_at)}
                  </td>
                  <td className="py-2.5 px-4 font-sans whitespace-nowrap">
                    {getStatusBadge(item.state)}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                    <span className={item.wqi >= 90 ? 'text-emerald-400' : item.wqi >= 75 ? 'text-teal-400' : item.wqi >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                      {item.wqi.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-gray-500 ml-1 font-sans font-normal">
                      ({item.wqi_grade.split(' ')[0]})
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 whitespace-nowrap">
                    {item.turbidity_ntu.toFixed(1)} <span className="text-[10px] text-gray-500">NTU</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 whitespace-nowrap">
                    {item.tds_ppm.toFixed(1)} <span className="text-[10px] text-gray-500">ppm</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 whitespace-nowrap">
                    {item.temp_c.toFixed(1)} <span className="text-[10px] text-gray-500">°C</span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 font-sans text-xs truncate max-w-xs" title={item.contaminant_signature}>
                    {item.contaminant_signature}
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
