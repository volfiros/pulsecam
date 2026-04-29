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

export function usePulseCam() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bpm, setBpm] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [status, setStatus] = useState<MeasurementStatus>("buffering");
  const wsRef = useRef<WebSocket | null>(null);
  const intentionalStop = useRef(false);
  const retryCount = useRef(0);
  const reconnectScheduled = useRef(false);

  const connect = useCallback(() => {
    if (intentionalStop.current) return;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setPhase("measuring");
      retryCount.current = 0;
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
    setPhase("idle");
    setBpm(0);
    setConfidence(0);
    setWaveform([]);
    setStatus("buffering");
  }, []);

  useEffect(() => {
    return () => {
      intentionalStop.current = true;
      wsRef.current?.close();
    };
  }, []);

  return { phase, bpm, confidence, waveform, status, sendFrame, start, stop };
}
