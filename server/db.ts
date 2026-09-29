import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Product, SensorData, Alert, SystemStatus, AIModulesStatus } from '../src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'smart_shelf_db.json');

import { SEED_PRODUCTS, SEED_SENSORS, SEED_ALERTS } from './seedData.js';

export interface DatabaseSchema {
  products: Product[];
  sensors: Record<string, SensorData>;
  alerts: Alert[];
  ai_modules: AIModulesStatus;
  hardware_online: boolean;
  last_heartbeat: string;
}

const DEFAULT_PRODUCTS: Product[] = SEED_PRODUCTS;
const DEFAULT_SENSORS: Record<string, SensorData> = SEED_SENSORS;
const DEFAULT_ALERTS: Alert[] = SEED_ALERTS;

class Database {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // If file contains older schema without milk/biscuits/shampoo, migrate to SEED_PRODUCTS
        const hasUserCatalog = parsed.products && parsed.products.some((p: any) => p.name === 'Milk' || p.id === 'milk');
        if (hasUserCatalog) {
          return {
            products: parsed.products || DEFAULT_PRODUCTS,
            sensors: parsed.sensors || DEFAULT_SENSORS,
            alerts: parsed.alerts || DEFAULT_ALERTS,
            ai_modules: parsed.ai_modules || {
              product_recognition: true,
              low_stock_predictor: true,
              misplaced_scanner: true,
              weight_tamper_detection: true,
              cloud_sync: 'synced',
            },
            hardware_online: parsed.hardware_online !== undefined ? parsed.hardware_online : true,
            last_heartbeat: parsed.last_heartbeat || new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.error('Error loading db file, falling back to defaults:', err);
    }

    const initial: DatabaseSchema = {
      products: DEFAULT_PRODUCTS,
      sensors: DEFAULT_SENSORS,
      alerts: DEFAULT_ALERTS,
      ai_modules: {
        product_recognition: true,
        low_stock_predictor: true,
        misplaced_scanner: true,
        weight_tamper_detection: true,
        cloud_sync: 'synced',
      },
      hardware_online: true,
      last_heartbeat: new Date().toISOString(),
    };
    this.saveImmediate(initial);
    return initial;
  }

