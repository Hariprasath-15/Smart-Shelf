import type { Product, SensorData, Alert, SystemStatus, DashboardMetrics, AIModulesStatus } from '../types/index.js';

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch('/api/products');
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create product');
  }
  return res.json();
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update product');
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete product');
}

export async function fetchSensors(): Promise<Record<string, SensorData>> {
  const res = await fetch('/api/sensors/latest');
  if (!res.ok) throw new Error('Failed to fetch sensors');
  return res.json();
}

export async function postSensorPayload(payload: Partial<SensorData> & { shelf_id: string }): Promise<any> {
  const res = await fetch('/api/sensors/payload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to post sensor payload');
  return res.json();
}

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch('/api/alerts');
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function restockProduct(id: string): Promise<any> {
  const res = await fetch(`/api/products/${id}/restock`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to restock product');
  return res.json();
}

export async function restockAllProducts(): Promise<any> {
  const res = await fetch('/api/products/restock-all', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to restock all products');
  return res.json();
}

export async function relocateAlert(id: string): Promise<any> {
  const res = await fetch(`/api/alerts/${id}/relocate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to relocate product');
  return res.json();
}

export async function resolveAlert(id: string): Promise<Alert> {
  const res = await fetch(`/api/alerts/${id}/resolve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to resolve alert');
  return res.json();
}

export async function resolveAllAlerts(): Promise<{ success: boolean; count: number }> {
  const res = await fetch('/api/alerts/resolve-all', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to resolve all alerts');
  return res.json();
}

export async function fetchStatus(): Promise<SystemStatus> {
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

export async function toggleAIModule(moduleKey: keyof AIModulesStatus, state?: boolean): Promise<{ success: boolean; ai_modules: AIModulesStatus }> {
  const res = await fetch('/api/status/toggle-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ moduleKey, state }),
  });
  if (!res.ok) throw new Error('Failed to toggle AI module');
  return res.json();
}

export async function setHardwareOnline(online: boolean): Promise<{ success: boolean; hardware_online: boolean }> {
  const res = await fetch('/api/status/hardware-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ online }),
  });
  if (!res.ok) throw new Error('Failed to update hardware connection state');
  return res.json();
}

export async function fetchMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/metrics');
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}

export async function triggerSimulationAction(action: string, shelf_id?: string, extra?: Record<string, any>): Promise<any> {
  const res = await fetch('/api/sensors/simulate-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, shelf_id, ...extra }),
  });
  if (!res.ok) throw new Error('Failed to execute simulation action');
  return res.json();
}
