import numpy as np
from scipy.signal import butter, sosfiltfilt, welch
from collections import deque
import time


class SignalProcessor:
    def __init__(self, fps: int = 30, buffer_seconds: float = 15.0):
        self._nominal_fps = fps
        self._effective_fps = float(fps)
        self.capacity = int(fps * buffer_seconds)
        self.r_buffer: deque[float] = deque(maxlen=self.capacity)
        self.g_buffer: deque[float] = deque(maxlen=self.capacity)
        self.b_buffer: deque[float] = deque(maxlen=self.capacity)
        self._sample_times: deque[float] = deque(maxlen=self.capacity)
        self.last_compute_time = 0.0
        self.compute_interval = 0.5
        self.low_hz = 0.5
        self.high_hz = 5.0
        self.filter_order = 3
        self.min_calibrate_samples: int = fps * 5
        self.min_measuring_samples: int = fps * 10
        self.bpm_history: deque[float] = deque(maxlen=30)
        self.confidence_history: deque[float] = deque(maxlen=30)
        self._ema_bpm: float = 0.0
        self._ema_alpha: float = 0.2
        self._last_result: dict = {
            "bpm": 0,
            "raw_bpm": 0.0,
            "confidence": 0.0,
            "waveform": [],
            "status": "buffering",
        }
        self.just_computed: bool = False
        self._session_bpms: list[float] = []
        self._session_confidences: list[float] = []

    def append(self, r: float, g: float, b: float) -> None:
        self.r_buffer.append(r)
        self.g_buffer.append(g)
        self.b_buffer.append(b)
        self._sample_times.append(time.time())

    def _update_effective_fps(self) -> None:
        if len(self._sample_times) < 20:
            return
        sample_times = list(self._sample_times)
        recent = sample_times[-120:]
        total_span = recent[-1] - recent[0]
        if total_span < 2.0:
            return
        n_recent = len(recent)
        if n_recent < 5:
            return
        avg_fps = (n_recent - 1) / total_span
        intervals = np.diff(recent)
        valid = intervals[intervals > 0.001]
        if len(valid) < 5:
            self._effective_fps = max(6.0, min(self._nominal_fps, avg_fps))
            return
        median_interval = float(np.median(valid))
        if median_interval < 0.003:
            self._effective_fps = avg_fps
            return
        median_fps = 1.0 / median_interval
        self._effective_fps = max(6.0, min(self._nominal_fps, (avg_fps + median_fps) / 2.0))

    def _detrend_ma(self, signal: np.ndarray, window_seconds: float = 2.0) -> np.ndarray:
        window = max(int(self._nominal_fps * window_seconds), 3)
        if len(signal) <= window:
            return signal - np.mean(signal)
        kernel = np.ones(window) / window
        trend = np.convolve(signal, kernel, mode="same")
        return signal - trend

    def _extract_g_signal(self, g_arr: np.ndarray) -> np.ndarray:
        g_mean = np.mean(g_arr)
        if g_mean < 1e-10:
            return np.zeros_like(g_arr)
        raw = g_arr / g_mean - 1.0
        return self._detrend_ma(raw)

    def _compute_chrom(self, r_arr: np.ndarray, g_arr: np.ndarray, b_arr: np.ndarray) -> np.ndarray:
        r_mean = np.mean(r_arr)
        g_mean = np.mean(g_arr)
        b_mean = np.mean(b_arr)
        if r_mean < 1e-10 or g_mean < 1e-10 or b_mean < 1e-10:
            return np.zeros_like(r_arr)
        r_norm = r_arr / r_mean - 1.0
        g_norm = g_arr / g_mean - 1.0
        b_norm = b_arr / b_mean - 1.0

        xs = 3.0 * r_norm - 2.0 * g_norm
        ys = 1.5 * r_norm + g_norm - 1.5 * b_norm

        std_xs = np.std(xs)
        std_ys = np.std(ys)
        alpha = std_xs / std_ys if std_ys > 1e-10 else 1.0

        chrom = xs - alpha * ys
        return self._detrend_ma(chrom)

    def _bandpass_filter(self, signal: np.ndarray) -> np.ndarray:
        min_len = 3 * (self.filter_order + 1)
        if len(signal) < min_len:
            return signal
        fps = max(self._effective_fps, 8.0)
        nyquist = fps / 2.0
        low = self.low_hz / nyquist
        high = self.high_hz / nyquist
        sos = butter(self.filter_order, [low, high], btype="band", output="sos")
        return sosfiltfilt(sos, signal)

    def _autocorrelation_bpm(self, signal: np.ndarray) -> tuple[float, float]:
        n = len(signal)
        fps = self._effective_fps
        if n < fps * 2:
            return 0.0, 0.0

        signal = signal - np.mean(signal)
        std = np.std(signal)
        if std > 1e-10:
            signal = signal / std

        autocorr = np.correlate(signal, signal, mode="full")
        autocorr = autocorr[n - 1:]
        autocorr = autocorr / autocorr[0] if autocorr[0] > 1e-10 else autocorr

        max_lag = int(fps / (40.0 / 60.0))
        min_lag = int(fps / (220.0 / 60.0))

        if len(autocorr) <= max_lag:
            return 0.0, 0.0

        region = autocorr[min_lag:max_lag]
        if len(region) < 3:
            return 0.0, 0.0

        peak_idx = -1
        peak_val = 0.0
        for i in range(1, len(region) - 1):
            if region[i] > region[i - 1] and region[i] > region[i + 1] and region[i] > 0.06:
                peak_idx = i
                peak_val = region[i]
                break

        if peak_idx < 0 or peak_val < 0.06:
            return 0.0, 0.0

        a = region[peak_idx - 1]
        b = region[peak_idx]
        c = region[peak_idx + 1]
        denom = a - 2.0 * b + c
        delta = 0.5 * (a - c) / denom if abs(denom) > 1e-10 else 0.0
        delta = max(-0.5, min(0.5, delta))

        lag = float(peak_idx + min_lag) + delta
        bpm = float(60.0 * fps / lag)
        quality = min(peak_val / 0.4, 1.0)
        return bpm, quality

    def _welch_bpm(self, signal: np.ndarray) -> tuple[float, float]:
        n = len(signal)
        fps = self._effective_fps
        samples_per_seg = max(int(fps * 4), 64)
        noverlap = samples_per_seg // 2

        if n < samples_per_seg:
            return 0.0, 0.0

        freqs, psd = welch(signal, fs=fps, nperseg=samples_per_seg, noverlap=noverlap)

        valid = (freqs >= 40.0 / 60.0) & (freqs <= 220.0 / 60.0)
        if not np.any(valid):
            return 0.0, 0.0

        vf = freqs[valid]
        vp = psd[valid]

        peak_idx = int(np.argmax(vp))
        peak_power = vp[peak_idx]
        total_power = np.sum(vp)
        prominence = peak_power / total_power if total_power > 1e-10 else 0.0

        return float(vf[peak_idx] * 60.0), prominence

    def _compute_bpm(self, signal: np.ndarray) -> tuple[float, float]:
        n = len(signal)
        if n < self._effective_fps * 2:
            return 0.0, 0.0

        welch_bpm, welch_prom = self._welch_bpm(signal)
        ac_bpm, ac_quality = self._autocorrelation_bpm(signal)

        welch_valid = 40.0 <= welch_bpm <= 220.0 and welch_prom > 0.08
        ac_valid = 40.0 <= ac_bpm <= 220.0

        if not welch_valid and not ac_valid:
            return 0.0, 0.0

        if welch_valid and not ac_valid:
            return welch_bpm, welch_prom

        if ac_valid and not welch_valid:
            low_cutoff = max(0.5 / self._effective_fps * 60, 45)
            if ac_bpm < low_cutoff:
                return ac_bpm, ac_quality * 0.4
            return ac_bpm, ac_quality * 0.6

        ratio = max(ac_bpm, welch_bpm) / min(ac_bpm, welch_bpm) if min(ac_bpm, welch_bpm) > 1e-10 else 999

        if ratio < 1.15:
            bpm = (ac_bpm + welch_bpm) / 2.0
            rating = max(ac_quality, welch_prom) * 1.3
        elif ratio < 1.3:
            bpm = (ac_bpm + welch_bpm) / 2.0
            rating = max(ac_quality, welch_prom)
        elif 1.7 <= ratio <= 2.4:
            if welch_prom >= ac_quality:
                bpm = welch_bpm
            else:
                bpm = max(ac_bpm, welch_bpm)
            rating = max(ac_quality, welch_prom) * 0.6
        else:
            if welch_prom > ac_quality * 2.0:
                bpm = welch_bpm
            else:
                bpm = ac_bpm if ac_quality >= welch_prom * 2.0 else welch_bpm
            rating = max(ac_quality, welch_prom) * 0.4

        return bpm, rating

    def _compute_snr(self, filtered: np.ndarray, original: np.ndarray) -> float:
        residual = original - filtered
        signal_var = np.var(filtered)
        residual_var = np.var(residual)
        if signal_var < 1e-10:
            return 0.0
        if residual_var < 1e-10:
            return 80.0
        return 10.0 * np.log10(signal_var / residual_var)

    def _get_status(self, n_samples: int, snr: float, bpm: float, bpm_rating: float, agreement: float) -> str:
        if n_samples < self.min_calibrate_samples:
            return "buffering"
        if n_samples < self.min_measuring_samples:
            return "calibrating"
        if snr < 1.0 or bpm < 40 or bpm > 220 or bpm_rating < 0.03:
            return "poor_signal"
        if agreement < 0.3:
            return "poor_signal"
        return "measuring"

    def _get_confidence(self, n_samples: int, snr: float, bpm_rating: float, agreement: float, temporal_consistency: float) -> float:
        buffer_score = min(n_samples / self.min_measuring_samples, 1.0)
        snr_score = min(max(snr, 0) / 12.0, 1.0)
        rating_score = min(bpm_rating * 3.5, 1.0)

        confidence = buffer_score * 0.15 + snr_score * 0.20 + rating_score * 0.30 + agreement * 0.15 + temporal_consistency * 0.20
        return round(confidence, 2)

    def get_session_summary(self) -> dict:
        if not self._session_bpms:
            return {"avg_bpm": 0, "avg_confidence": 0.0, "reading_count": 0}

        valid_pairs = [(b, c) for b, c in zip(self._session_bpms, self._session_confidences) if c > 0.05 and 40 <= b <= 220]
        if not valid_pairs:
            return {"avg_bpm": 0, "avg_confidence": 0.0, "reading_count": 0}

        sorted_pairs = sorted(valid_pairs, key=lambda x: x[0])
        bpms_sorted = [p[0] for p in sorted_pairs]
        confs_sorted = [p[1] for p in sorted_pairs]
        cum_weights = np.cumsum(confs_sorted)
        total_weight = cum_weights[-1]

        if total_weight < 1e-10:
            return {"avg_bpm": 0, "avg_confidence": 0.0, "reading_count": 0}

        half = total_weight / 2.0
        idx = int(np.searchsorted(cum_weights, half))
        idx = min(idx, len(bpms_sorted) - 1)
        weighted_median_bpm = round(bpms_sorted[idx], 1)

        weighted_sum = sum(b * c for b, c in valid_pairs)
        weighted_avg_bpm = round(weighted_sum / total_weight, 1)
        avg_confidence = round(sum(confs_sorted) / len(confs_sorted), 2)

        return {
            "avg_bpm": weighted_avg_bpm,
            "median_bpm": weighted_median_bpm,
            "avg_confidence": avg_confidence,
            "reading_count": len(valid_pairs),
        }

    def process(self, r: float, g: float, b: float) -> dict:
        self.append(r, g, b)
        self._update_effective_fps()
        now = time.time()

        n = len(self.r_buffer)
        if n < self.min_calibrate_samples:
            self.just_computed = True
            self._last_result = {
                "bpm": 0,
                "raw_bpm": 0.0,
                "confidence": 0.0,
                "waveform": [],
                "status": "buffering",
            }
            return self._last_result

        if now - self.last_compute_time < self.compute_interval:
            self.just_computed = False
            return self._last_result

        self.last_compute_time = now
        self.just_computed = True

        r_arr = np.array(self.r_buffer)
        g_arr = np.array(self.g_buffer)
        b_arr = np.array(self.b_buffer)

        g_signal = self._extract_g_signal(g_arr)
        g_filtered = self._bandpass_filter(g_signal)

        chrom = self._compute_chrom(r_arr, g_arr, b_arr)
        chrom_filtered = self._bandpass_filter(chrom)

        g_bpm, g_rating = self._compute_bpm(g_filtered)
        c_bpm, c_rating = self._compute_bpm(chrom_filtered)

        g_valid = 40.0 <= g_bpm <= 220.0
        c_valid = 40.0 <= c_bpm <= 220.0

        if g_valid and c_valid:
            diff = abs(g_bpm - c_bpm)
            avg = (g_bpm + c_bpm) / 2.0
            if diff < avg * 0.15:
                bpm = avg
                bpm_rating = max(g_rating, c_rating) * 1.3
                agreement = 1.0
            elif diff < avg * 0.30:
                bpm = avg
                bpm_rating = max(g_rating, c_rating) * 0.8
                agreement = 0.6
            else:
                bpm = g_bpm
                bpm_rating = g_rating * 0.6
                agreement = 0.2
        elif g_valid:
            bpm = g_bpm
            bpm_rating = g_rating * 0.9
            agreement = 0.3
        elif c_valid:
            bpm = c_bpm
            bpm_rating = c_rating * 0.8
            agreement = 0.25
        else:
            bpm = 0.0
            bpm_rating = 0.0
            agreement = 0.0

        snr = max(self._compute_snr(g_filtered, g_signal), self._compute_snr(chrom_filtered, chrom))
        status = self._get_status(n, snr, bpm, bpm_rating, agreement)

        temporal_consistency = 0.0
        if bpm > 0 and agreement >= 0.3 and bpm_rating > 0.08:
            if len(self.bpm_history) > 0:
                median_bpm = float(np.median(self.bpm_history))
                if median_bpm > 0:
                    deviation = abs(bpm - median_bpm) / median_bpm
                    if deviation < 0.22:
                        weight = 1.0
                    elif deviation < 0.35:
                        weight = 0.6
                    elif deviation < 0.50:
                        weight = 0.3
                    else:
                        weight = 0.0

                    if weight > 0:
                        self.bpm_history.append(bpm)
                        self.confidence_history.append(weight)
            elif g_valid and c_valid:
                self.bpm_history.append(bpm)
                self.confidence_history.append(0.7)
            elif bpm_rating > 0.25:
                self.bpm_history.append(bpm)
                self.confidence_history.append(0.5)

            if len(self.bpm_history) > 3:
                recent = list(self.bpm_history)[-10:]
                temporal_consistency = 1.0 - min(np.std(recent) / 12.0, 1.0)

        confidence = self._get_confidence(n, snr, bpm_rating, agreement, temporal_consistency)

        if len(self.bpm_history) > 0:
            display_bpm = float(np.median(list(self.bpm_history)[-8:]))
        else:
            display_bpm = bpm

        if 40 <= display_bpm <= 220 and confidence > 0.05:
            self._session_bpms.append(display_bpm)
            self._session_confidences.append(confidence)

        if self._ema_bpm == 0:
            self._ema_bpm = display_bpm
        elif display_bpm > 0:
            self._ema_bpm = self._ema_alpha * display_bpm + (1 - self._ema_alpha) * self._ema_bpm

        display_waveform = g_filtered if g_valid else chrom_filtered

        self._last_result = {
            "bpm": round(self._ema_bpm, 1),
            "raw_bpm": round(display_bpm, 1),
            "confidence": confidence,
            "waveform": display_waveform[-450:].tolist() if len(display_waveform) > 450 else display_waveform.tolist(),
            "status": status,
            "effective_fps": round(self._effective_fps, 1),
        }
        return self._last_result