  private save() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate(this.data);
    }, 200);
  }

  private saveImmediate(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // PRODUCTS CRUD
  public getProducts(): Product[] {
    return [...this.data.products];
  }

  public getProductById(id: string): Product | undefined {
    return this.data.products.find((p) => p.id === id);
  }

  public getProductByShelf(shelf_id: string): Product | undefined {
    return this.data.products.find((p) => p.shelf_position.toLowerCase() === shelf_id.toLowerCase());
  }

  public addProduct(product: Omit<Product, 'id' | 'created_at'>): Product {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.data.products.push(newProduct);

    // Initialize sensor if shelf doesn't have one
    if (!this.data.sensors[newProduct.shelf_position]) {
      this.data.sensors[newProduct.shelf_position] = {
        id: `sensor-${Date.now().toString().slice(-4)}`,
        shelf_id: newProduct.shelf_position,
        ir_sensor_state: newProduct.current_stock > 0,
        load_cell_weight_g: newProduct.current_stock * newProduct.expected_weight_g,
        cam_detected_label: newProduct.name,
        cam_confidence: 0.97,
        timestamp: new Date().toISOString(),
        device_mac: `24:6F:28:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}:${Math.floor(Math.random() * 89 + 10)}`,
        hardware_battery_pct: 95,
        hardware_online: true,
      };
    }

    this.checkStockLevelAlert(newProduct);
    this.save();
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Product>): Product | null {
    const idx = this.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return null;

    const oldProduct = this.data.products[idx];
    const updated: Product = {
      ...oldProduct,
      ...updates,
      id: oldProduct.id, // Immutable ID
      updated_at: new Date().toISOString(),
    };
    this.data.products[idx] = updated;

    // Update sensor weight representation
    const shelf = updated.shelf_position;
    if (this.data.sensors[shelf]) {
      this.data.sensors[shelf].load_cell_weight_g = updated.current_stock * updated.expected_weight_g;
      this.data.sensors[shelf].ir_sensor_state = updated.current_stock > 0;
      this.data.sensors[shelf].cam_detected_label = updated.name;
    }

    this.checkStockLevelAlert(updated);
    this.save();
    return updated;
  }

  public deleteProduct(id: string): boolean {
    const idx = this.data.products.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    const removed = this.data.products[idx];
    this.data.products.splice(idx, 1);
    // Remove active alerts for this product
    this.data.alerts = this.data.alerts.filter((a) => a.product_id !== id);
    this.save();
    return true;
  }

  // SENSORS
  public getSensors(): Record<string, SensorData> {
    return { ...this.data.sensors };
  }

  public getSensor(shelf_id: string): SensorData | undefined {
    return this.data.sensors[shelf_id];
  }

  public updateSensorData(shelf_id: string, sensorPayload: Partial<SensorData>): SensorData {
    const current = this.data.sensors[shelf_id] || {
      id: `sensor-${Date.now().toString().slice(-4)}`,
      shelf_id,
      ir_sensor_state: true,
      load_cell_weight_g: 0,
      cam_detected_label: 'Unknown',
      cam_confidence: 0,
      timestamp: new Date().toISOString(),
      device_mac: '24:6F:28:B2:1A:00',
      hardware_battery_pct: 100,
      hardware_online: true,
    };

    const updated: SensorData = {
      ...current,
      ...sensorPayload,
      timestamp: new Date().toISOString(),
    };

    this.data.sensors[shelf_id] = updated;
    this.data.last_heartbeat = updated.timestamp;

    // If weight tamper detection is active, check load cell
    const product = this.getProductByShelf(shelf_id);
    if (product && this.data.ai_modules.weight_tamper_detection) {
      this.evaluateLoadCellTelemetry(product, updated);
    }

    // If misplaced scanner is active, check camera label
    if (product && this.data.ai_modules.misplaced_scanner) {
      this.evaluateMisplacedProduct(product, updated);
    }

    this.save();
    return updated;
  }

  // ALERTS (Prioritized with LOW_STOCK first)
  public getAlerts(): Alert[] {
    const alerts = [...this.data.alerts];
    const typePriority: Record<string, number> = {
      LOW_STOCK: 1, // Prioritized first
      MISPLACED: 2,
      TAMPERING: 3,
      OFFLINE: 4,
    };

    return alerts.sort((a, b) => {
      // First sort by status (ACTIVE first)
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;

      // Then by priority type (LOW_STOCK first)
      const prioA = typePriority[a.alert_type] || 99;
      const prioB = typePriority[b.alert_type] || 99;
      if (prioA !== prioB) return prioA - prioB;

      // Then by recency
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  public createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'status'> & { id?: string }): Alert {
    // Avoid spamming duplicate active alerts of same type on same shelf
    const existing = this.data.alerts.find(
      (a) => a.shelf_id === alert.shelf_id && a.alert_type === alert.alert_type && a.status === 'ACTIVE'
    );
    if (existing) {
      existing.message = alert.message;
      existing.severity = alert.severity;
      existing.metadata = alert.metadata;
      this.save();
      return existing;
    }

    const newAlert: Alert = {
      ...alert,
      id: alert.id || `alert-${Date.now()}`,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };
    this.data.alerts.unshift(newAlert);
    this.save();
    return newAlert;
  }

  public resolveAlert(id: string): Alert | null {
    const alert = this.data.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.status = 'RESOLVED';
    alert.resolved_at = new Date().toISOString();
    this.save();
    return alert;
  }

  public resolveAllAlerts(): number {
    let count = 0;
    const now = new Date().toISOString();
    for (const alert of this.data.alerts) {
      if (alert.status === 'ACTIVE') {
        alert.status = 'RESOLVED';
        alert.resolved_at = now;
        count++;
      }
    }
    this.save();
    return count;
  }

  // AI & HARDWARE STATUS
  public getSystemStatus(): SystemStatus {
    const now = new Date();
    const lastHb = new Date(this.data.last_heartbeat);
    const diffSeconds = (now.getTime() - lastHb.getTime()) / 1000;
    // Hardware considered offline if manual toggle is false or last ping > 15s
    const isOnline = this.data.hardware_online && diffSeconds < 20;

    return {
      hardware_online: isOnline,
      last_heartbeat: this.data.last_heartbeat,
      ping_interval_ms: 5000,
      ai_modules: { ...this.data.ai_modules },
      active_sensors_count: Object.keys(this.data.sensors).length,
      server_time: now.toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
    };
  }

  public toggleAIModule(moduleKey: keyof AIModulesStatus, state?: boolean): AIModulesStatus {
    if (moduleKey === 'cloud_sync') {
      this.data.ai_modules.cloud_sync =
        this.data.ai_modules.cloud_sync === 'synced' ? 'syncing' : 'synced';
    } else {
      const current = this.data.ai_modules[moduleKey] as boolean;
      (this.data.ai_modules as any)[moduleKey] = state !== undefined ? state : !current;
    }
    this.save();
    return { ...this.data.ai_modules };
  }

  public setHardwareOnline(online: boolean): boolean {
    this.data.hardware_online = online;
    if (online) {
      this.data.last_heartbeat = new Date().toISOString();
      // Resolve any offline alert
      const offlineAlert = this.data.alerts.find((a) => a.alert_type === 'OFFLINE' && a.status === 'ACTIVE');
      if (offlineAlert) {
        offlineAlert.status = 'RESOLVED';
        offlineAlert.resolved_at = new Date().toISOString();
      }
    } else {
      this.createAlert({
        product_name: 'IoT Hardware Gateway',
        shelf_id: 'All Shelves',
        alert_type: 'OFFLINE',
        message: 'Sensors disconnected: ESP32-Cam and Load Cells offline. Data stream suspended.',
        severity: 'CRITICAL',
      });
    }
    this.save();
    return this.data.hardware_online;
  }

  // BUSINESS LOGIC / ANOMALY CHECKS
  private checkStockLevelAlert(product: Product) {
    if (!this.data.ai_modules.low_stock_predictor) return;

    if (product.current_stock <= product.min_threshold) {
      this.createAlert({
        product_id: product.id,
        product_name: product.name,
        shelf_id: product.shelf_position,
        alert_type: 'LOW_STOCK',
        message: `Low Stock Alert: Only ${product.current_stock} units left on ${product.shelf_position} (Min threshold: ${product.min_threshold}).`,
        severity: product.current_stock === 0 ? 'CRITICAL' : 'WARNING',
        metadata: {
          current_stock: product.current_stock,
          min_threshold: product.min_threshold,
        },
      });
    } else {
      // Auto-resolve any active low stock alerts if replenished
      const existing = this.data.alerts.find(
        (a) => a.product_id === product.id && a.alert_type === 'LOW_STOCK' && a.status === 'ACTIVE'
      );
      if (existing) {
        existing.status = 'RESOLVED';
        existing.resolved_at = new Date().toISOString();
      }
    }
  }

  private evaluateLoadCellTelemetry(product: Product, sensor: SensorData) {
    if (product.current_stock === 0 && sensor.load_cell_weight_g > 80) {
      // Weight present when inventory is 0
      this.createAlert({
        product_id: product.id,
        product_name: product.name,
        shelf_id: product.shelf_position,
        alert_type: 'TAMPERING',
        message: `Weight Anomaly: Load cell detected ${sensor.load_cell_weight_g}g on empty ${product.shelf_position}. Potential foreign object.`,
        severity: 'CRITICAL',
        metadata: {
          expected_weight_g: 0,
          measured_weight_g: sensor.load_cell_weight_g,
          weight_diff_g: sensor.load_cell_weight_g,
        },
      });
      return;
    }

    if (product.current_stock > 0) {
      const expectedTotal = product.current_stock * product.expected_weight_g;
      const diff = Math.abs(sensor.load_cell_weight_g - expectedTotal);
      const tolerance = product.expected_weight_g * 0.45; // 45% tolerance

      if (diff > tolerance && sensor.load_cell_weight_g > 50) {
        this.createAlert({
          product_id: product.id,
          product_name: product.name,
          shelf_id: product.shelf_position,
          alert_type: 'TAMPERING',
          message: `Weight Tampering Detected on ${product.shelf_position}: Expected ${expectedTotal}g for ${product.current_stock} units, measured ${sensor.load_cell_weight_g}g (variance: ${Math.round(diff)}g).`,
          severity: 'CRITICAL',
          metadata: {
            expected_weight_g: expectedTotal,
            measured_weight_g: sensor.load_cell_weight_g,
            weight_diff_g: diff,
          },
        });
      }
    }
  }

  private evaluateMisplacedProduct(product: Product, sensor: SensorData) {
    if (!sensor.cam_detected_label || sensor.cam_detected_label === product.name) {
      return;
    }
    if (sensor.cam_confidence > 0.8) {
      this.createAlert({
        product_id: product.id,
        product_name: product.name,
        shelf_id: product.shelf_position,
        alert_type: 'MISPLACED',
        message: `Misplaced Product: ESP32-Cam identified "${sensor.cam_detected_label}" (${Math.round(sensor.cam_confidence * 100)}% conf) on ${product.shelf_position} instead of "${product.name}".`,
        severity: 'WARNING',
        metadata: {
          expected_product: product.name,
          detected_product: sensor.cam_detected_label,
        },
      });
    }
  }
}

export const db = new Database();
