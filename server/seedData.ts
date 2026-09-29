import { fileURLToPath } from 'url';
import path from 'path';
import type { Product, SensorData, Alert, AIModulesStatus } from '../src/types/index.js';

export interface DatabaseSchema {
  products: Product[];
  sensors: Record<string, SensorData>;
  alerts: Alert[];
  ai_modules: AIModulesStatus;
  hardware_online: boolean;
  last_heartbeat: string;
}

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'milk',
    name: 'Milk',
    category: 'Dairy',
    image_url: '/src/assets/images/shelf_prod_milk_1790616054203.jpg',
    shelf_position: 'Aisle 1 · Rack A',
    expected_weight_g: 1050,
    min_threshold: 6,
    current_stock: 18,
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'biscuits',
    name: 'Biscuits',
    category: 'Snacks',
    image_url: '/src/assets/images/shelf_prod_cereal_1790616089979.jpg',
    shelf_position: 'Aisle 3 · Rack B',
    expected_weight_g: 500,
    min_threshold: 7,
    current_stock: 4, // low stock!
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'shampoo',
    name: 'Shampoo',
    category: 'Personal Care',
    image_url: '/src/assets/images/shelf_prod_oil_1790616079016.jpg',
    shelf_position: 'Aisle 4 · Rack C',
    expected_weight_g: 450,
    min_threshold: 5,
    current_stock: 1, // critical!
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 16).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'rice',
    name: 'Rice',
    category: 'Grains',
    image_url: '/src/assets/images/shelf_prod_cereal_1790616089979.jpg',
    shelf_position: 'Aisle 2 · Rack A',
    expected_weight_g: 1000,
    min_threshold: 6,
    current_stock: 15,
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'juice',
    name: 'Juice',
    category: 'Beverages',
    image_url: '/src/assets/images/shelf_prod_coffee_1790616067677.jpg',
    shelf_position: 'Aisle 5 · Rack B',
    expected_weight_g: 600,
    min_threshold: 5,
    current_stock: 10,
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 6).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'soap',
    name: 'Soap',
    category: 'Personal Care',
    image_url: '/src/assets/images/shelf_prod_oil_1790616079016.jpg',
    shelf_position: 'Aisle 6 · Rack A',
    expected_weight_g: 150,
    min_threshold: 7,
    current_stock: 7, // low stock!
    max_capacity: 20,
    last_restocked: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
    created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
];

export const SEED_SENSORS: Record<string, SensorData> = {
  'Aisle 1 · Rack A': {
    id: 'sensor-milk',
    shelf_id: 'Aisle 1 · Rack A',
    ir_sensor_state: true,
    load_cell_weight_g: 18900, // 18 * 1050g
    cam_detected_label: 'Milk',
    cam_confidence: 0.98,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:01',
    hardware_battery_pct: 98,
    hardware_online: true,
  },
  'Aisle 3 · Rack B': {
    id: 'sensor-biscuits',
    shelf_id: 'Aisle 3 · Rack B',
    ir_sensor_state: true,
    load_cell_weight_g: 2000, // 4 * 500g
    cam_detected_label: 'Biscuits',
    cam_confidence: 0.94,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:02',
    hardware_battery_pct: 94,
    hardware_online: true,
  },
  'Aisle 4 · Rack C': {
    id: 'sensor-shampoo',
    shelf_id: 'Aisle 4 · Rack C',
    ir_sensor_state: true,
    load_cell_weight_g: 450, // 1 * 450g
    cam_detected_label: 'Shampoo',
    cam_confidence: 0.91,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:03',
    hardware_battery_pct: 89,
    hardware_online: true,
  },
  'Aisle 2 · Rack A': {
    id: 'sensor-rice',
    shelf_id: 'Aisle 2 · Rack A',
    ir_sensor_state: true,
    load_cell_weight_g: 15000,
    cam_detected_label: 'Rice',
    cam_confidence: 0.96,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:04',
    hardware_battery_pct: 95,
    hardware_online: true,
  },
  'Aisle 5 · Rack B': {
    id: 'sensor-juice',
    shelf_id: 'Aisle 5 · Rack B',
    ir_sensor_state: true,
    load_cell_weight_g: 6000,
    cam_detected_label: 'Juice',
    cam_confidence: 0.97,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:05',
    hardware_battery_pct: 92,
    hardware_online: true,
  },
  'Aisle 6 · Rack A': {
    id: 'sensor-soap',
    shelf_id: 'Aisle 6 · Rack A',
    ir_sensor_state: true,
    load_cell_weight_g: 1050,
    cam_detected_label: 'Soap',
    cam_confidence: 0.95,
    timestamp: new Date().toISOString(),
    device_mac: '24:6F:28:B2:1A:06',
    hardware_battery_pct: 90,
    hardware_online: true,
  },
};

export const SEED_ALERTS: Alert[] = [
  {
    id: 'alert-101',
    product_id: 'shampoo',
    product_name: 'Shampoo',
    shelf_id: 'Aisle 4 · Rack C',
    alert_type: 'LOW_STOCK',
    message: 'Shampoo stock is at a critical level (only 1 item remaining). Immediate restock needed.',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 120 * 1000).toISOString(),
    metadata: {
      current_stock: 1,
      min_threshold: 5,
    },
  },
  {
    id: 'alert-102',
    product_id: 'biscuits',
    product_name: 'Biscuits',
    shelf_id: 'Aisle 3 · Rack B',
    alert_type: 'LOW_STOCK',
    message: 'Biscuits stock has fallen below minimum threshold (4 remaining out of 20).',
    severity: 'WARNING',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 480 * 1000).toISOString(),
    metadata: {
      current_stock: 4,
      min_threshold: 7,
    },
  },
  {
    id: 'alert-103',
    product_id: 'shampoo',
    product_name: 'Shampoo',
    shelf_id: 'Aisle 2 · Rack A',
    alert_type: 'MISPLACED',
    message: 'AI camera detected Shampoo bottle placed incorrectly in Aisle 2 (Rice Rack) instead of Aisle 4.',
    severity: 'WARNING',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 840 * 1000).toISOString(),
    metadata: {
      expected_product: 'Rice',
      detected_product: 'Shampoo',
    },
  },
  {
    id: 'alert-104',
    product_id: 'soap',
    product_name: 'Soap',
    shelf_id: 'Aisle 6 · Rack A',
    alert_type: 'LOW_STOCK',
    message: 'Soap inventory is low (7 items remaining). Order queued for supplier.',
    severity: 'WARNING',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 1320 * 1000).toISOString(),
    metadata: {
      current_stock: 7,
      min_threshold: 7,
    },
  },
  {
    id: 'alert-105',
    product_id: 'rice',
    product_name: 'Rice',
    shelf_id: 'Aisle 2 · Rack A',
    alert_type: 'TAMPERING',
    message: 'Weight sensor detected sudden unverified weight change on Rice shelf.',
    severity: 'CRITICAL',
    status: 'ACTIVE',
    created_at: new Date(Date.now() - 1860 * 1000).toISOString(),
    metadata: {
      expected_weight_g: 15000,
      measured_weight_g: 13200,
      weight_diff_g: 1800,
    },
  },
];
