import numpy as np
from scipy.signal import butter, filtfilt, find_peaks
from collections import deque
import time


class SignalProcessor:
    def __init__(self, fps: int = 30, buffer_seconds: float = 15.0):
        self.fps = fps
        self.capacity = int(fps * buffer_seconds)
        self.r_buffer: deque[float] = deque(maxlen=self.capacity)
        self.g_buffer: deque[float] = deque(maxlen=self.capacity)
        self.b_buffer: deque[float] = deque(maxlen=self.capacity)
        self.last_compute_time = 0.0
        self.compute_interval = 1.0
        self.low_hz = 0.7
        self.high_hz = 4.0
        self.filter_order = 4
        self.min_calibrate_samples: int = fps * 5
        self.min_measuring_samples: int = fps * 15
        self._last_result: dict = {
            "bpm": 0,
            "confidence": 0.0,
            "waveform": [],
            "status": "buffering",
        }

    def append(self, r: float, g: float, b: float) -> None:
        self.r_buffer.append(r)
        self.g_buffer.append(g)
        self.b_buffer.append(b)

    def _compute_chrom(self, r_arr: np.ndarray, g_arr: np.ndarray, b_arr: np.ndarray) -> np.ndarray:
        xs = 3.0 * g_arr - 2.0 * r_arr
        ys = 1.5 * r_arr + 1.5 * g_arr - 3.0 * b_arr
        xs_mean = np.mean(xs)
        ys_mean = np.mean(ys)
        xs_centered = xs - xs_mean
        ys_centered = ys - ys_mean
        std_ys = np.std(ys_centered)
        alpha = np.std(xs_centered) / std_ys if std_ys > 1e-10 else 1.0
        return xs_centered - alpha * ys_centered

    def _bandpass_filter(self, signal: np.ndarray) -> np.ndarray:
        min_len = 3 * (self.filter_order + 1)
        if len(signal) < min_len:
            return signal
        nyquist = self.fps / 2.0
        low = self.low_hz / nyquist
        high = self.high_hz / nyquist
        b, a = butter(self.filter_order, [low, high], btype="band")
        return filtfilt(b, a, signal)

    def _compute_bpm(self, filtered: np.ndarray, duration: float) -> float:
        min_distance = self.fps * (60.0 / 240.0)
        peaks, _ = find_peaks(filtered, distance=min_distance)
        if duration <= 0:
            return 0.0
        return (len(peaks) / duration) * 60.0

    def _compute_snr(self, filtered: np.ndarray, original: np.ndarray) -> float:
        residual = original - filtered
        signal_var = np.var(filtered)
        residual_var = np.var(residual)
        if signal_var < 1e-10:
            return 0.0
        if residual_var < 1e-10:
            return 100.0
        return 10.0 * np.log10(signal_var / residual_var)

    def _get_status(self, n_samples: int, snr: float, bpm: float) -> str:
        if n_samples < self.min_calibrate_samples:
            return "buffering"
        if n_samples < self.min_measuring_samples:
            return "calibrating"
        if snr < 2.0 or bpm < 40 or bpm > 200:
            return "poor_signal"
        return "measuring"

    def _get_confidence(self, n_samples: int, snr: float) -> float:
        buffer_ratio = min(n_samples / self.min_measuring_samples, 1.0)
        snr_score = min(snr / 20.0, 1.0)
        return round(buffer_ratio * 0.6 + snr_score * 0.4, 2)

    def process(self, r: float, g: float, b: float) -> dict:
        self.append(r, g, b)
        now = time.time()

        n = len(self.r_buffer)
        if n < self.min_calibrate_samples:
            self._last_result = {
                "bpm": 0,
                "confidence": 0.0,
                "waveform": [],
                "status": "buffering",
            }
            return self._last_result

        if now - self.last_compute_time < self.compute_interval:
            return self._last_result

        self.last_compute_time = now

        r_arr = np.array(self.r_buffer)
        g_arr = np.array(self.g_buffer)
        b_arr = np.array(self.b_buffer)

        chrom = self._compute_chrom(r_arr, g_arr, b_arr)
        filtered = self._bandpass_filter(chrom)

        duration = n / self.fps
        bpm = self._compute_bpm(filtered, duration)
        snr = self._compute_snr(filtered, chrom)
        status = self._get_status(n, snr, bpm)
        confidence = self._get_confidence(n, snr)

        self._last_result = {
            "bpm": round(bpm, 1),
            "confidence": confidence,
            "waveform": filtered[-450:].tolist() if len(filtered) > 450 else filtered.tolist(),
            "status": status,
        }
        return self._last_result
