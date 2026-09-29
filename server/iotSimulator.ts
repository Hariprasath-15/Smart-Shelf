import { EventEmitter } from 'events';
import { db } from './db.js';
import type { SensorData } from '../src/types/index.js';

export const iotEvents = new EventEmitter();

class IoTSimulator {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run every 5 seconds to simulate real-world IoT sensor heartbeat
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, 5000);
  }

  public stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
  }

  private tick() {
    const status = db.getSystemStatus();
    if (!status.hardware_online) {
      // Hardware is offline, don't generate live ticks
      return;
    }

    const products = db.getProducts();
    const now = new Date().toISOString();

    for (const prod of products) {
      const existingSensor = db.getSensor(prod.shelf_position);
      // Small natural micro-fluctuations in load cell reading (+/- 1 to 4 grams)
      const jitter = Math.floor(Math.random() * 7) - 3;
      const expectedTotal = prod.current_stock * prod.expected_weight_g;
      
      // Keep weight around expected total unless an active tampering alert exists
      let currentWeight = expectedTotal + jitter;
      if (existingSensor && Math.abs(existingSensor.load_cell_weight_g - expectedTotal) > prod.expected_weight_g * 0.4) {
        // preserve anomaly weight if not restored
        currentWeight = existingSensor.load_cell_weight_g + jitter;
      }

      const payload: Partial<SensorData> = {
        load_cell_weight_g: Math.max(0, currentWeight),
        ir_sensor_state: prod.current_stock > 0,
        timestamp: now,
        cam_detected_label: prod.name,
        cam_confidence: +(0.95 + Math.random() * 0.04).toFixed(2),
        hardware_battery_pct: Math.max(75, (existingSensor?.hardware_battery_pct ?? 95)),
        hardware_online: true,
      };

      db.updateSensorData(prod.shelf_position, payload);
    }

    // Broadcast SSE update event
    iotEvents.emit('sensor_tick', {
      timestamp: now,
      sensors: db.getSensors(),
      products: db.getProducts(),
      alerts: db.getAlerts(),
      status: db.getSystemStatus(),
    });
  }

  // Interactive simulated actions for hardware demonstrations
  public simulatePickItem(shelfId: string) {
    const product = db.getProductByShelf(shelfId);
    if (!product || product.current_stock <= 0) return false;

    const newStock = product.current_stock - 1;
    db.updateProduct(product.id, { current_stock: newStock });

    // Update sensor to reflect pick
    const newWeight = Math.max(0, newStock * product.expected_weight_g);
    db.updateSensorData(shelfId, {
      ir_sensor_state: newStock > 0,
      load_cell_weight_g: newWeight,
      cam_detected_label: product.name,
      cam_confidence: 0.96,
    });

    iotEvents.emit('action_trigger', {
      type: 'PICK_ITEM',
      shelfId,
      productName: product.name,
      remainingStock: newStock,
    });
    return true;
  }

  public simulateRestock(shelfId: string) {
    const product = db.getProductByShelf(shelfId);
    if (!product) return false;

    db.updateProduct(product.id, { current_stock: product.max_capacity });
    db.updateSensorData(shelfId, {
      ir_sensor_state: true,
      load_cell_weight_g: product.max_capacity * product.expected_weight_g,
      cam_detected_label: product.name,
      cam_confidence: 0.98,
    });

    iotEvents.emit('action_trigger', {
      type: 'RESTOCK',
      shelfId,
      productName: product.name,
      newStock: product.max_capacity,
    });
    return true;
  }

  public simulateMisplacedItem(shelfId: string, foreignLabel: string = 'Artisan Cold Brew Amber 500ml') {
    const product = db.getProductByShelf(shelfId);
    if (!product) return false;

    // ESP32-Cam detects different item on this shelf
    db.updateSensorData(shelfId, {
      cam_detected_label: foreignLabel,
      cam_confidence: 0.93,
    });

    iotEvents.emit('action_trigger', {
      type: 'MISPLACED_TRIGGER',
      shelfId,
      expected: product.name,
      detected: foreignLabel,
    });
    return true;
  }

  public simulateTampering(shelfId: string, extraWeightG: number = -650) {
    const product = db.getProductByShelf(shelfId);
    if (!product) return false;

    const currentSensor = db.getSensor(shelfId);
    const baseWeight = product.current_stock * product.expected_weight_g;
    const tamperedWeight = Math.max(0, baseWeight + extraWeightG);

    db.updateSensorData(shelfId, {
      load_cell_weight_g: tamperedWeight,
    });

    iotEvents.emit('action_trigger', {
      type: 'TAMPERING_TRIGGER',
      shelfId,
      expectedWeight: baseWeight,
      measuredWeight: tamperedWeight,
    });
    return true;
  }

  public simulateRestoreNominal(shelfId?: string) {
    const products = shelfId ? [db.getProductByShelf(shelfId)].filter(Boolean) : db.getProducts();

    for (const prod of products) {
      if (!prod) continue;
      db.updateSensorData(prod.shelf_position, {
        ir_sensor_state: prod.current_stock > 0,
        load_cell_weight_g: prod.current_stock * prod.expected_weight_g,
        cam_detected_label: prod.name,
        cam_confidence: 0.98,
      });
    }

    if (shelfId) {
      const activeAlerts = db.getAlerts().filter((a) => a.shelf_id === shelfId && a.alert_type !== 'LOW_STOCK');
      for (const a of activeAlerts) {
        db.resolveAlert(a.id);
      }
    } else {
      // Resolve misplaced and tampering alerts
      const activeAlerts = db.getAlerts().filter((a) => a.alert_type === 'MISPLACED' || a.alert_type === 'TAMPERING');
      for (const a of activeAlerts) {
        db.resolveAlert(a.id);
      }
    }

    iotEvents.emit('action_trigger', {
      type: 'NOMINAL_RESTORED',
      shelfId: shelfId || 'ALL',
    });
    return true;
  }
}

export const iotSimulator = new IoTSimulator();
