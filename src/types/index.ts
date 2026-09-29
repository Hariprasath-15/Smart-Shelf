export interface Product {
  id: string;
  name: string;
  category: string;
  image_url: string;
  shelf_position: string;
  expected_weight_g: number;
  min_threshold: number;
  current_stock: number;
  max_capacity: number;
  last_restocked?: string;
  created_at: string;
  updated_at?: string;
}

export interface SensorData {
  id: string;
  shelf_id: string;
  ir_sensor_state: boolean; // true = beam interrupted / item present; false = clear
  load_cell_weight_g: number;
  cam_detected_label: string;
  cam_confidence: number;
  timestamp: string;
  device_mac: string;
  hardware_battery_pct: number;
  hardware_online: boolean;
  live_image_base64?: string;
  stream_url?: string;
  yolo_count?: number;
  yolo_detections?: Array<{
    label: string;
    confidence: number;
    bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized (0-1000) or pixels
  }>;
}

export type AlertType = 'LOW_STOCK' | 'MISPLACED' | 'TAMPERING' | 'OFFLINE';
export type AlertSeverity = 'WARNING' | 'CRITICAL' | 'INFO';
export type AlertStatus = 'ACTIVE' | 'RESOLVED';

export interface Alert {
  id: string;
  product_id?: string;
  product_name: string;
  shelf_id: string;
  alert_type: AlertType;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: string;
  resolved_at?: string;
  metadata?: {
    expected_weight_g?: number;
    measured_weight_g?: number;
    weight_diff_g?: number;
    expected_product?: string;
    detected_product?: string;
    current_stock?: number;
    min_threshold?: number;
  };
}

export interface AIModulesStatus {
  product_recognition: boolean;
  low_stock_predictor: boolean;
  misplaced_scanner: boolean;
  weight_tamper_detection: boolean;
  cloud_sync: 'synced' | 'syncing' | 'error';
}

export interface SystemStatus {
  hardware_online: boolean;
  last_heartbeat: string;
  ping_interval_ms: number;
  ai_modules: AIModulesStatus;
  active_sensors_count: number;
  server_time: string;
  uptime_seconds: number;
}

export interface DashboardMetrics {
  total_products_per_shelf: { shelf_id: string; product_count: number; total_stock: number }[];
  total_stock_count: number;
  low_stock_count: number;
  misplaced_count: number;
  active_alerts_count: number;
  tampering_count: number;
}
