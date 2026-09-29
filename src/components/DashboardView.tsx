import React, { useState } from 'react';
import {
  Package,
  AlertTriangle,
  Layers,
  Scale,
  Activity,
  PlusCircle,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Flame,
  Zap,
} from 'lucide-react';
import type { Product, SensorData, Alert, DashboardMetrics } from '../types/index.js';

interface DashboardViewProps {
  products: Product[];
  sensors: Record<string, SensorData>;
  alerts: Alert[];
  metrics: DashboardMetrics | null;
  onResolveAlert: (id: string) => void;
  onSimulateAction: (action: string, shelf_id?: string, extra?: any) => void;
  onNavigateToTab: (tab: 'dashboard' | 'inventory' | 'alerts' | 'hardware') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  sensors,
  alerts,
  metrics,
  onResolveAlert,
  onSimulateAction,
  onNavigateToTab,
}) => {
  const [selectedShelfFilter, setSelectedShelfFilter] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'grid' | 'rack'>('rack');

  const activeAlerts = alerts.filter((a) => a.status === 'ACTIVE');
  const lowStockCount = activeAlerts.filter((a) => a.alert_type === 'LOW_STOCK').length;
  const misplacedCount = activeAlerts.filter((a) => a.alert_type === 'MISPLACED').length;
  const tamperingCount = activeAlerts.filter((a) => a.alert_type === 'TAMPERING').length;
  const totalStock = products.reduce((acc, p) => acc + p.current_stock, 0);

  // Filter products by selected shelf
  const filteredProducts = selectedShelfFilter === 'all'
    ? products
    : products.filter((p) => p.shelf_position.toLowerCase().includes(selectedShelfFilter.toLowerCase()));

  // Shelves grouped by Rack Tier (Tier A, Tier B, Tier C, etc.)
  const shelvesGrouped: Record<string, Product[]> = {};
  for (const prod of products) {
    const tier = prod.shelf_position.split('-')[0] || prod.shelf_position;
    if (!shelvesGrouped[tier]) shelvesGrouped[tier] = [];
    shelvesGrouped[tier].push(prod);
  }

  return (
    <div className="space-y-6">
      {/* 1. Key Metrics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Stock & Shelves */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Shelf Stock</span>
            <Package className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{totalStock}</span>
            <span className="text-xs text-slate-400">units across {products.length} shelves</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
            {metrics?.total_products_per_shelf.map((s) => (
              <span key={s.shelf_id} className="bg-slate-800/80 px-1.5 py-0.5 rounded">
                {s.shelf_id}: <strong className="text-slate-300">{s.total_stock}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Metric 2: Low Stock Count */}
        <div
          onClick={() => onNavigateToTab('alerts')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            lowStockCount > 0
              ? 'border-amber-500/40 bg-amber-950/20 hover:border-amber-500/70'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Low Stock Products
            </span>
            <AlertTriangle
              className={`h-4 w-4 ${lowStockCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                lowStockCount > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            >
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-400">items below threshold</span>
          </div>
          <div className="mt-3 text-[11px] text-amber-400/80 flex items-center justify-between">
            <span>{lowStockCount > 0 ? 'Restock immediately' : 'Inventory levels nominal'}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </div>
        </div>

        {/* Metric 3: Misplaced Products Count */}
        <div
          onClick={() => onNavigateToTab('alerts')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            misplacedCount > 0
              ? 'border-rose-500/40 bg-rose-950/20 hover:border-rose-500/70'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Misplaced Products
            </span>
            <Layers
              className={`h-4 w-4 ${misplacedCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                misplacedCount > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {misplacedCount}
            </span>
            <span className="text-xs text-slate-400">visual mismatches</span>
          </div>
          <div className="mt-3 text-[11px] text-rose-400/80 flex items-center justify-between">
            <span>{misplacedCount > 0 ? 'Camera classification alert' : 'All items correctly zoned'}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </div>
        </div>

        {/* Metric 4: Active Product Alerts Count */}
        <div
          onClick={() => onNavigateToTab('alerts')}
          className={`cursor-pointer rounded-xl border p-4 transition-all ${
            activeAlerts.length > 0
              ? 'border-cyan-500/40 bg-cyan-950/20 hover:border-cyan-500/70'
              : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Active Alerts
            </span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400 tabular-nums">
              {activeAlerts.length}
            </span>
            <span className="text-xs text-slate-400">
              ({tamperingCount} tamper · {lowStockCount} stock)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-cyan-400/80 flex items-center justify-between">
            <span>View prioritized triage feed</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
          </div>
        </div>
      </div>

      {/* Main Section: Product Display Grid + Sidebar (Recent Product Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Main Product Display Grid / Shelf Rack Visualizer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Live Smart Shelf Monitor</span>
              <span className="text-xs text-slate-500">· Telemetry updates every 5s</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Shelf Filter */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs">
                <button
                  onClick={() => setSelectedShelfFilter('all')}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedShelfFilter === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  All Shelves
                </button>
                <button
                  onClick={() => setSelectedShelfFilter('Shelf A')}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedShelfFilter === 'Shelf A' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Tier A
                </button>
                <button
                  onClick={() => setSelectedShelfFilter('Shelf B')}
                  className={`px-2 py-1 rounded transition-colors ${
                    selectedShelfFilter === 'Shelf B' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400'
                  }`}
                >
                  Tier B
                </button>
              </div>

              {/* View layout toggle */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs">
                <button
                  onClick={() => setDisplayMode('rack')}
                  className={`px-2 py-1 rounded transition-colors ${
                    displayMode === 'rack' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'
                  }`}
                >
                  Rack View
                </button>
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`px-2 py-1 rounded transition-colors ${
                    displayMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300 font-medium' : 'text-slate-400'
                  }`}
                >
                  Grid Cards
                </button>
              </div>
            </div>
          </div>

          {/* Shelves Container */}
          <div className="space-y-4">
            {filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
                <Package className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-300">No products matching filter</h3>
                <p className="text-xs text-slate-500 mt-1">Try switching to all shelves or add a product in inventory.</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const sensor = sensors[product.shelf_position];
                const isLowStock = product.current_stock <= product.min_threshold;
                const hasMisplaced = sensor && sensor.cam_detected_label && sensor.cam_detected_label !== product.name;
                const expectedTotalWeight = product.current_stock * product.expected_weight_g;
                const currentWeight = sensor ? sensor.load_cell_weight_g : expectedTotalWeight;
                const weightDiff = Math.abs(currentWeight - expectedTotalWeight);
                const hasTampering = weightDiff > product.expected_weight_g * 0.45 && currentWeight > 50;

                const stockPct = Math.min(100, Math.round((product.current_stock / product.max_capacity) * 100));

                return (
                  <div
                    key={product.id}
                    className={`rounded-xl border p-4 transition-all ${
                      hasTampering
                        ? 'border-rose-500/50 bg-rose-950/10'
                        : hasMisplaced
                        ? 'border-amber-500/50 bg-amber-950/10'
                        : isLowStock
                        ? 'border-amber-500/40 bg-slate-900/70'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Product Media & Info */}
                      <div className="flex items-center gap-4">
                        <div className="relative h-18 w-18 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                            onError={(e) => {
                              // Resilient SVG fallback
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                              {product.shelf_position}
                            </span>
                            <span className="text-xs text-slate-400">{product.category}</span>
                            {isLowStock && (
                              <span className="text-[11px] font-mono font-semibold text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40">
                                LOW STOCK
                              </span>
                            )}
                            {hasTampering && (
                              <span className="text-[11px] font-mono font-semibold text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/40">
                                WEIGHT TAMPER
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-white mt-1">{product.name}</h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                            <span>
                              Unit: <strong className="text-slate-200">{product.expected_weight_g}g</strong>
                            </span>
                            <span>·</span>
                            <span>
                              Min threshold: <strong className="text-slate-200">{product.min_threshold}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Level Gauge & Telemetry Values */}
                      <div className="w-full sm:w-56 shrink-0 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400">Stock Level</span>
                          <span className="font-bold text-white tabular-nums">
                            {product.current_stock} / {product.max_capacity} units
                          </span>
                        </div>

                        {/* Progress Bar / Gauge */}
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isLowStock
                                ? 'bg-amber-400'
                                : stockPct < 50
                                ? 'bg-cyan-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${stockPct}%` }}
                          />
                        </div>

                        {/* Live Load Cell Weight Reading */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span className="flex items-center gap-1">
                            <Scale className="h-3 w-3 text-cyan-400" />
                            Load Cell:
                          </span>
                          <span
                            className={`font-bold tabular-nums ${
                              hasTampering ? 'text-rose-400' : 'text-slate-200'
                            }`}
                          >
                            {currentWeight.toLocaleString()}g
                            <span className="text-slate-500 font-normal">
                              {' '}
                              (exp {expectedTotalWeight}g)
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hardware Sensor Live Readout Bar */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4 text-slate-400 font-mono text-[11px]">
                        {/* IR Sensor State */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              sensor?.ir_sensor_state ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                          <span>IR Beam:</span>
                          <strong className={sensor?.ir_sensor_state ? 'text-emerald-400' : 'text-slate-500'}>
                            {sensor?.ir_sensor_state ? 'BEAM OCCUPIED' : 'CLEAR'}
                          </strong>
                        </div>

                        {/* ESP32-Cam Detected Label */}
                        <div className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-cyan-400" />
                          <span>ESP32-Cam:</span>
                          <strong
                            className={
                              hasMisplaced
                                ? 'text-amber-400 underline decoration-wavy'
                                : 'text-slate-300'
                            }
                          >
                            {sensor?.cam_detected_label || product.name}
                          </strong>
                          <span className="text-slate-500">
                            ({Math.round((sensor?.cam_confidence || 0.96) * 100)}%)
                          </span>
                        </div>
                      </div>

                      {/* Interactive Hardware Action Buttons for Demonstration */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSimulateAction('PICK_ITEM', product.shelf_position)}
                          disabled={product.current_stock <= 0}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors disabled:opacity-40"
                          title="Simulate customer taking 1 item (load cell & IR triggers)"
                        >
                          Pick 1 Item
                        </button>

                        <button
                          type="button"
                          onClick={() => onSimulateAction('RESTOCK', product.shelf_position)}
                          className="px-2 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 text-xs font-mono transition-colors"
                          title="Restock shelf to maximum capacity"
                        >
                          Restock
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onSimulateAction('MISPLACE', product.shelf_position, {
                              foreign_label: 'Unregistered Generic Can',
                            })
                          }
                          className="px-2 py-1 rounded bg-amber-950/50 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 text-xs font-mono transition-colors"
                          title="Simulate placing wrong product for camera classification check"
                        >
                          Misplace
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onSimulateAction('TAMPER', product.shelf_position, {
                              extra_weight_g: -650,
                            })
                          }
                          className="px-2 py-1 rounded bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 text-xs font-mono transition-colors"
                          title="Simulate weight tampering / theft anomaly"
                        >
                          Tamper
                        </button>

                        {(hasTampering || hasMisplaced) && (
                          <button
                            type="button"
                            onClick={() => onSimulateAction('RESTORE_NOMINAL', product.shelf_position)}
                            className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-xs font-mono transition-colors"
                            title="Restore shelf to calibrated nominal state"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (1/3): Sidebar / Right-Side Panel (Recent Product Alerts) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Recent Product Alerts</h3>
              </div>
              <button
                onClick={() => onNavigateToTab('alerts')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
              >
                <span>View All ({activeAlerts.length})</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* Alert List */}
            <div className="mt-3 space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {activeAlerts.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400/70 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-300">All Shelves Nominal</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    No active stock shortages, misplaced items, or load cell tampering detected.
                  </p>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const isWarning = alert.severity === 'WARNING';
                  const isCritical = alert.severity === 'CRITICAL';

                  return (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-3 text-xs transition-colors ${
                        isCritical
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : isWarning
                          ? 'border-amber-500/40 bg-amber-950/20'
                          : 'border-slate-800 bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            alert.alert_type === 'LOW_STOCK'
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                              : alert.alert_type === 'MISPLACED'
                              ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                              : alert.alert_type === 'TAMPERING'
                              ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {alert.alert_type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(alert.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="font-semibold text-slate-200">{alert.shelf_id}</div>
                      <p className="text-slate-400 mt-0.5 text-[11px] leading-relaxed">{alert.message}</p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/60 pt-2">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Severity: <strong className={isCritical ? 'text-rose-400' : 'text-amber-400'}>{alert.severity}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => onResolveAlert(alert.id)}
                          className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[11px] font-mono text-cyan-300 transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Hardware Simulator Triggers Box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-cyan-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Hardware Payload Simulator
              </h4>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Trigger rapid hardware test cycles to verify 5s polling, load cell changes, and real-time alerts.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => onSimulateAction('PICK_ITEM', 'Shelf A-1')}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-left border border-slate-700/60 transition-colors"
              >
                Customer Pick
              </button>
              <button
                type="button"
                onClick={() => onSimulateAction('RESTOCK', 'Shelf B-1')}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-left border border-slate-700/60 transition-colors"
              >
                Staff Restock
              </button>
              <button
                type="button"
                onClick={() => onSimulateAction('MISPLACE', 'Shelf A-2')}
                className="p-2 rounded bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 text-left border border-amber-500/30 transition-colors"
              >
                Wrong Item
              </button>
              <button
                type="button"
                onClick={() => onSimulateAction('TAMPER', 'Shelf A-1')}
                className="p-2 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-left border border-rose-500/30 transition-colors"
              >
                Weight Anomaly
              </button>
            </div>
            <button
              type="button"
              onClick={() => onSimulateAction('RESTORE_NOMINAL')}
              className="mt-2.5 w-full p-2 rounded bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-mono border border-emerald-500/30 transition-colors text-center"
            >
              Reset All Shelves to Nominal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
