import { useState, useEffect, useCallback, useRef } from 'react';
import { UserDashboard } from './components/UserDashboard.js';
import { Header } from './components/Header.js';
import { AIStatusPanel } from './components/AIStatusPanel.js';
import { DashboardView } from './components/DashboardView.js';
import { InventoryView } from './components/InventoryView.js';
import { AlertsView } from './components/AlertsView.js';
import { HardwareConsoleView } from './components/HardwareConsoleView.js';
import {
  fetchProducts,
  fetchSensors,
  fetchAlerts,
  fetchStatus,
  fetchMetrics,
  createProduct,
  updateProduct,
  deleteProduct,
  resolveAlert,
  resolveAllAlerts,
  toggleAIModule,
  setHardwareOnline,
  triggerSimulationAction,
  postSensorPayload,
  restockProduct,
  restockAllProducts,
  relocateAlert,
} from './services/api.js';
import type {
  Product,
  SensorData,
  Alert,
  SystemStatus,
  DashboardMetrics,
  AIModulesStatus,
} from './types/index.js';

import {
  FALLBACK_PRODUCTS,
  FALLBACK_SENSORS,
  FALLBACK_ALERTS,
  FALLBACK_STATUS,
  FALLBACK_METRICS,
} from './fallbackData.js';

export default function App() {
  // Mode switcher: Default to user's dashboard design!
  const [viewMode, setViewMode] = useState<'user' | 'industrial'>('user');
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'inventory' | 'alerts' | 'hardware'>('dashboard');
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [sensors, setSensors] = useState<Record<string, SensorData>>(FALLBACK_SENSORS);
  const [alerts, setAlerts] = useState<Alert[]>(FALLBACK_ALERTS);
  const [status, setStatus] = useState<SystemStatus | null>(FALLBACK_STATUS);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(FALLBACK_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 5-second dynamic refresh countdown timer
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState(5);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load all initial state with resilient graceful fallback
  const loadInitialData = useCallback(async () => {
    try {
      const [prodsData, sensorsData, alertsData, statusData, metricsData] = await Promise.all([
        fetchProducts().catch((err) => {
          console.warn('Fallback products:', err);
          return null;
        }),
        fetchSensors().catch(() => null),
        fetchAlerts().catch(() => null),
        fetchStatus().catch(() => null),
        fetchMetrics().catch(() => null),
      ]);

      if (prodsData && Array.isArray(prodsData) && prodsData.length > 0) {
        setProducts(prodsData);
      }
      if (sensorsData && Object.keys(sensorsData).length > 0) {
        setSensors(sensorsData);
      }
      if (alertsData && Array.isArray(alertsData)) {
        setAlerts(alertsData);
      }
      if (statusData) {
        setStatus(statusData);
      }
      if (metricsData) {
        setMetrics(metricsData);
      }

      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      console.error('Error fetching smart shelf data:', err);
      // Only set error message if we have no products loaded at all
      if (products.length === 0) {
        setError(err.message || 'Failed to sync with smart shelf backend');
      }
    } finally {
      setLoading(false);
    }
  }, [products.length]);

  // Set up real-time SSE stream with automatic 5s polling fallback
  useEffect(() => {
    loadInitialData();

    // 1. Establish SSE Server-Sent Events stream
    try {
      const es = new EventSource('/api/stream');
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.products) setProducts(payload.products);
          if (payload.sensors) setSensors(payload.sensors);
          if (payload.alerts) setAlerts(payload.alerts);
          if (payload.status) setStatus(payload.status);
          if (payload.metrics) setMetrics(payload.metrics);
          setLastUpdated(new Date().toLocaleTimeString());
          setSecondsUntilNextSync(5); // Reset sync countdown
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };

      es.onerror = () => {
        es.close();
      };
    } catch (err) {
      console.warn('SSE not supported or failed to connect, relying on 5s polling loop');
    }

    // 2. Guaranteed 5-second dynamic polling loop
    const pollingInterval = setInterval(() => {
      loadInitialData();
      setSecondsUntilNextSync(5);
    }, 5000);

    // 3. Countdown tick every 1 second
    const countdownInterval = setInterval(() => {
      setSecondsUntilNextSync((prev) => (prev > 1 ? prev - 1 : 5));
    }, 1000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(countdownInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loadInitialData]);

  // Actions
  const handleToggleAIModule = async (key: keyof AIModulesStatus) => {
    try {
      const res = await toggleAIModule(key);
      if (status) {
        setStatus({
          ...status,
          ai_modules: res.ai_modules,
        });
      }
    } catch (err: any) {
      console.error('Failed to toggle AI module:', err);
    }
  };

  const handleToggleHardware = async (online: boolean) => {
    try {
      await setHardwareOnline(online);
      await loadInitialData();
    } catch (err: any) {
      console.error('Failed to update hardware connection:', err);
    }
  };

  const handleCreateProduct = async (productData: Omit<Product, 'id' | 'created_at'>) => {
    await createProduct(productData);
    await loadInitialData();
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    await updateProduct(id, updates);
    await loadInitialData();
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProduct(id);
    await loadInitialData();
  };

  const handleResolveAlert = async (id: string) => {
    await resolveAlert(id);
    await loadInitialData();
  };

  const handleResolveAllAlerts = async () => {
    await resolveAllAlerts();
    await loadInitialData();
  };

  const handleRestockProduct = async (id: string, alertId?: string) => {
    await restockProduct(id);
    if (alertId) {
      await resolveAlert(alertId);
    }
    await loadInitialData();
  };

  const handleRestockAllProducts = async () => {
    await restockAllProducts();
    await loadInitialData();
  };

  const handleRelocateProduct = async (id: string, alertId?: string) => {
    if (alertId) {
      await relocateAlert(alertId);
    }
    await loadInitialData();
  };

  const handleSimulateAction = async (action: string, shelf_id?: string, extra?: any) => {
    try {
      await triggerSimulationAction(action, shelf_id, extra);
      await loadInitialData();
    } catch (err: any) {
      console.error('Failed to run simulation action:', err);
    }
  };

  const handlePostPayload = async (payload: Partial<SensorData> & { shelf_id: string }) => {
    await postSensorPayload(payload);
    await loadInitialData();
  };

  const activeAlertsCount = alerts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="relative">
      {/* Floating Theme / View Switcher (Fixed Top Right) */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-full border border-slate-700 shadow-lg text-xs font-sans">
        <span className="text-[11px] text-slate-400 font-medium px-2">Theme:</span>
        <button
          type="button"
          onClick={() => setViewMode('user')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            viewMode === 'user'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Your Dashboard Design
        </button>
        <button
          type="button"
          onClick={() => setViewMode('industrial')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            viewMode === 'industrial'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Industrial IoT Console
        </button>
      </div>

      {/* VIEW 1: USER'S DASHBOARD DESIGN (ACTIVE BY DEFAULT) */}
      {viewMode === 'user' ? (
        <UserDashboard
          products={products}
          sensors={sensors}
          alerts={alerts}
          status={status}
          metrics={metrics}
          onCreateProduct={handleCreateProduct}
          onDeleteProduct={handleDeleteProduct}
          onRestockProduct={handleRestockProduct}
          onRestockAllProducts={handleRestockAllProducts}
          onRelocateProduct={handleRelocateProduct}
          onResolveAlert={handleResolveAlert}
          onResolveAllAlerts={handleResolveAllAlerts}
          onToggleHardware={handleToggleHardware}
          onSimulateAction={handleSimulateAction}
        />
      ) : (
        /* VIEW 2: INDUSTRIAL IOT CONSOLE VIEW */
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Header
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            status={status}
            onToggleHardware={handleToggleHardware}
            unresolvedAlertsCount={activeAlertsCount}
          />

          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <AIStatusPanel
              modules={status?.ai_modules || null}
              onToggleModule={handleToggleAIModule}
              secondsUntilNextSync={secondsUntilNextSync}
              lastUpdated={lastUpdated}
            />

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => loadInitialData()}
                  className="font-mono text-cyan-400 underline hover:text-cyan-300 ml-3"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {currentTab === 'dashboard' && (
              <DashboardView
                products={products}
                sensors={sensors}
                alerts={alerts}
                metrics={metrics}
                onResolveAlert={handleResolveAlert}
                onSimulateAction={handleSimulateAction}
                onNavigateToTab={setCurrentTab}
              />
            )}

            {currentTab === 'inventory' && (
              <InventoryView
                products={products}
                alerts={alerts}
                onCreateProduct={handleCreateProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsView
                alerts={alerts}
                products={products}
                sensors={sensors}
                onResolveAlert={handleResolveAlert}
                onResolveAllAlerts={handleResolveAllAlerts}
                onSimulateAction={handleSimulateAction}
              />
            )}

            {currentTab === 'hardware' && (
              <HardwareConsoleView
                sensors={sensors}
                products={products}
                onPostPayload={handlePostPayload}
                onSimulateAction={handleSimulateAction}
                isHardwareOnline={status?.hardware_online ?? true}
              />
            )}
          </main>

          <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
            <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>Smart Shelf IoT Gateway · ESP32-Cam + HX711 + IR Telemetry</span>
              <span>5-Second Polling & SSE Real-time Feed</span>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
