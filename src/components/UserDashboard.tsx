import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Product, SensorData, Alert, SystemStatus, DashboardMetrics } from '../types/index.js';
import { WebcamProductCounterModal } from './WebcamProductCounterModal.js';

interface UserDashboardProps {
  products: Product[];
  sensors: Record<string, SensorData>;
  alerts: Alert[];
  status: SystemStatus | null;
  metrics: DashboardMetrics | null;
  onCreateProduct: (product: Omit<Product, 'id' | 'created_at'>) => Promise<void>;
  onDeleteProduct?: (id: string) => Promise<void>;
  onRestockProduct: (productId: string, alertId?: string) => Promise<void>;
  onRestockAllProducts: () => Promise<void>;
  onRelocateProduct: (productId: string, alertId?: string) => Promise<void>;
  onResolveAlert: (alertId: string) => Promise<void>;
  onResolveAllAlerts: () => Promise<void>;
  onToggleHardware: (online: boolean) => Promise<void>;
  onSimulateAction: (action: string, shelf_id?: string, extra?: any) => Promise<void>;
}

// Emoji icon mapping matching user's HTML specification
const PRODUCT_ICONS: Record<string, string> = {
  milk: '🥛',
  biscuits: '🍪',
  shampoo: '🧴',
  rice: '🍚',
  juice: '🧃',
  soap: '🧼',
};

