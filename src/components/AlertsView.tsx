import React, { useState } from 'react';
import {
  AlertTriangle,
  Scale,
  Camera,
  CheckCircle2,
  Filter,
  Search,
  CheckCheck,
  ShieldAlert,
  ArrowUpDown,
  TrendingDown,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import type { Alert, Product, SensorData } from '../types/index.js';

interface AlertsViewProps {
  alerts: Alert[];
  products: Product[];
  sensors: Record<string, SensorData>;
  onResolveAlert: (id: string) => Promise<void>;
  onResolveAllAlerts: () => Promise<void>;
  onSimulateAction: (action: string, shelf_id?: string, extra?: any) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  products,
  sensors,
  onResolveAlert,
  onResolveAllAlerts,
  onSimulateAction,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Explicit Requirement: Prioritized alert feed with LOW STOCK listed FIRST, then MISPLACED, then TAMPERING, then OFFLINE
  const typePriority: Record<string, number> = {
    LOW_STOCK: 1, // Listed FIRST
    MISPLACED: 2,
    TAMPERING: 3,
    OFFLINE: 4,
  };

  const prioritizedAlerts = [...alerts].sort((a, b) => {
    // Active first
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;

    // Then priority order
    const pA = typePriority[a.alert_type] || 99;
    const pB = typePriority[b.alert_type] || 99;
    if (pA !== pB) return pA - pB;

    // Then recency
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filteredAlerts = prioritizedAlerts.filter((a) => {
    const matchesType = filterType === 'all' || a.alert_type === filterType;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchesSearch =
      a.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.shelf_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const lowStockCount = alerts.filter((a) => a.alert_type === 'LOW_STOCK' && a.status === 'ACTIVE').length;
  const misplacedCount = alerts.filter((a) => a.alert_type === 'MISPLACED' && a.status === 'ACTIVE').length;
  const tamperingCount = alerts.filter((a) => a.alert_type === 'TAMPERING' && a.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-rose-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Alerts & Anomaly Center
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Prioritized real-time triage feed: <strong>Low Stock warnings ranked first</strong>, followed by misplaced products and load cell weight anomalies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onResolveAllAlerts()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-mono font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              <CheckCheck className="h-4 w-4 text-emerald-400" />
              <span>Resolve All Active ({activeCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Priority Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <button
          onClick={() => {
            setFilterType('LOW_STOCK');
            setFilterStatus('ACTIVE');
          }}
          className={`p-3 rounded-xl border text-left transition-colors ${
            filterType === 'LOW_STOCK'
              ? 'border-amber-500/60 bg-amber-950/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-amber-400">#1 LOW STOCK</span>
            <TrendingDown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 tabular-nums">{lowStockCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Restock required</div>
        </button>

        <button
          onClick={() => {
            setFilterType('MISPLACED');
            setFilterStatus('ACTIVE');
          }}
          className={`p-3 rounded-xl border text-left transition-colors ${
            filterType === 'MISPLACED'
              ? 'border-purple-500/60 bg-purple-950/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-purple-400">#2 MISPLACED</span>
            <Layers className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 tabular-nums">{misplacedCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cam + IR optical mismatch</div>
        </button>

        <button
          onClick={() => {
            setFilterType('TAMPERING');
            setFilterStatus('ACTIVE');
          }}
          className={`p-3 rounded-xl border text-left transition-colors ${
            filterType === 'TAMPERING'
              ? 'border-rose-500/60 bg-rose-950/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-rose-400">#3 TAMPERING</span>
            <Scale className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 tabular-nums">{tamperingCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Load cell weight anomaly</div>
        </button>

        <button
          onClick={() => {
            setFilterType('all');
            setFilterStatus('all');
          }}
          className={`p-3 rounded-xl border text-left transition-colors ${
            filterType === 'all' && filterStatus === 'all'
              ? 'border-cyan-500/60 bg-cyan-950/30'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-cyan-400">TOTAL HISTORY</span>
            <ArrowUpDown className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1 tabular-nums">{alerts.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">All logged events</div>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts by shelf or product..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs font-mono">
            <button
              onClick={() => setFilterStatus('ACTIVE')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === 'ACTIVE'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterStatus('RESOLVED')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === 'RESOLVED'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterStatus === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Anomaly Types</option>
            <option value="LOW_STOCK">Low Stock (Prio 1)</option>
            <option value="MISPLACED">Misplaced (Prio 2)</option>
            <option value="TAMPERING">Tampering (Prio 3)</option>
            <option value="OFFLINE">Hardware Offline</option>
          </select>
        </div>
      </div>

      {/* Prioritized Alert Feed List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200">No alerts matching filter</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your smart shelves are currently operating within nominal parameters.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isLowStock = alert.alert_type === 'LOW_STOCK';
            const isMisplaced = alert.alert_type === 'MISPLACED';
            const isTamper = alert.alert_type === 'TAMPERING';
            const isOffline = alert.alert_type === 'OFFLINE';
            const isActive = alert.status === 'ACTIVE';

            return (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 transition-all ${
                  !isActive
                    ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
                    : isTamper
                    ? 'border-rose-500/40 bg-rose-950/15 shadow-sm'
                    : isMisplaced
                    ? 'border-purple-500/40 bg-purple-950/15'
                    : isLowStock
                    ? 'border-amber-500/40 bg-amber-950/15'
                    : 'border-slate-800 bg-slate-900/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Type badge & Title */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isLowStock
                          ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                          : isMisplaced
                          ? 'bg-purple-950/60 border-purple-500/40 text-purple-400'
                          : isTamper
                          ? 'bg-rose-950/60 border-rose-500/40 text-rose-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {isLowStock ? (
                        <TrendingDown className="h-5 w-5" />
                      ) : isMisplaced ? (
                        <Camera className="h-5 w-5" />
                      ) : isTamper ? (
                        <Scale className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            isLowStock
                              ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                              : isMisplaced
                              ? 'bg-purple-950 text-purple-300 border-purple-500/50'
                              : isTamper
                              ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {alert.alert_type.replace('_', ' ')}
                        </span>

                        <span className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                          {alert.shelf_id}
                        </span>

                        <span className="text-xs text-slate-400">· {alert.product_name}</span>

                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                            alert.severity === 'CRITICAL'
                              ? 'text-rose-400 bg-rose-950/60 border border-rose-500/30'
                              : 'text-amber-400 bg-amber-950/60 border border-amber-500/30'
                          }`}
                        >
                          {alert.severity}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-white mt-1.5 leading-snug">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timestamp & Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(alert.created_at).toLocaleTimeString()}</span>
                    </div>

                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => onResolveAlert(alert.id)}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-mono text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        Resolve Anomaly
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>

                {/* Deep-Dive Inspection Telemetry Bar (if metadata present) */}
                {alert.metadata && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/50 p-2.5 rounded-lg text-xs font-mono">
                    {alert.metadata.expected_weight_g !== undefined && (
                      <div>
                        <span className="text-slate-500">Expected Load: </span>
                        <strong className="text-slate-200">
                          {alert.metadata.expected_weight_g}g
                        </strong>
                      </div>
                    )}
                    {alert.metadata.measured_weight_g !== undefined && (
                      <div>
                        <span className="text-slate-500">Load Cell Sensor: </span>
                        <strong className="text-rose-400">
                          {alert.metadata.measured_weight_g}g
                        </strong>
                      </div>
                    )}
                    {alert.metadata.weight_diff_g !== undefined && (
                      <div>
                        <span className="text-slate-500">Load Cell Delta: </span>
                        <strong className="text-amber-400">
                          {Math.round(alert.metadata.weight_diff_g)}g variance
                        </strong>
                      </div>
                    )}
                    {alert.metadata.detected_product && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500">ESP32-Cam Detected: </span>
                        <strong className="text-purple-300">
                          {alert.metadata.detected_product}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
