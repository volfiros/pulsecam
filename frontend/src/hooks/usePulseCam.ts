import { useRef, useEffect, useState, useCallback } from "react";
import {
  WS_URL,
  HEALTH_CHECK_URL,
  COLD_START_MAX_WAIT_MS,
  COLD_START_CHECK_INTERVAL_MS,
  COLD_START_ABORT_TIMEOUT_MS,
  MAX_WS_RETRIES,
  WS_RETRY_BASE_MS,
  type Phase,
  type MeasurementStatus,
  type WSResponse,
} from "../lib/constants";

async function waitForServer(maxWaitMs = COLD_START_MAX_WAIT_MS): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(HEALTH_CHECK_URL, {
        signal: AbortSignal.timeout(COLD_START_ABORT_TIMEOUT_MS),
      });
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, COLD_START_CHECK_INTERVAL_MS));
  }
  return false;
}

interface SessionReading {
  bpm: number;
  confidence: number;
}

export function usePulseCam() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bpm, setBpm] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [status, setStatus] = useState<MeasurementStatus>("buffering");
  const [duration, setDuration] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalStop = useRef(false);
  const retryCount = useRef(0);
  const reconnectScheduled = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const sessionReadings = useRef<SessionReading[]>([]);
  const [finalBpm, setFinalBpm] = useState(0);
  const [finalConfidence, setFinalConfidence] = useState(0);

  const connect = useCallback(() => {
    if (intentionalStop.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setPhase("measuring");
      retryCount.current = 0;
      startTimeRef.current = Date.now();
    };

    ws.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        if (raw.error) {
          setStatus("error");
          return;
        }
        const data: WSResponse = raw;
        setBpm(data.bpm);
        setConfidence(data.confidence);
        setWaveform(data.waveform);
        setStatus(data.status);

        if (data.effective_fps) {
          console.log(`[PulseCam] BPM=${data.raw_bpm} conf=${data.confidence.toFixed(2)} fps=${data.effective_fps} status=${data.status}`);
        }

        const readingBpm = data.raw_bpm > 0 ? data.raw_bpm : data.bpm;
        if (readingBpm >= 40 && readingBpm <= 220 && data.confidence > 0.05) {
          sessionReadings.current.push({ bpm: readingBpm, confidence: data.confidence });
        }
      } catch (e) {
        console.error("Failed to parse WebSocket message:", e);
      }
    };

    ws.onerror = () => {
      if (intentionalStop.current) return;
      if (retryCount.current < MAX_WS_RETRIES) {
        const delay = WS_RETRY_BASE_MS * Math.pow(2, retryCount.current);
        retryCount.current++;
        reconnectScheduled.current = true;
        setTimeout(() => {
          reconnectScheduled.current = false;
          connect();
        }, delay);
      } else {
        setPhase("error");
      }
    };

    ws.onclose = () => {
      if (intentionalStop.current) return;
      if (!reconnectScheduled.current) {
        setTimeout(() => connect(), 3000);
      }
    };
  }, []);

  const sendFrame = useCallback((r: number, g: number, b: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ r, g, b }));
    }
  }, []);

  const start = useCallback(async () => {
    intentionalStop.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setBpm(0);
    setFinalBpm(0);
    setFinalConfidence(0);
    setConfidence(0);
    setWaveform([]);
    setStatus("buffering");
    setDuration(0);
    startTimeRef.current = null;
    sessionReadings.current = [];
    setPhase("checking");

    const isUp = await waitForServer();
    if (!isUp) {
      setPhase("error");
      return;
    }

    setPhase("connecting");
    connect();
  }, [connect]);

  const stop = useCallback(() => {
    intentionalStop.current = true;
    wsRef.current?.close();
    wsRef.current = null;
    if (startTimeRef.current) {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
    }

    const readings = sessionReadings.current;

    if (readings.length === 0) {
      setFinalBpm(bpm > 0 ? bpm : 0);
      setFinalConfidence(0);
    } else {
      const sorted = [...readings].sort((a, b) => a.bpm - b.bpm);
      const confidences = sorted.map((r) => r.confidence);
      const bpms = sorted.map((r) => r.bpm);

      const cumWeights: number[] = [];
      let runningTotal = 0;
      for (const c of confidences) {
        runningTotal += c;
        cumWeights.push(runningTotal);
      }
      const half = runningTotal / 2;

      let medianIdx = 0;
      for (let i = 0; i < cumWeights.length; i++) {
        if (cumWeights[i] >= half) {
          medianIdx = i;
          break;
        }
      }
      const weightedMedian = Math.round(bpms[medianIdx]);

      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of readings) {
        weightedSum += r.bpm * r.confidence;
        weightTotal += r.confidence;
      }
      const weightedAvg = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : weightedMedian;

      const avgConfidence = Math.round(
        (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
      );

      setFinalBpm(weightedAvg);
      setFinalConfidence(avgConfidence);
    }

    setPhase("results");
  }, [bpm]);

  useEffect(() => {
    return () => {
      intentionalStop.current = true;
      wsRef.current?.close();
    };
  }, []);

  return { phase, bpm, finalBpm, finalConfidence, confidence, waveform, status, duration, sendFrame, start, stop };
}