function getProductIcon(nameOrId: string): string {
  const lower = nameOrId.toLowerCase();
  for (const [key, icon] of Object.entries(PRODUCT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📦';
}

function timeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hr ago';
  return `${hours} hrs ago`;
}

interface ToastMessage {
  id: number;
  msg: string;
  type: 'normal' | 'success' | 'info';
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  products,
  sensors,
  alerts,
  status,
  metrics,
  onCreateProduct,
  onDeleteProduct,
  onRestockProduct,
  onRestockAllProducts,
  onRelocateProduct,
  onResolveAlert,
  onResolveAllAlerts,
  onToggleHardware,
  onSimulateAction,
}) => {
  const [currentSection, setCurrentSection] = useState<'dashboard' | 'inventory' | 'alerts' | 'sensors' | 'camera'>('dashboard');
  const [selectedShelfForCam, setSelectedShelfForCam] = useState<string>('Aisle 3 · Rack B');
  const [isMisplaceSimulating, setIsMisplaceSimulating] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modal state for adding a product directly into the database
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHardwareGuideOpen, setIsHardwareGuideOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Optical AI Product Counter State
  const [isAiCounting, setIsAiCounting] = useState(false);
  const [aiCountResult, setAiCountResult] = useState<{
    count: number;
    confidence: number;
    detected_product: string;
    is_misplaced: boolean;
    misplaced_item_name?: string;
    notes: string;
  } | null>(null);
  const [isWebcamModalOpen, setIsWebcamModalOpen] = useState(false);
  const [manualCountInput, setManualCountInput] = useState<string>('');

  // In-Place Device Webcam Feed State (Direct live camera inside viewfinder)
  const [isLiveWebcamActive, setIsLiveWebcamActive] = useState<boolean>(false);
  const [webcamPermissionStatus, setWebcamPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'error' | null>(null);
  const [webcamErrorMessage, setWebcamErrorMessage] = useState<string | null>(null);
  const liveVideoFeedRef = useRef<HTMLVideoElement | null>(null);
  const liveMediaStreamRef = useRef<MediaStream | null>(null);

  // Stop live camera stream on unmount or when toggled off
  useEffect(() => {
    return () => {
      if (liveMediaStreamRef.current) {
        liveMediaStreamRef.current.getTracks().forEach((t) => t.stop());
        liveMediaStreamRef.current = null;
      }
    };
  }, []);

  const toggleLiveWebcam = async () => {
    if (isLiveWebcamActive) {
      if (liveMediaStreamRef.current) {
        liveMediaStreamRef.current.getTracks().forEach((t) => t.stop());
        liveMediaStreamRef.current = null;
      }
      setIsLiveWebcamActive(false);
      setWebcamPermissionStatus(null);
      showToast('Live webcam turned off', 'info');
      return;
    }

    try {
      setWebcamErrorMessage(null);
      showToast('Requesting webcam permission...', 'info');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setWebcamPermissionStatus('denied');
        setWebcamErrorMessage('Webcam access is restricted by your browser. Please allow camera permissions or click "Open Webcam & Count" to upload/take a photo.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      liveMediaStreamRef.current = stream;
      setWebcamPermissionStatus('granted');
      setIsLiveWebcamActive(true);

      if (liveVideoFeedRef.current) {
        liveVideoFeedRef.current.srcObject = stream;
        await liveVideoFeedRef.current.play().catch(() => {});
      }
      showToast('Webcam access granted! Live feed active in viewfinder.', 'success');
    } catch (err: any) {
      console.warn('Webcam permission error:', err);
      setWebcamPermissionStatus('denied');
      const msg = err.name === 'NotAllowedError'
        ? 'Permission was denied. Click the lock/camera icon in your address bar to allow camera access.'
        : `Camera error: ${err.message || 'Unable to access device webcam'}`;
      setWebcamErrorMessage(msg);
      showToast(msg, 'normal');
    }
  };
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category: 'Dairy',
    shelf_position: 'Aisle 1 · Rack B',
    expected_weight_g: 500,
    min_threshold: 4,
    current_stock: 12,
    max_capacity: 20,
    image_url: '/src/assets/images/shelf_prod_milk_1790616054203.jpg',
  });

  const showToast = (msg: string, type: 'normal' | 'success' | 'info' = 'normal') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  const isOnline = status?.hardware_online ?? true;
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'ACTIVE'), [alerts]);

  // Metric counts matching user's logic
  const lowStockCount = useMemo(
    () => products.filter((p) => p.current_stock <= p.min_threshold).length,
    [products]
  );
  const misplacedCount = useMemo(
    () => activeAlerts.filter((a) => a.alert_type === 'MISPLACED').length,
    [activeAlerts]
  );
  const totalProductsCount = products.length;

  // Filtered alerts for the Alerts section
  const filteredAlerts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return activeAlerts.filter((a) => {
      const cat =
        a.alert_type === 'LOW_STOCK'
          ? 'low'
          : a.alert_type === 'MISPLACED'
          ? 'misplaced'
          : a.alert_type === 'TAMPERING'
          ? 'tampering'
          : 'other';

      const matchFilter = currentFilter === 'all' || cat === currentFilter;
      const matchSearch =
        !query ||
        a.product_name.toLowerCase().includes(query) ||
        a.shelf_id.toLowerCase().includes(query) ||
        a.alert_type.toLowerCase().includes(query) ||
        a.message.toLowerCase().includes(query);

      return matchFilter && matchSearch;
    });
  }, [activeAlerts, currentFilter, searchQuery]);

  // Handlers wrapped with Toast notifications
  const handleRestock = async (productId: string, alertId?: string) => {
    const prod = products.find((p) => p.id === productId);
    await onRestockProduct(productId, alertId);
    showToast(
      `Restocked ${prod ? prod.name : 'Product'} to full capacity (${prod?.max_capacity ?? 20} units)!`,
      'success'
    );
  };

  const handleRestockAll = async () => {
    await onRestockAllProducts();
    showToast('All products restocked to full capacity!', 'success');
  };

  const handleRelocate = async (productId: string, alertId?: string) => {
    const prod = products.find((p) => p.id === productId);
    await onRelocateProduct(productId, alertId);
    showToast(`Relocated ${prod ? prod.name : 'Product'} back to standard aisle location!`, 'info');
  };

  const handleResolve = async (alertId: string) => {
    const targetAlert = alerts.find((a) => a.id === alertId);
    await onResolveAlert(alertId);
    showToast(`Resolved alert for ${targetAlert ? targetAlert.product_name : 'product'}.`, 'normal');
  };

  const handleResolveAll = async () => {
    await onResolveAllAlerts();
    showToast('All product alerts resolved!', 'success');
  };

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#1f2937]">
      {/* 1. SIDEBAR */}
      <aside className="user-sidebar">
        <div className="user-logo">
          <h2>🛒 SmartShelf</h2>
          <p>AI Retail Monitoring</p>
        </div>

        <div className="user-menu">
          <button
            type="button"
            className={currentSection === 'dashboard' ? 'active' : ''}
            onClick={() => setCurrentSection('dashboard')}
          >
            📊 <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={currentSection === 'inventory' ? 'active' : ''}
            onClick={() => setCurrentSection('inventory')}
          >
            📦 <span>Inventory</span>
          </button>

          <button
            type="button"
            className={currentSection === 'alerts' ? 'active' : ''}
            onClick={() => setCurrentSection('alerts')}
          >
            🚨 <span>Alerts</span>
            {activeAlerts.length > 0 && (
              <span className="user-menu-badge" id="menuAlertsBadge">
                {activeAlerts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={currentSection === 'sensors' ? 'active' : ''}
            onClick={() => setCurrentSection('sensors')}
          >
            ⚙️ <span>Sensors</span>
          </button>

          <button
            type="button"
            className={currentSection === 'camera' ? 'active' : ''}
            onClick={() => setCurrentSection('camera')}
          >
            📷 <span>ESP32-Cam Live</span>
          </button>
        </div>

        {/* Quick simulation helper at sidebar bottom */}
        <div className="mt-auto pt-4 border-t border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center justify-between mb-2">
            <span>Hardware Tick:</span>
            <span className="font-mono text-cyan-400">5s Loop</span>
          </div>
          <button
            type="button"
            onClick={() => onSimulateAction('PICK_ITEM', 'Aisle 1 · Rack A')}
            className="w-full mb-1.5 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-left"
          >
            ⚡ Test Customer Pick
          </button>
          <button
            type="button"
            onClick={() => onSimulateAction('TAMPER', 'Aisle 2 · Rack A', { extra_weight_g: -1800 })}
            className="w-full py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-left"
          >
            ⚡ Test Weight Anomaly
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <main className="user-main">
        {/* Topbar */}
        <header className="user-topbar">
          <div>
            <h1>AI Smart Retail Shelf</h1>
            <p>Real-time product & shelf monitoring system</p>
          </div>

          <div
            className="user-status"
            onClick={() => onToggleHardware(!isOnline)}
            title="Click to toggle simulated hardware online/offline connection"
          >
            <span>{isOnline ? '🟢' : '🔴'} System</span>{' '}
            <span className={isOnline ? 'online' : 'offline'}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </header>

        {/* SECTION 1: DASHBOARD */}
        {currentSection === 'dashboard' && (
          <div id="dashboard" className="space-y-6">
            {/* 4 Metric Cards */}
            <div className="user-cards">
              <div className="user-card" onClick={() => setCurrentSection('inventory')}>
                <div className="user-card-title">Total Products</div>
                <div className="user-card-value">{totalProductsCount}</div>
                <div className="user-card-small c-blue">Across all shelves</div>
              </div>

              <div className="user-card" onClick={() => setCurrentSection('alerts')}>
                <div className="user-card-title">Low Stock Products</div>
                <div className="user-card-value c-yellow">{lowStockCount}</div>
                <div className="user-card-small c-yellow">Needs restock</div>
              </div>

              <div className="user-card" onClick={() => setCurrentSection('alerts')}>
                <div className="user-card-title">Misplaced Products</div>
                <div className="user-card-value c-red">{misplacedCount}</div>
                <div className="user-card-small c-red">AI camera detected</div>
              </div>

              <div className="user-card" onClick={() => setCurrentSection('alerts')}>
                <div className="user-card-title">Active Product Alerts</div>
                <div className="user-card-value c-red">{activeAlerts.length}</div>
                <div className="user-card-small c-red">Requires action</div>
              </div>
            </div>

            {/* Content Grid (2fr 1fr) */}
            <div className="user-content">
              {/* Left Column (2fr): Live Shelf Status & Live Shelf Sensor Data */}
              <div>
                {/* Live Shelf Status */}
                <div className="user-panel">
                  <h2>📦 Live Shelf Status</h2>

                  <div className="user-shelf">
                    {products.map((prod) => {
                      const icon = getProductIcon(prod.name);
                      const isCritical = prod.current_stock <= 2;
                      const isLow = prod.current_stock <= prod.min_threshold;
                      const sensor = sensors[prod.shelf_position];
                      const activeProductAlert = activeAlerts.find(
                        (a) => a.shelf_id === prod.shelf_position || a.product_id === prod.id
                      );

                      let badgeClass = 'user-badge green-bg';
                      let badgeText = 'Normal';

                      if (activeProductAlert?.alert_type === 'TAMPERING') {
                        badgeClass = 'user-badge yellow-bg';
                        badgeText = 'Tampering';
                      } else if (isCritical) {
                        badgeClass = 'user-badge red-bg';
                        badgeText = 'Critical';
                      } else if (isLow) {
                        badgeClass = 'user-badge yellow-bg';
                        badgeText = 'Low Stock';
                      }

                      const pct = Math.min(100, Math.round((prod.current_stock / prod.max_capacity) * 100));

                      return (
                        <div key={prod.id} className="user-shelf-item">
                          <div className="user-shelf-item-header">
                            <div className="user-product-icon">{icon}</div>
                            <span className={badgeClass}>{badgeText}</span>
                          </div>
                          <div className="user-product-name">{prod.name}</div>
                          <div className="text-sm text-slate-700">
                            Stock: <strong>{prod.current_stock}</strong> / {prod.max_capacity}
                          </div>
                          <div className="user-stock-bar">
                            <div
                              className={`user-stock-fill ${
                                isCritical ? 'critical' : isLow ? 'low' : ''
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="user-stock-text flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                            <span>{prod.shelf_position}</span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShelfForCam(prod.shelf_position);
                                setCurrentSection('camera');
                              }}
                              className="text-[11px] font-mono text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1 font-semibold"
                              title="Click to view ESP32-Cam live video stream for this shelf"
                            >
                              📷 Cam: {sensor?.cam_detected_label ? '98%' : 'Live'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Shelf Sensor Data Table */}
                <div className="user-panel">
                  <h2>⚙️ Live Shelf Sensor Data</h2>

                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>Sensor ID</th>
                        <th>Monitored Product</th>
                        <th>Live Reading</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((prod, idx) => {
                        const sensor = sensors[prod.shelf_position];
                        const icon = getProductIcon(prod.name);
                        const weightKg = sensor
                          ? (sensor.load_cell_weight_g / 1000).toFixed(2) + ' kg'
                          : ((prod.current_stock * prod.expected_weight_g) / 1000).toFixed(2) + ' kg';

                        const isCritical = prod.current_stock <= 2;
                        const isLow = prod.current_stock <= prod.min_threshold;
                        const activeProductAlert = activeAlerts.find(
                          (a) => a.shelf_id === prod.shelf_position || a.product_id === prod.id
                        );

                        return (
                          <tr key={prod.id}>
                            <td>
                              {idx % 2 === 0
                                ? `Weight Sensor - A${idx + 1}`
                                : `Weight Sensor - B${idx + 1}`}
                            </td>
                            <td>
                              {icon} {prod.name} ({prod.shelf_position})
                            </td>
                            <td>{weightKg}</td>
                            <td>
                              {activeProductAlert ? (
                                <span
                                  className={
                                    activeProductAlert.severity === 'CRITICAL'
                                      ? 'user-badge red-bg'
                                      : 'user-badge yellow-bg'
                                  }
                                >
                                  {activeProductAlert.alert_type === 'LOW_STOCK'
                                    ? 'Low Weight'
                                    : activeProductAlert.alert_type}
                                </span>
                              ) : isLow ? (
                                <span className="user-badge yellow-bg">Low Weight</span>
                              ) : (
                                <span className="user-badge green-bg">Normal</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column (1fr): Recent Product Alerts & AI Monitoring Status */}
              <div>
                {/* Recent Alerts Panel */}
                <div className="user-panel">
                  <div className="flex justify-between items-center mb-4">
                    <h2>🚨 Recent Product Alerts</h2>
                    <button
                      type="button"
                      className="user-btn-sm user-btn-outline-resolve"
                      onClick={() => setCurrentSection('alerts')}
                    >
                      View All ({activeAlerts.length})
                    </button>
                  </div>

                  <div id="dashboardAlertsList">
                    {activeAlerts.length === 0 ? (
                      <div className="text-center py-5 text-emerald-600 font-medium">
                        🎉 All product alerts resolved! Shelves operating normally.
                      </div>
                    ) : (
                      activeAlerts.slice(0, 4).map((alert, idx) => {
                        const icon = getProductIcon(alert.product_name);
                        const severityClass =
                          alert.severity === 'CRITICAL'
                            ? 'danger'
                            : alert.alert_type === 'MISPLACED'
                            ? 'info'
                            : 'low';

                        const actionType =
                          alert.alert_type === 'LOW_STOCK'
                            ? 'restock'
                            : alert.alert_type === 'MISPLACED'
                            ? 'relocate'
                            : 'resolve';

                        return (
                          <div key={`${alert.id}-${alert.alert_type}-${idx}`} className={`user-alert ${severityClass}`}>
                            <div className="user-alert-product-avatar">{icon}</div>
                            <div className="user-alert-content">
                              <div className="user-alert-header">
                                <div className="user-alert-product-title">
                                  <span className="user-alert-product-name">
                                    {alert.product_name}
                                  </span>
                                  <span className="user-alert-type-badge">
                                    {alert.alert_type.replace('_', ' ')}
                                  </span>
                                </div>
                                <span className="user-alert-time">{timeAgo(alert.created_at)}</span>
                              </div>
                              <div className="user-alert-desc">{alert.message}</div>
                              <div className="user-alert-meta">
                                <span className="user-location-pill">📍 {alert.shelf_id}</span>
                                {actionType === 'restock' && alert.product_id && (
                                  <button
                                    type="button"
                                    className="user-btn-sm user-btn-restock"
                                    onClick={() => handleRestock(alert.product_id!, alert.id)}
                                  >
                                    ⚡ Restock {alert.product_name}
                                  </button>
                                )}
                                {actionType === 'relocate' && alert.product_id && (
                                  <button
                                    type="button"
                                    className="user-btn-sm user-btn-relocate"
                                    onClick={() => handleRelocate(alert.product_id!, alert.id)}
                                  >
                                    🗺️ Relocate
                                  </button>
                                )}
                                {actionType === 'resolve' && (
                                  <button
                                    type="button"
                                    className="user-btn-sm user-btn-outline-resolve"
                                    onClick={() => handleResolve(alert.id)}
                                  >
                                    ✓ Resolve
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

                {/* AI Monitoring Status */}
                <div className="user-panel">
                  <h2>🤖 AI Monitoring Status</h2>

                  <p className="mb-4 flex justify-between">
                    <span>Product Recognition</span>
                    <strong className="c-green">Active</strong>
                  </p>

                  <p className="mb-4 flex justify-between">
                    <span>Low-Stock Predictor</span>
                    <strong className="c-green">Active</strong>
                  </p>

                  <p className="mb-4 flex justify-between">
                    <span>Misplaced Product Scanner</span>
                    <strong className="c-green">Active</strong>
                  </p>

                  <p className="mb-4 flex justify-between">
                    <span>Weight Tamper Detection</span>
                    <strong className="c-green">Active</strong>
                  </p>

                  <p className="flex justify-between">
                    <span>Cloud Sync</span>
                    <strong className="c-green">Connected</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: INVENTORY */}
        {currentSection === 'inventory' && (
          <div id="inventory" className="space-y-6">
            <div className="user-panel">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <div>
                  <h2>📦 Product Inventory & Shelf Allocation</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage products, adjust stock parameters, and register new items to database.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="user-action-btn"
                    style={{ background: '#16a34a' }}
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    ➕ Add Product to Database
                  </button>
                  <button type="button" className="user-action-btn" onClick={handleRestockAll}>
                    ⚡ Restock All Items
                  </button>
                </div>
              </div>

              <table className="user-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Current Stock</th>
                    <th>Alert Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod) => {
                    const icon = getProductIcon(prod.name);
                    const isCritical = prod.current_stock <= 2;
                    const isLow = prod.current_stock <= prod.min_threshold;
                    const activeProductAlert = activeAlerts.find(
                      (a) => a.shelf_id === prod.shelf_position || a.product_id === prod.id
                    );

                    let badgeClass = 'user-badge green-bg';
                    let statusText = 'Available';

                    if (isCritical) {
                      badgeClass = 'user-badge red-bg';
                      statusText = 'Critical';
                    } else if (isLow) {
                      badgeClass = 'user-badge yellow-bg';
                      statusText = 'Low Stock';
                    }

                    return (
                      <tr key={prod.id}>
                        <td>
                          <strong>
                            {icon} {prod.name}
                          </strong>
                        </td>
                        <td>{prod.shelf_position}</td>
                        <td>
                          <strong>{prod.current_stock}</strong> / {prod.max_capacity}
                        </td>
                        <td>
                          <span className={badgeClass}>{statusText}</span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="user-action-btn"
                              onClick={() => handleRestock(prod.id)}
                            >
                              ⚡ Restock
                            </button>
                            {onDeleteProduct && (
                              <button
                                type="button"
                                className="user-btn-sm user-btn-outline-resolve"
                                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                                onClick={async () => {
                                  if (window.confirm(`Delete ${prod.name} from shelf database?`)) {
                                    await onDeleteProduct(prod.id);
                                    showToast(`Deleted ${prod.name} from database`, 'info');
                                  }
                                }}
                                title="Delete product"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ADD PRODUCT MODAL */}
            {isAddModalOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}
              >
                <div
                  className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl text-slate-800"
                  style={{ maxHeight: '90vh', overflowY: 'auto' }}
                >
                  <div className="flex items-center justify-between border-b pb-3 mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        📦 Add Product to Shelf Database
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Writes directly to PostgreSQL / JSON database with IoT sensor telemetry.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newProductForm.name.trim()) return;
                      setIsSubmitting(true);
                      try {
                        await onCreateProduct({
                          name: newProductForm.name.trim(),
                          category: newProductForm.category.trim(),
                          shelf_position: newProductForm.shelf_position.trim(),
                          expected_weight_g: Number(newProductForm.expected_weight_g),
                          min_threshold: Number(newProductForm.min_threshold),
                          current_stock: Number(newProductForm.current_stock),
                          max_capacity: Number(newProductForm.max_capacity),
                          image_url: newProductForm.image_url,
                        });
                        setIsAddModalOpen(false);
                        showToast(`Successfully added "${newProductForm.name}" to database!`, 'success');
                        setNewProductForm({
                          name: '',
                          category: 'Dairy',
                          shelf_position: 'Aisle 1 · Rack B',
                          expected_weight_g: 500,
                          min_threshold: 4,
                          current_stock: 12,
                          max_capacity: 20,
                          image_url: '/src/assets/images/shelf_prod_milk_1790616054203.jpg',
                        });
                      } catch (err: any) {
                        showToast(`Failed to add product: ${err.message}`, 'normal');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    className="space-y-4 text-xs font-sans"
                  >
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newProductForm.name}
                        onChange={(e) =>
                          setNewProductForm({ ...newProductForm, name: e.target.value })
                        }
                        placeholder="e.g. Greek Yogurt 500g"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Category
                        </label>
                        <select
                          value={newProductForm.category}
                          onChange={(e) =>
                            setNewProductForm({ ...newProductForm, category: e.target.value })
                          }
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none bg-white"
                        >
                          <option value="Dairy">Dairy & Chilled</option>
                          <option value="Snacks">Snacks & Biscuits</option>
                          <option value="Personal Care">Personal Care</option>
                          <option value="Grains">Grains & Pantry</option>
                          <option value="Beverages">Beverages & Juices</option>
                          <option value="Dry Goods">Dry Goods & Cereals</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Shelf Location ID *
                        </label>
                        <input
                          type="text"
                          required
                          value={newProductForm.shelf_position}
                          onChange={(e) =>
                            setNewProductForm({ ...newProductForm, shelf_position: e.target.value })
                          }
                          placeholder="e.g. Aisle 7 · Rack A"
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Unit Weight (g)
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newProductForm.expected_weight_g}
                          onChange={(e) =>
                            setNewProductForm({
                              ...newProductForm,
                              expected_weight_g: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Initial Stock
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={newProductForm.current_stock}
                          onChange={(e) =>
                            setNewProductForm({
                              ...newProductForm,
                              current_stock: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">
                          Min Alert Threshold
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newProductForm.min_threshold}
                          onChange={(e) =>
                            setNewProductForm({
                              ...newProductForm,
                              min_threshold: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t pt-4 mt-4">
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(false)}
                        className="user-btn-sm user-btn-outline-resolve"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="user-action-btn"
                        style={{ background: '#16a34a' }}
                      >
                        {isSubmitting ? 'Saving to Database...' : '💾 Save to Database'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: ALERT MANAGEMENT PAGE */}
        {currentSection === 'alerts' && (
          <div id="alerts" className="space-y-6">
            <div className="user-panel">
              <div className="flex justify-between items-center mb-5 flex-wrap gap-3">
                <div>
                  <h2 className="mb-1">🚨 Product Alert Management Center</h2>
                  <p className="text-sm text-slate-500">
                    Monitor, restock, and resolve all product stock, location, and tampering alerts
                  </p>
                </div>
                <button
                  type="button"
                  className="user-btn-sm user-btn-outline-resolve"
                  onClick={handleResolveAll}
                >
                  ✓ Resolve All Clear
                </button>
              </div>

              {/* SEARCH & FILTER TOOLBAR */}
              <div className="user-alert-toolbar">
                <div className="user-search-box">
                  <span className="user-search-icon">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product name, aisle, or alert type..."
                  />
                </div>

                <div className="user-filter-pills">
                  <button
                    type="button"
                    className={`user-filter-pill ${currentFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('all')}
                  >
                    All Products ({activeAlerts.length})
                  </button>
                  <button
                    type="button"
                    className={`user-filter-pill ${currentFilter === 'low' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('low')}
                  >
                    Low Stock (
                    {activeAlerts.filter((a) => a.alert_type === 'LOW_STOCK').length})
                  </button>
                  <button
                    type="button"
                    className={`user-filter-pill ${currentFilter === 'misplaced' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('misplaced')}
                  >
                    Misplaced (
                    {activeAlerts.filter((a) => a.alert_type === 'MISPLACED').length})
                  </button>
                  <button
                    type="button"
                    className={`user-filter-pill ${currentFilter === 'tampering' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('tampering')}
                  >
                    Tampering (
                    {activeAlerts.filter((a) => a.alert_type === 'TAMPERING').length})
                  </button>
                </div>
              </div>

              {/* FULL ALERTS LIST CONTAINER */}
              <div id="fullAlertsList">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-10 bg-[#f9fafb] rounded-xl text-slate-500">
                    <div className="text-4xl mb-2">✅</div>
                    <h3 className="text-slate-900 font-bold mb-1">No Product Alerts Found</h3>
                    <p>No product issues match your current filter or search criteria.</p>
                  </div>
                ) : (
                    filteredAlerts.map((alert, idx) => {
                    const prod = products.find((p) => p.id === alert.product_id);
                    const currentStock = prod ? prod.current_stock : alert.metadata?.current_stock;
                    const maxStock = prod ? prod.max_capacity : 20;
                    const icon = getProductIcon(alert.product_name);

                    const severityClass =
                      alert.severity === 'CRITICAL'
                        ? 'danger'
                        : alert.alert_type === 'MISPLACED'
                        ? 'info'
                        : 'low';

                    const actionType =
                      alert.alert_type === 'LOW_STOCK'
                        ? 'restock'
                        : alert.alert_type === 'MISPLACED'
                        ? 'relocate'
                        : 'resolve';

                    return (
                      <div key={`${alert.id}-${alert.alert_type}-${idx}`} className={`user-alert ${severityClass}`}>
                        <div className="user-alert-product-avatar">{icon}</div>
                        <div className="user-alert-content">
                          <div className="user-alert-header">
                            <div className="user-alert-product-title">
                              <span className="user-alert-product-name">
                                {alert.product_name}
                              </span>
                              <span className="user-alert-type-badge">
                                {alert.alert_type.replace('_', ' ')}
                              </span>
                            </div>
                            <span className="user-alert-time">🕒 {timeAgo(alert.created_at)}</span>
                          </div>
                          <div className="user-alert-desc">{alert.message}</div>
                          <div className="user-alert-meta">
                            <span className="user-location-pill">📍 {alert.shelf_id}</span>
                            {currentStock !== undefined && (
                              <span className="user-stock-pill">
                                📦 Stock: <strong>{currentStock}</strong> / {maxStock}
                              </span>
                            )}
                          </div>
                          <div className="user-alert-actions">
                            {actionType === 'restock' && alert.product_id && (
                              <button
                                type="button"
                                className="user-btn-sm user-btn-restock"
                                onClick={() => handleRestock(alert.product_id!, alert.id)}
                              >
                                ⚡ Restock {alert.product_name}
                              </button>
                            )}
                            {actionType === 'relocate' && alert.product_id && (
                              <button
                                type="button"
                                className="user-btn-sm user-btn-relocate"
                                onClick={() => handleRelocate(alert.product_id!, alert.id)}
                              >
                                🗺️ Relocate to Correct Shelf
                              </button>
                            )}
                            <button
                              type="button"
                              className="user-btn-sm user-btn-outline-resolve"
                              onClick={() => handleResolve(alert.id)}
                            >
                              ✓ Resolve Alert
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: SENSOR PAGE */}
        {currentSection === 'sensors' && (
          <div id="sensors" className="space-y-6">
            <div className="user-panel">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2>⚙️ Shelf Sensor & Camera Hardware</h2>
                <div className="text-xs font-mono text-slate-500">
                  Transmitting every 5 seconds over HTTP / SSE
                </div>
              </div>

              <table className="user-table">
                <thead>
                  <tr>
                    <th>Sensor ID</th>
                    <th>Type</th>
                    <th>Target Product</th>
                    <th>Live Reading</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((prod, idx) => {
                    const sensor = sensors[prod.shelf_position];
                    const icon = getProductIcon(prod.name);
                    const weightKg = sensor
                      ? (sensor.load_cell_weight_g / 1000).toFixed(2) + ' kg'
                      : ((prod.current_stock * prod.expected_weight_g) / 1000).toFixed(2) + ' kg';

                    const sensorId =
                      idx === 0 ? 'SL-A1' : idx === 1 ? 'SL-B3' : idx === 2 ? 'IR-C1' : `CAM-0${idx}`;
                    const sensorType =
                      idx === 2 ? 'IR Sensor' : idx === 3 ? 'AI Vision Camera' : 'Load Cell';
                    const activeAlert = activeAlerts.find(
                      (a) => a.shelf_id === prod.shelf_position || a.product_id === prod.id
                    );

                    let statusText = 'Online';
                    let badgeClass = 'user-badge green-bg';
                    let liveReading = weightKg;

                    if (idx === 2) {
                      liveReading = prod.current_stock <= 2 ? 'Empty Slot Warning' : 'Slot Occupied';
                    } else if (idx === 3) {
                      liveReading = 'AI Active';
                    }

                    if (activeAlert) {
                      statusText = 'Alert';
                      badgeClass = 'user-badge red-bg';
                    }

                    return (
                      <tr key={prod.id}>
                        <td>{sensorId}</td>
                        <td>{sensorType}</td>
                        <td>
                          {icon} {prod.name} ({prod.shelf_position.split('·')[0].trim()})
                        </td>
                        <td>{liveReading}</td>
                        <td>
                          <span className={badgeClass}>{statusText}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 5: ESP32-CAM LIVE MONITORING PAGE */}
        {currentSection === 'camera' && (
          <div id="camera" className="space-y-6">
            {/* Header and Shelf Selector */}
            <div className="user-panel">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="flex items-center gap-2 mb-1">
                    <span>📷</span> ESP32-Cam Live Optical Monitoring
                  </h2>
                  <p className="text-xs text-slate-500">
                    Real-time AI edge camera classification, item count verification, and misplaced item detection.
                  </p>
                </div>

                {/* Quick Shelf Camera Selector Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsHardwareGuideOpen(true)}
                    className="user-action-btn flex items-center gap-1.5"
                    style={{ background: '#2563eb' }}
                  >
                    🔌 Connect Your Physical ESP32-Cam
                  </button>

                  <span className="text-xs text-slate-500 font-semibold ml-2">Active Camera:</span>
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedShelfForCam(p.shelf_position)}
                      className={`user-filter-pill ${
                        selectedShelfForCam === p.shelf_position ? 'active' : ''
                      }`}
                      style={{ fontSize: '11px', padding: '5px 10px' }}
                    >
                      {getProductIcon(p.name)} {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ACTIVE CAMERA FEED & ANALYSIS */}
              {(() => {
                const activeProd =
                  products.find((p) => p.shelf_position === selectedShelfForCam) || products[0];
                if (!activeProd) return null;

                const activeSensor = sensors[activeProd.shelf_position];
                const activeAlert = activeAlerts.find(
                  (a) => a.shelf_id === activeProd.shelf_position || a.product_id === activeProd.id
                );
                const isMisplaced =
                  activeAlert?.alert_type === 'MISPLACED' ||
                  (activeSensor?.cam_detected_label &&
                    activeSensor.cam_detected_label !== activeProd.name);

                const detectedLabel =
                  activeSensor?.cam_detected_label || activeProd.name;
                const confidencePct = Math.round(
                  (activeSensor?.cam_confidence ?? 0.96) * 100
                );
                const isCriticalStock = activeProd.current_stock <= 2;
                const isLowStock = activeProd.current_stock <= activeProd.min_threshold;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
                    {/* Video Stream & Vision HUD (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="esp32-cam-container">
                        {/* Camera HUD Overlays */}
                        <div className="esp32-hud-overlay">
                          <div className="flex items-center gap-2">
                            <span className="esp32-rec-badge">
                              <span className="esp32-rec-dot" /> {isLiveWebcamActive ? 'LIVE WEBCAM' : 'LIVE STREAM'}
                            </span>
                            <span className="bg-slate-900/80 text-cyan-400 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-700">
                              {isLiveWebcamActive ? 'DEVICE WEBCAM · Active' : `ESP32-CAM · ${activeProd.shelf_position}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={toggleLiveWebcam}
                              className={`text-xs px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1.5 shadow ${
                                isLiveWebcamActive
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              📷 {isLiveWebcamActive ? 'Stop Webcam' : 'Switch to Device Webcam'}
                            </button>
                            <div className="bg-slate-900/80 text-emerald-400 font-mono text-[11px] px-2 py-0.5 rounded border border-slate-700">
                              {isLiveWebcamActive ? '30 FPS · WEBCAM HD' : '15 FPS · 1280x720 JPEG'}
                            </div>
                          </div>
                        </div>

                        {/* Simulated or Real Optical Lens Feed with Detection Bounding Box */}
                        <div className="esp32-lens-feed relative">
                          {isLiveWebcamActive ? (
                            <video
                              ref={liveVideoFeedRef}
                              autoPlay
                              playsInline
                              muted
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : activeSensor?.live_image_base64 ? (
                            <img
                              src={`data:image/jpeg;base64,${activeSensor.live_image_base64}`}
                              alt="ESP32-Cam Real Hardware Stream"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : activeSensor?.stream_url ? (
                            <img
                              src={activeSensor.stream_url}
                              alt="ESP32-Cam Stream"
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : null}

                          <div className="esp32-scanline" />

                          {/* Optical AI Detection Box */}
                          <div
                            className={`esp32-bounding-box ${
                              isMisplaced
                                ? 'danger'
                                : isCriticalStock
                                ? 'warning'
                                : ''
                            }`}
                            style={{ minWidth: '240px', zIndex: 5 }}
                          >
                            <div className="text-4xl mb-1 filter drop-shadow">
                              {getProductIcon(detectedLabel)}
                            </div>
                            <div className="text-sm font-bold text-white tracking-wide">
                              {detectedLabel}
                            </div>

                            {/* YOLO Model Badge */}
                            <div className="mt-0.5 mb-1 px-2 py-0.5 rounded bg-indigo-950/90 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 flex items-center justify-center gap-1.5 shadow">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              YOLO Object Counter Active
                            </div>

                            {/* Prominent Live Quantity Display in Optical Viewfinder */}
                            <div className="my-1.5 px-3 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-center w-full shadow-inner">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                                Live In-Stock Quantity
                              </span>
                              <div className="flex items-baseline justify-center gap-1.5">
                                <span className={`text-xl font-black font-mono ${
                                  activeProd.current_stock === 0
                                    ? 'text-red-500'
                                    : isLowStock
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                }`}>
                                  {activeProd.current_stock}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  / {activeProd.max_capacity} units
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                              Confidence: {confidencePct}%
                            </div>
                            {isMisplaced && (
                              <div className="mt-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                ⚠️ Misplaced Detected
                              </div>
                            )}
                            {activeProd.current_stock === 0 && (
                              <div className="mt-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                Out of Stock
                              </div>
                            )}
                          </div>

                          {/* Live timestamp overlay bottom-right */}
                          <div className="absolute bottom-2 right-3 font-mono text-[10px] text-slate-400 bg-slate-900/70 px-2 py-0.5 rounded z-10">
                            {activeSensor?.timestamp ? new Date(activeSensor.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                          </div>
                        </div>

                        {/* Camera Hardware Stats Bar */}
                        <div className="esp32-cam-stats">
                          <div>
                            <span className="text-slate-400">MAC Address:</span>
                            <div className="font-mono text-cyan-400">
                              {activeSensor?.device_mac || '24:6F:28:B2:1A:01'}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Battery Level:</span>
                            <div className="font-mono text-emerald-400">
                              🔋 {activeSensor?.hardware_battery_pct ?? 96}%
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400">Vision Model:</span>
                            <div className="font-mono text-amber-400 font-bold flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              YOLOv8 Real-Time Counter
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live ESP32 Physical Camera IP Connection Bar */}
                      {(() => {
                        const deviceIp = activeSensor?.stream_url
                          ? activeSensor.stream_url.replace(/^http:\/\//, '').replace(/:\d+.*$/, '')
                          : '192.168.137.241';

                        return (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="font-semibold text-blue-900">
                                Live ESP32-CAM (YOLO Source):
                              </span>
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-blue-700 font-bold">
                                {deviceIp}
                              </span>
                              <span className="text-slate-500">➜ Assigned to: <strong>{activeProd.name}</strong> ({activeProd.shelf_position})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => window.open(`http://${deviceIp}`, '_blank')}
                                className="text-xs bg-white text-blue-700 hover:bg-blue-100 font-medium px-2.5 py-1 rounded border border-blue-300 transition-colors flex items-center gap-1"
                              >
                                🌐 Open Local Web Server
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsHardwareGuideOpen(true)}
                                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-2.5 py-1 rounded transition-colors flex items-center gap-1 shadow-sm"
                              >
                                ⚡ YOLO Python Guide
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Optical Trigger Controls */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between flex-wrap gap-3">
                        <div className="text-xs text-slate-600">
                          <strong>Live Optical Action Triggers:</strong> Simulate camera movements or misplaced items.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="user-btn-sm user-btn-relocate"
                            onClick={async () => {
                              setIsMisplaceSimulating(true);
                              await onSimulateAction(
                                'MISPLACE',
                                activeProd.shelf_position,
                                { foreign_label: 'Unregistered Beverage Can' }
                              );
                              setIsMisplaceSimulating(false);
                              showToast(
                                `Simulated misplaced item on ${activeProd.shelf_position}. ESP32-Cam triggered alert!`,
                                'normal'
                              );
                            }}
                          >
                            🧪 Simulate Misplaced Item
                          </button>
                          <button
                            type="button"
                            className="user-btn-sm user-btn-outline-resolve"
                            onClick={async () => {
                              await onSimulateAction('RESTORE_NOMINAL', activeProd.shelf_position);
                              showToast(`Nominal optical detection restored for ${activeProd.name}`, 'success');
                            }}
                          >
                            🔄 Reset Camera to Nominal
                          </button>
                        </div>
                      </div>

                      {/* Optical Product Counter Scanner (Webcam / Upload / AI Vision) */}
                      <div className="p-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl shadow-lg border border-indigo-700/50">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-indigo-600 rounded-lg text-lg">🤖</span>
                            <div>
                              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                AI Camera Vision Counter
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Gemini 3.8 Flash Vision + YOLO
                                </span>
                              </h4>
                              <p className="text-xs text-indigo-200">
                                Count visible units of <strong>{activeProd.name}</strong> on {activeProd.shelf_position} using your webcam or uploaded shelf photo.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isLiveWebcamActive && (
                              <button
                                type="button"
                                disabled={isAiCounting}
                                onClick={async () => {
                                  if (!liveVideoFeedRef.current) return;
                                  setIsAiCounting(true);
                                  showToast('Analyzing live webcam frame with Gemini Vision...', 'info');

                                  try {
                                    const video = liveVideoFeedRef.current;
                                    const canvas = document.createElement('canvas');
                                    canvas.width = video.videoWidth || 640;
                                    canvas.height = video.videoHeight || 480;
                                    const ctx = canvas.getContext('2d');
                                    if (!ctx) throw new Error('Canvas context unavailable');
                                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                                    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

                                    const res = await fetch('/api/sensors/ai-count', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        shelf_id: activeProd.shelf_position,
                                        image_base64: base64Data,
                                        expected_product_name: activeProd.name,
                                      }),
                                    });
                                    const json = await res.json();
                                    if (json.success) {
                                      setAiCountResult({
                                        count: json.count,
                                        confidence: json.confidence,
                                        detected_product: json.detected_product,
                                        is_misplaced: json.is_misplaced,
                                        misplaced_item_name: json.misplaced_item_name,
                                        notes: json.notes,
                                      });
                                      showToast(`AI detected ${json.count} units of ${json.detected_product}!`, 'success');
                                    } else {
                                      showToast(json.error || 'Failed to analyze frame', 'normal');
                                    }
                                  } catch (err: any) {
                                    showToast(`Error: ${err.message}`, 'normal');
                                  } finally {
                                    setIsAiCounting(false);
                                  }
                                }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow"
                              >
                                ⚡ Count From Live Webcam
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setIsWebcamModalOpen(true)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow hover:shadow-indigo-500/25"
                            >
                              📷 Open Webcam & Count
                            </button>

                            <label className="cursor-pointer px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all">
                              <span>📁 Upload Photo</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setIsAiCounting(true);
                                  showToast('Analyzing shelf photo with Gemini Vision...', 'info');

                                  const reader = new FileReader();
                                  reader.onload = async () => {
                                    const base64Data = (reader.result as string).replace(/^data:image\/\w+;base64,/, '');
                                    try {
                                      const res = await fetch('/api/sensors/ai-count', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          shelf_id: activeProd.shelf_position,
                                          image_base64: base64Data,
                                          expected_product_name: activeProd.name,
                                        }),
                                      });
                                      const json = await res.json();
                                      if (json.success) {
                                        setAiCountResult({
                                          count: json.count,
                                          confidence: json.confidence,
                                          detected_product: json.detected_product,
                                          is_misplaced: json.is_misplaced,
                                          misplaced_item_name: json.misplaced_item_name,
                                          notes: json.notes,
                                        });
                                        showToast(`AI identified ${json.count} units of ${json.detected_product}!`, 'success');
                                      } else {
                                        showToast(json.error || 'Failed to analyze shelf image', 'normal');
                                      }
                                    } catch (err: any) {
                                      showToast(`Analysis failed: ${err.message}`, 'normal');
                                    } finally {
                                      setIsAiCounting(false);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        {/* Live AI Count Result Banner */}
                        {isAiCounting ? (
                          <div className="p-3 rounded-lg bg-indigo-950/80 border border-indigo-700 text-xs text-indigo-300 flex items-center gap-2 animate-pulse">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                            Scanning shelf image with Gemini Vision neural network to detect and count product units...
                          </div>
                        ) : aiCountResult ? (
                          <div className="p-3 rounded-lg bg-slate-950/90 border border-indigo-500/40 text-xs space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl font-mono font-black text-emerald-400">
                                  {aiCountResult.count} Units Counted
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  ({Math.round(aiCountResult.confidence * 100)}% Confidence)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-cyan-300">
                                  Product: {aiCountResult.detected_product}
                                </span>
                                {aiCountResult.is_misplaced && (
                                  <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                                    ⚠️ {aiCountResult.misplaced_item_name || 'Misplaced Item Detected'}
                                  </span>
                                )}
                              </div>
                            </div>
                            {aiCountResult.notes && (
                              <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded border border-slate-800">
                                💡 <strong>Vision Inspector Notes:</strong> {aiCountResult.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-indigo-300/80 flex items-center justify-between">
                            <span>Ready to count products in front of the camera.</span>
                            <span className="text-slate-400">ESP32 IP: <code className="text-cyan-300">192.168.137.241</code></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: AI Analysis & Stock Telemetry Details */}
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-900 text-sm mb-3">
                          📊 AI Vision Classification Telemetry
                        </h3>

                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Assigned Shelf:</span>
                            <strong className="text-slate-800 font-mono">
                              {activeProd.shelf_position}
                            </strong>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Expected Product:</span>
                            <strong className="text-slate-800">
                              {getProductIcon(activeProd.name)} {activeProd.name}
                            </strong>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Vision Detected Label:</span>
                            <strong
                              className={
                                isMisplaced ? 'text-red-600 font-bold' : 'text-emerald-700'
                              }
                            >
                              {detectedLabel}
                            </strong>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Optical Match Status:</span>
                            <span
                              className={`user-badge ${
                                isMisplaced ? 'red-bg' : 'green-bg'
                              }`}
                            >
                              {isMisplaced ? 'Misplaced Anomaly' : 'Matched (100%)'}
                            </span>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Current Stock Count:</span>
                            <strong className="text-slate-900 text-sm">
                              {activeProd.current_stock} / {activeProd.max_capacity} units
                            </strong>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">YOLO Object Counter:</span>
                            <span className="inline-flex items-center gap-1.5 font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                              {activeSensor?.yolo_count !== undefined ? activeSensor.yolo_count : activeProd.current_stock} items tracked
                            </span>
                          </div>

                          <div className="flex justify-between pb-2 border-b border-slate-200">
                            <span className="text-slate-500">Load Cell Cross-Check:</span>
                            <strong className="text-slate-800 font-mono">
                              {activeSensor
                                ? (activeSensor.load_cell_weight_g / 1000).toFixed(2) + ' kg'
                                : '0.00 kg'}
                            </strong>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-slate-500">Stock Status Level:</span>
                            <span
                              className={`user-badge ${
                                isCriticalStock
                                  ? 'red-bg'
                                  : isLowStock
                                  ? 'yellow-bg'
                                  : 'green-bg'
                              }`}
                            >
                              {isCriticalStock
                                ? 'Critical Low'
                                : isLowStock
                                ? 'Low Stock Warning'
                                : 'Adequate'}
                            </span>
                          </div>
                        </div>

                        {/* Quick Action Button for current shelf */}
                        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col gap-2">
                          <button
                            type="button"
                            className="user-action-btn w-full justify-center"
                            onClick={() => handleRestock(activeProd.id)}
                          >
                            ⚡ Restock {activeProd.name}
                          </button>

                          {/* Quick Manual Camera Count Sync */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="number"
                              min="0"
                              max={activeProd.max_capacity}
                              placeholder="Set count..."
                              value={manualCountInput}
                              onChange={(e) => setManualCountInput(e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded font-mono w-24 bg-white"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const parsedCount = parseInt(manualCountInput, 10);
                                if (isNaN(parsedCount) || parsedCount < 0) {
                                  showToast('Please enter a valid count number', 'normal');
                                  return;
                                }
                                try {
                                  const res = await fetch('/api/sensors/set-count', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      shelf_id: activeProd.shelf_position,
                                      count: parsedCount,
                                      cam_detected_label: activeProd.name,
                                    }),
                                  });
                                  if (res.ok) {
                                    showToast(`Synced ${activeProd.name} quantity to ${parsedCount} units!`, 'success');
                                    setManualCountInput('');
                                  }
                                } catch (e: any) {
                                  showToast(`Error: ${e.message}`, 'normal');
                                }
                              }}
                              className="flex-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
                            >
                              Sync Camera Count
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ALL SHELVES CAMERA GRID OVERVIEW */}
            <div className="user-panel">
              <h2 className="mb-3">🌐 All Shelves ESP32-Cam Optical Feed Grid</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((prod) => {
                  const sensor = sensors[prod.shelf_position];
                  const icon = getProductIcon(prod.name);
                  const isSelected = selectedShelfForCam === prod.shelf_position;
                  const activeAlert = activeAlerts.find(
                    (a) => a.shelf_id === prod.shelf_position || a.product_id === prod.id
                  );
                  const hasMisplaced =
                    activeAlert?.alert_type === 'MISPLACED' ||
                    (sensor?.cam_detected_label && sensor.cam_detected_label !== prod.name);

                  return (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedShelfForCam(prod.shelf_position)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer bg-white ${
                        isSelected
                          ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-mono font-bold text-slate-700">
                          {prod.shelf_position}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            hasMisplaced
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {hasMisplaced ? 'Misplaced' : 'Active'}
                        </span>
                      </div>

                      <div className="h-28 rounded-lg bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden text-center p-2">
                        <div className="text-3xl mb-1">{icon}</div>
                        <div className="text-xs font-bold text-white">{prod.name}</div>
                        <div className="text-[10px] font-mono text-cyan-400">
                          Stock: {prod.current_stock} / {prod.max_capacity}
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-2 text-[10px] text-emerald-400 font-mono font-bold">
                            ● VIEWING
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-xs flex justify-between text-slate-500">
                        <span>Label: {sensor?.cam_detected_label || prod.name}</span>
                        <span>{sensor?.cam_confidence ? Math.round(sensor.cam_confidence * 100) : 98}% Conf</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TOAST CONTAINER */}
      <div className="user-toast-container" id="toastContainer">
        {toasts.map((t) => (
          <div key={t.id} className="user-toast">
            <span>
              {t.type === 'success' ? '✅' : t.type === 'info' ? '📦' : 'ℹ️'}
            </span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ESP32-CAM HARDWARE CONNECTION & ARDUINO CODE MODAL */}
      {isHardwareGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)' }}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl text-slate-800"
            style={{ maxHeight: '92vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  🔌 Connect Your Physical ESP32-CAM Module
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Step-by-step instructions, REST API webhook endpoint, and ready-to-flash Arduino sketch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsHardwareGuideOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none"
              >
                ✕
              </button>
            </div>

            {/* Quick API Endpoint Details */}
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs mb-5">
              <div className="text-emerald-400 font-bold mb-1">
                📡 Server Ingestion Endpoint (POST HTTP JSON):
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-cyan-300 break-all select-all">
                {window.location.origin}/api/sensors/payload
              </div>
              <div className="text-slate-400 mt-2 text-[11px]">
                Payload parameters: <code className="text-purple-300">shelf_id</code> (e.g. &quot;Aisle 1 · Rack A&quot;), <code className="text-purple-300">cam_detected_label</code>, <code className="text-purple-300">cam_confidence</code>, <code className="text-purple-300">live_image_base64</code> (JPEG base64 string), <code className="text-purple-300">load_cell_weight_g</code>.
              </div>
            </div>

            {/* Step by step guide */}
            <div className="space-y-4 text-xs font-sans">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                  Wiring & Flashing Setup (FTDI / USB-TTL)
                </h4>
                <p className="text-slate-600 mb-2">
                  Connect your ESP32-CAM (AI-Thinker model) to a USB-to-UART / FTDI programmer:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] mb-2">
                  <div className="bg-white p-2 border rounded text-center">
                    <span className="text-red-600 font-bold">5V / VCC</span> ➜ 5V
                  </div>
                  <div className="bg-white p-2 border rounded text-center">
                    <span className="text-slate-800 font-bold">GND</span> ➜ GND
                  </div>
                  <div className="bg-white p-2 border rounded text-center">
                    <span className="text-blue-600 font-bold">U0R (RX)</span> ➜ TX
                  </div>
                  <div className="bg-white p-2 border rounded text-center">
                    <span className="text-emerald-600 font-bold">U0T (TX)</span> ➜ RX
                  </div>
                </div>
                <div className="text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded text-[11px]">
                  💡 <strong>Important for flashing:</strong> Connect <strong>GPIO 0 to GND</strong> before pressing the RESET button to put it in bootloader mode, then disconnect GPIO 0 after uploading.
                </div>
              </div>

              {/* Ready to copy Arduino sketch */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                    Arduino IDE C++ Code (Auto-capture & HTTP POST)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const code = `// ESP32-CAM Smart Shelf Streamer to AI Retail Monitoring Dashboard
#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <base64.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "${window.location.origin}/api/sensors/payload";
const char* targetShelf = "Aisle 1 · Rack A";

// AI-Thinker Camera Pin Configuration
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connected! IP: " + WiFi.localIP().toString());

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA; // 320x240 for quick payload delivery
  config.jpeg_quality = 12;
  config.fb_count = 1;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      delay(2000);
      return;
    }

    // Convert frame buffer to Base64
    String base64Image = base64::encode(fb->buf, fb->len);
    esp_camera_fb_return(fb);

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\\"shelf_id\\":\\"" + String(targetShelf) + "\\","
      + "\\"cam_detected_label\\":\\"Live Optical\\","
      + "\\"cam_confidence\\":0.97,"
      + "\\"device_mac\\":\\"" + WiFi.macAddress() + "\\","
      + "\\"hardware_battery_pct\\":98,"
      + "\\"live_image_base64\\":\\"" + base64Image + "\\"}";

    int httpResponseCode = http.POST(jsonPayload);
    Serial.printf("HTTP Response code: %d\\n", httpResponseCode);
    http.end();
  }
  delay(3000); // Send frame every 3 seconds
}`;
                      navigator.clipboard.writeText(code);
                      showToast('Arduino sketch copied to clipboard!', 'success');
                    }}
                    className="user-btn-sm user-btn-relocate"
                  >
                    📋 Copy Arduino Code
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed max-h-56">
{`// 1. In Arduino IDE -> Boards Manager -> Install "esp32 by Espressif Systems"
// 2. Select Board: "AI Thinker ESP32-CAM"
// 3. Update 'ssid', 'password', and 'serverUrl'
// 4. Hit Upload! The live feed will immediately render on the dashboard.`}
                </pre>
              </div>

              {/* YOLO Python Object Detection and Counter Section */}
              <div className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                    Python YOLOv8 Real-Time Product Counter & Streamer
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const pyCode = `# YOLOv8 Product Counter for ESP32-CAM stream (192.168.137.241)
# Requirements: pip install ultralytics opencv-python requests

import cv2
import requests
import time
from ultralytics import YOLO

# 1. Config
ESP32_STREAM_URL = "http://192.168.137.241:81/stream"  # or "http://192.168.137.241/capture"
DASHBOARD_API = "${window.location.origin}/api/sensors/payload"
SHELF_ID = "Aisle 3 · Rack B"       # Biscuits Shelf
TARGET_CLASS = "biscuits"           # YOLO class label or custom model class
CONFIDENCE_THRESHOLD = 0.50

# 2. Load YOLO model (yolov8n.pt or your custom fine-tuned weights)
print("Loading YOLOv8...")
model = YOLO("yolov8n.pt")

# 3. Connect to ESP32 stream
cap = cv2.VideoCapture(ESP32_STREAM_URL)
last_sync_time = 0

print(f"Connecting to ESP32-CAM stream at {ESP32_STREAM_URL}...")
while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        print("Waiting for camera stream frames...")
        time.sleep(1)
        cap = cv2.VideoCapture(ESP32_STREAM_URL)
        continue

    # Run YOLO inference
    results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
    detections = results[0].boxes

    # Count detected objects
    counted_items = len(detections)

    # Annotate frame
    annotated_frame = results[0].plot()
    cv2.putText(annotated_frame, f"YOLO Count: {counted_items}", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow("ESP32-CAM 192.168.137.241 YOLO Counting", annotated_frame)

    # Sync live count with Dashboard every 1.5 seconds
    current_time = time.time()
    if current_time - last_sync_time > 1.5:
        try:
            payload = {
                "shelf_id": SHELF_ID,
                "yolo_count": counted_items,
                "cam_detected_label": "Biscuits (YOLO v8)",
                "cam_confidence": 0.98 if counted_items > 0 else 0.5,
                "device_mac": "ESP32-192.168.137.241",
                "stream_url": ESP32_STREAM_URL,
                "hardware_online": True
            }
            res = requests.post(DASHBOARD_API, json=payload, timeout=2)
            print(f"[YOLO Sync] Sent count: {counted_items} | Server: {res.status_code}")
            last_sync_time = current_time
        except Exception as e:
            print(f"[YOLO Sync Error] {e}")

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()`;
                      navigator.clipboard.writeText(pyCode);
                      showToast('Python YOLO counter script copied to clipboard!', 'success');
                    }}
                    className="user-btn-sm user-btn-relocate"
                  >
                    📋 Copy Python Script
                  </button>
                </div>
                <p className="text-slate-600 mb-2">
                  Run this Python script on your PC/server to read frames from <code>http://192.168.137.2:81/stream</code>, run YOLO object counting, and automatically push live quantities to this dashboard:
                </p>
                <pre className="bg-slate-900 text-cyan-300 p-3 rounded-lg overflow-x-auto text-[10px] font-mono leading-relaxed max-h-56">
{`# Quick Start:
pip install ultralytics opencv-python requests
python yolo_counter.py`}
                </pre>
              </div>

              {/* Instant Verification Test with curl / simulated hardware */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                  Test Your Connection from Terminal or Serial
                </h4>
                <p className="text-slate-600 mb-2">
                  You can test sending a hardware frame right now using this curl command:
                </p>
                <div className="bg-slate-900 text-cyan-300 p-2.5 rounded font-mono text-[10px] break-all select-all">
                  curl -X POST {window.location.origin}/api/sensors/payload \
                    -H &quot;Content-Type: application/json&quot; \
                    -d &#39;&#123;&quot;shelf_id&quot;:&quot;Aisle 1 · Rack A&quot;,&quot;cam_detected_label&quot;:&quot;Milk&quot;,&quot;cam_confidence&quot;:0.98,&quot;device_mac&quot;:&quot;ESP32-LIVE-01&quot;&#125;&#39;
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setIsHardwareGuideOpen(false)}
                className="user-action-btn"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Optical AI Product Counter Modal */}
      {(() => {
        const activeProd = products.find((p) => p.shelf_position === selectedShelfForCam) || products[0];
        return (
          <WebcamProductCounterModal
            isOpen={isWebcamModalOpen}
            onClose={() => setIsWebcamModalOpen(false)}
            shelfId={activeProd?.shelf_position || 'Aisle 3 · Rack B'}
            expectedProductName={activeProd?.name || 'Retail Product'}
            onCountSuccess={(res) => {
              setAiCountResult(res);
            }}
            onToast={showToast}
          />
        );
      })()}
    </div>
  );
};
