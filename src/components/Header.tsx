import React from 'react';
import { Radio, Wifi, WifiOff } from 'lucide-react';
import type { SystemStatus } from '../types/index.js';

interface HeaderProps {
  currentTab: 'dashboard' | 'inventory' | 'alerts' | 'hardware';
  setCurrentTab: (tab: 'dashboard' | 'inventory' | 'alerts' | 'hardware') => void;
  status: SystemStatus | null;
  onToggleHardware: (online: boolean) => void;
  unresolvedAlertsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  status,
  onToggleHardware,
  unresolvedAlertsCount,
}) => {
  const isOnline = status?.hardware_online ?? true;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Wordmark (Single text element) */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setCurrentTab('dashboard');
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white hover:text-cyan-400 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
            <span>Smart Shelf System</span>
          </a>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'dashboard'
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>

          <button
            onClick={() => setCurrentTab('inventory')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'inventory'
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Inventory
          </button>

          <button
            onClick={() => setCurrentTab('alerts')}
            className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'alerts'
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Alerts & Anomalies</span>
            {unresolvedAlertsCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-rose-500/20 px-1.5 py-0.2 text-xs font-mono font-bold text-rose-400 border border-rose-500/40">
                {unresolvedAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('hardware')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              currentTab === 'hardware'
                ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-px'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            IoT Console
          </button>
        </nav>

        {/* Zone 3: Hardware Connection State Indicator (Top-Right Corner) */}
        <div className="flex items-center gap-3">
          {/* Real-time Hardware Status Badge */}
          <div
            title={`IoT Hardware: ${isOnline ? 'Active pinging every 5s' : 'Disconnected / Offline'}`}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono font-semibold tracking-wider transition-colors ${
              isOnline
                ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-950/70 border-rose-500/40 text-rose-400 shadow-rose-950/50 shadow-sm'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {isOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              ></span>
            </span>
            <span className="font-bold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          {/* Quick Hardware Connection Simulator Toggle */}
          <button
            type="button"
            onClick={() => onToggleHardware(!isOnline)}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              isOnline
                ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                : 'border-emerald-600/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
            }`}
            title="Toggle ESP32 hardware connection to test online/offline state"
          >
            {isOnline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-slate-400" />
                <span>Simulate Offline</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>Reconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
