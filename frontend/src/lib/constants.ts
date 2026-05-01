export const FPS = 30;
export const COLD_START_MAX_WAIT_MS = 90000;
export const COLD_START_CHECK_INTERVAL_MS = 3000;
export const COLD_START_ABORT_TIMEOUT_MS = 5000;
export const HEALTH_CHECK_URL = "/health";
export const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
export const MAX_WS_RETRIES = 5;
export const WS_RETRY_BASE_MS = 2000;

export type Phase =
  | "idle"
  | "checking"
  | "connecting"
  | "measuring"
  | "results"
  | "error";

export type MeasurementStatus =
  | "buffering"
  | "calibrating"
  | "measuring"
  | "poor_signal"
  | "error";

export interface MethodResult {
  bpm: number;
  snr: number;
}

export interface WSResponse {
  bpm: number;
  raw_bpm: number;
  confidence: number;
  waveform: number[];
  status: MeasurementStatus;
  methods: Record<string, MethodResult>;
  best_method: string;
  agreement: number;
  motion: number;
}
