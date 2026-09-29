import React from 'react';
import { Camera, TrendingDown, Layers, Scale, Cloud, RefreshCw } from 'lucide-react';
import type { AIModulesStatus } from '../types/index.js';

interface AIStatusPanelProps {
  modules: AIModulesStatus | null;
  onToggleModule: (key: keyof AIModulesStatus) => void;
  secondsUntilNextSync: number;
  lastUpdated: string | null;
}

export const AIStatusPanel: React.FC<AIStatusPanelProps> = ({
  modules,
  onToggleModule,
  secondsUntilNextSync,
  lastUpdated,
}) => {
  const currentModules: AIModulesStatus = modules || {
    product_recognition: true,
    low_stock_predictor: true,
    misplaced_scanner: true,
    weight_tamper_detection: true,
    cloud_sync: 'synced',
  };

  const items = [
    {
      key: 'product_recognition' as keyof AIModulesStatus,
      title: 'Product Recognition',
      subtitle: 'ESP32-Cam Visual Classifier',
      active: currentModules.product_recognition,
      icon: Camera,
      badge: 'ESP32-Cam',
    },
    {
      key: 'low_stock_predictor' as keyof AIModulesStatus,
      title: 'Low Stock Predictor',
      subtitle: 'Dynamic Run-rate Thresholds',
      active: currentModules.low_stock_predictor,
      icon: TrendingDown,
      badge: 'Predictive',
    },
    {
      key: 'misplaced_scanner' as keyof AIModulesStatus,
      title: 'Misplaced Product Scanner',
      subtitle: 'Shelf ID Optical Mapping',
      active: currentModules.misplaced_scanner,
      icon: Layers,
      badge: 'Cam + IR',
    },
    {
      key: 'weight_tamper_detection' as keyof AIModulesStatus,
      title: 'Weight Tamper Detection',
      subtitle: 'HX711 Load Cell Variance',
      active: currentModules.weight_tamper_detection,
      icon: Scale,
      badge: 'Load Cell',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Hardware-Coupled AI Monitoring Engines
          </h2>
          <span className="text-xs text-slate-500">· Click card to toggle engine</span>
        </div>

        {/* 5-second Refresh Stream Heartbeat & Cloud Sync */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-mono">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400 [animation-duration:5s]" />
            <span>5s Loop:</span>
            <span className="font-bold text-cyan-400">{secondsUntilNextSync}s</span>
          </div>

          <div className="h-3 w-px bg-slate-800"></div>

          {/* Cloud Sync status badge */}
          <button
            onClick={() => onToggleModule('cloud_sync')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border transition-colors ${
              currentModules.cloud_sync === 'synced'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                : 'bg-amber-950/40 border-amber-500/30 text-amber-400 animate-pulse'
            }`}
            title="Click to toggle sync simulation"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>Cloud Sync: {currentModules.cloud_sync === 'synced' ? 'Synced' : 'Syncing...'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggleModule(item.key)}
              className={`group relative flex flex-col justify-between p-3.5 rounded-lg border text-left transition-all ${
                item.active
                  ? 'border-cyan-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 hover:border-cyan-500/50 shadow-sm'
                  : 'border-slate-800 bg-slate-950/40 opacity-70 hover:opacity-100 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between w-full mb-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                    item.active
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-slate-500">{item.badge}</span>
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium font-mono ${
                      item.active
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700/50'
                    }`}
                  >
                    {item.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
              </div>

              {/* Status footer line */}
              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Toggle Mode</span>
                <span className={`font-mono ${item.active ? 'text-cyan-400' : 'text-slate-500'}`}>
                  {item.active ? 'Armed & Monitoring' : 'Bypassed'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
