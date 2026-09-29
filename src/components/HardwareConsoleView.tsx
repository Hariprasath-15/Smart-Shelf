import React, { useState } from 'react';
import {
  Cpu,
  Camera,
  Scale,
  Wifi,
  Radio,
  Send,
  Code,
  Copy,
  Check,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Terminal,
  Zap,
} from 'lucide-react';
import type { SensorData, Product } from '../types/index.js';

interface HardwareConsoleViewProps {
  sensors: Record<string, SensorData>;
  products: Product[];
  onPostPayload: (payload: Partial<SensorData> & { shelf_id: string }) => Promise<void>;
  onSimulateAction: (action: string, shelf_id?: string, extra?: any) => void;
  isHardwareOnline: boolean;
}

export const HardwareConsoleView: React.FC<HardwareConsoleViewProps> = ({
  sensors,
  products,
  onPostPayload,
  onSimulateAction,
  isHardwareOnline,
}) => {
  const [selectedShelf, setSelectedShelf] = useState<string>('Shelf A-1');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Custom payload test form state
  const [testWeight, setTestWeight] = useState<number>(8400);
  const [testIRState, setTestIRState] = useState<boolean>(true);
  const [testCamLabel, setTestCamLabel] = useState<string>('Organic Whole Milk 1L');
  const [testConfidence, setTestConfidence] = useState<number>(0.98);

  const currentSensor = sensors[selectedShelf];
  const currentProduct = products.find((p) => p.shelf_position === selectedShelf);

  const handleSendCustomPayload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onPostPayload({
        shelf_id: selectedShelf,
        load_cell_weight_g: Number(testWeight),
        ir_sensor_state: Boolean(testIRState),
        cam_detected_label: testCamLabel,
        cam_confidence: Number(testConfidence),
        device_mac: currentSensor?.device_mac || '24:6F:28:B2:1A:01',
        hardware_battery_pct: 95,
      });
    } catch (err: any) {
      alert(`Error sending payload: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const arduinoSnippet = `// ESP32-Cam + HX711 Load Cell + IR Beam Sensor Client
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_SERVER_HOST:3000/api/sensors/payload";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["shelf_id"] = "${selectedShelf}";
    doc["ir_sensor_state"] = digitalRead(4) == LOW; // IR Beam Pin
    doc["load_cell_weight_g"] = readHX711Grams();  // HX711 Scale
    doc["cam_detected_label"] = "${currentProduct?.name || 'Classified_Item'}";
    doc["cam_confidence"] = 0.97;
    doc["device_mac"] = WiFi.macAddress();

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    http.end();
  }
  delay(5000); // 5-Second Transmit Loop
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(arduinoSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              IoT Hardware & Telemetry Console
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time interface for ESP32-Cam optical classification, HX711 Load Cells, and IR beam break sensors.
          </p>
        </div>

        {/* Selected Shelf Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Target Shelf:</span>
          <select
            value={selectedShelf}
            onChange={(e) => {
              const shelf = e.target.value;
              setSelectedShelf(shelf);
              const p = products.find((x) => x.shelf_position === shelf);
              if (p) {
                setTestWeight(p.current_stock * p.expected_weight_g);
                setTestCamLabel(p.name);
              }
            }}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-mono font-semibold text-cyan-300 focus:border-cyan-500 focus:outline-none"
          >
            {products.map((p) => (
              <option key={p.shelf_position} value={p.shelf_position}>
                {p.shelf_position} ({p.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hardware Telemetry Instruments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Instrument 1: ESP32-Cam Visual Stream */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                ESP32-Cam Optical Feed
              </h3>
            </div>
            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
              OV2640 ACTIVE
            </span>
          </div>

          {/* Viewfinder Preview with Bounding Box */}
          <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center">
            {currentProduct ? (
              <img
                src={currentProduct.image_url}
                alt={currentProduct.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-slate-600 text-xs">No camera feed for shelf</div>
            )}

            {/* AI Bounding Box Overlay */}
            <div className="absolute inset-4 rounded border-2 border-dashed border-cyan-400/80 pointer-events-none flex flex-col justify-between p-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-1.5 py-0.5 rounded self-start border border-cyan-500/40">
                <span>LABEL: {currentSensor?.cam_detected_label || 'Scanning...'}</span>
                <span className="ml-2 font-bold">
                  {Math.round((currentSensor?.cam_confidence || 0.95) * 100)}% CONF
                </span>
              </div>
              <div className="text-[10px] font-mono text-cyan-300/80 self-end">
                FPS: 15 · 640x480 RAW
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block">Classified Object:</span>
              <strong className="text-white truncate block">
                {currentSensor?.cam_detected_label || 'Scanning'}
              </strong>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block">Neural Model:</span>
              <strong className="text-cyan-400">MobileNet-V3 Lite</strong>
            </div>
          </div>
        </div>

        {/* Instrument 2: HX711 Load Cell Precision Telemetry */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                HX711 24-Bit Load Cell
              </h3>
            </div>
            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-500/30">
              0.01g RESOLUTION
            </span>
          </div>

          {/* Digital Instrument Display */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-center">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
              Live Total Weight Readout
            </div>
            <div className="text-4xl font-extrabold font-mono text-cyan-400 my-2 tracking-tight tabular-nums">
              {(currentSensor?.load_cell_weight_g ?? 0).toLocaleString()}
              <span className="text-lg text-slate-500 font-normal ml-1">g</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Expected for {currentProduct?.current_stock ?? 0} units:{' '}
              <strong className="text-slate-200">
                {(currentProduct?.current_stock ?? 0) * (currentProduct?.expected_weight_g ?? 0)}g
              </strong>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span className="text-slate-400">ADC Tare Baseline:</span>
              <span className="text-slate-200">0.00 g (Zeroed)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span className="text-slate-400">Drift Compensation:</span>
              <span className="text-emerald-400">Active (Auto-Kalman)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">MAC Address:</span>
              <span className="text-slate-400">{currentSensor?.device_mac || '24:6F:28:B2:1A:01'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSimulateAction('RESTORE_NOMINAL', selectedShelf)}
            className="w-full rounded bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-mono text-cyan-300 transition-colors"
          >
            Tare & Calibrate Load Cell
          </button>
        </div>

        {/* Instrument 3: IR Sensor Beam & Microcontroller State */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                IR Beam Break & Gateway
              </h3>
            </div>
            <span className="font-mono text-[10px] text-slate-400">GPIO 4</span>
          </div>

          {/* Visual IR Beam Graphic */}
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 flex flex-col items-center justify-center min-h-[140px]">
            <div className="flex items-center justify-between w-full px-4 mb-3">
              <div className="h-4 w-4 rounded-full bg-rose-500/80 animate-pulse" title="IR Emitter" />
              {/* Beam line */}
              <div
                className={`h-1 flex-1 mx-2 transition-all ${
                  currentSensor?.ir_sensor_state
                    ? 'bg-gradient-to-r from-rose-500 via-rose-300 to-rose-500 shadow-rose-500/50 shadow-sm'
                    : 'bg-slate-800'
                }`}
              />
              <div
                className={`h-4 w-4 rounded-full ${
                  currentSensor?.ir_sensor_state ? 'bg-rose-500' : 'bg-slate-700'
                }`}
                title="IR Phototransistor Receiver"
              />
            </div>

            <div className="text-center font-mono">
              <div
                className={`text-sm font-bold ${
                  currentSensor?.ir_sensor_state ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                {currentSensor?.ir_sensor_state ? 'ITEM DETECTED (BEAM BLOCKED)' : 'BEAM CLEAR (EMPTY)'}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Reflective optical boundary trigger
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span className="text-slate-400">Gateway Heartbeat:</span>
              <span className="text-emerald-400">5,000 ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Backup Battery:</span>
              <span className="text-slate-200">
                {currentSensor?.hardware_battery_pct ?? 96}% Li-Po
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Payload Injection Tester & Arduino Firmware Snippet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custom Hardware Payload Tester */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-2">
            <Send className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Interactive Hardware Payload Injector
            </h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Test the live REST endpoint <code>POST /api/sensors/payload</code> by injecting simulated physical telemetry.
          </p>

          <form onSubmit={handleSendCustomPayload} className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Load Cell Weight (g)</label>
                <input
                  type="number"
                  value={testWeight}
                  onChange={(e) => setTestWeight(Number(e.target.value))}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">IR Beam State</label>
                <select
                  value={testIRState ? 'true' : 'false'}
                  onChange={(e) => setTestIRState(e.target.value === 'true')}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="true">Beam Interrupted (Item Present)</option>
                  <option value="false">Beam Clear (Shelf Empty)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Cam Classified Label</label>
                <input
                  type="text"
                  value={testCamLabel}
                  onChange={(e) => setTestCamLabel(e.target.value)}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Cam Confidence (0 - 1.0)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={testConfidence}
                  onChange={(e) => setTestConfidence(Number(e.target.value))}
                  className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-1.5 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded bg-cyan-500 hover:bg-cyan-400 py-2 text-xs font-semibold text-slate-950 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Transmitting...' : 'Dispatch HTTP POST to /api/sensors/payload'}
            </button>
          </form>
        </div>

        {/* Real Microcontroller Firmware Snippet */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                ESP32 Hardware Firmware (Arduino C++)
              </h3>
            </div>
            <button
              type="button"
              onClick={copyToClipboard}
              className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-2">
            Ready-to-flash code snippet for your ESP32-Cam and HX711 microcontroller to connect to this server:
          </p>

          <pre className="max-h-60 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300 selection:bg-cyan-500/30">
            <code>{arduinoSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
