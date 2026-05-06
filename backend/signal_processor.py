import numpy as np
from scipy.signal import butter, sosfiltfilt, welch, find_peaks
from collections import deque
import time
from typing import Optional


def _detrend_ma(signal: np.ndarray, window: int) -> np.ndarray:
    if len(signal) <= window:
        return signal - np.mean(signal)
    kernel = np.ones(window)
    counts = np.convolve(np.ones_like(signal), kernel, mode="same")
    trend = np.convolve(signal, kernel, mode="same") / counts
    return signal - trend


def extract_green_signal(g_arr: np.ndarray, detrend_window: int = 60) -> np.ndarray:
    g_mean = np.mean(g_arr)
    if g_mean < 1e-10:
        return np.zeros_like(g_arr)
    raw = g_arr / g_mean - 1.0
    return _detrend_ma(raw, detrend_window)


def extract_chrom_signal(r_arr: np.ndarray, g_arr: np.ndarray, b_arr: np.ndarray, detrend_window: int = 60) -> np.ndarray:
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
    return _detrend_ma(chrom, detrend_window)


def extract_pos_signal(r_arr: np.ndarray, g_arr: np.ndarray, b_arr: np.ndarray, detrend_window: int = 60) -> np.ndarray:
    r_mean = np.mean(r_arr)
    g_mean = np.mean(g_arr)
    b_mean = np.mean(b_arr)
    if r_mean < 1e-10 or g_mean < 1e-10 or b_mean < 1e-10:
        return np.zeros_like(r_arr)
    r_norm = r_arr / r_mean - 1.0
    g_norm = g_arr / g_mean - 1.0
    b_norm = b_arr / b_mean - 1.0
    c1 = g_norm - b_norm
    c2 = -2.0 * r_norm + g_norm + b_norm
    std_c1 = np.std(c1)
    alpha = std_c1 / np.std(c2) if np.std(c2) > 1e-10 else 1.0
    h = c1 - alpha * c2
    return _detrend_ma(h, detrend_window)


def extract_gr_signal(r_arr: np.ndarray, g_arr: np.ndarray, detrend_window: int = 60) -> np.ndarray:
    r_mean = np.mean(r_arr)
    if r_mean < 1e-10:
        return np.zeros_like(r_arr)
    r_safe = np.maximum(r_arr, 1e-6)
    gr = g_arr / r_safe
    gr_norm = gr / np.mean(gr) - 1.0
    return _detrend_ma(gr_norm, detrend_window)


def extract_grgb_signal(r_arr: np.ndarray, g_arr: np.ndarray, b_arr: np.ndarray, detrend_window: int = 60) -> np.ndarray:
    r_mean = np.mean(r_arr)
    b_mean = np.mean(b_arr)
    if r_mean < 1e-10 or b_mean < 1e-10:
        return np.zeros_like(r_arr)
    r_safe = np.maximum(r_arr, 1e-6)
    b_safe = np.maximum(b_arr, 1e-6)
    gr = g_arr / r_safe
    gb = g_arr / b_safe
    grgb = gr + gb
    grgb_norm = grgb / np.mean(grgb) - 1.0
    return _detrend_ma(grgb_norm, detrend_window)


class SignalProcessor:
    def __init__(self, fps: int = 30, buffer_seconds: float = 20.0):
        self._nominal_fps = fps
        self._effective_fps = float(fps)
        self.capacity = int(fps * buffer_seconds)
        self.r_buffer: deque[float] = deque(maxlen=self.capacity)
        self.g_buffer: deque[float] = deque(maxlen=self.capacity)
        self.b_buffer: deque[float] = deque(maxlen=self.capacity)
        self.bg_r_buffer: deque[float] = deque(maxlen=self.capacity)
        self.bg_g_buffer: deque[float] = deque(maxlen=self.capacity)
        self.bg_b_buffer: deque[float] = deque(maxlen=self.capacity)
        self._sample_times: deque[float] = deque(maxlen=self.capacity)
        self._motion_buffer: deque[float] = deque(maxlen=self.capacity)
        self._luminance_buffer: deque[float] = deque(maxlen=self.capacity)
        self.last_compute_time = 0.0
        self.compute_interval = 1.0
        self.low_hz = 0.65
        self.high_hz = 4.0
        self.filter_order = 6
        self.min_early_samples: int = fps * 15
        self.min_full_samples: int = fps * 15
        self.motion_threshold: float = 2.0
        self.snr_threshold: float = 0.0
        self.agreement_threshold: float = 12.0
        self.bpm_history: deque[float] = deque(maxlen=30)
        self._ema_bpm: float = 0.0
        self._ema_alpha: float = 0.2
        self._prev_status: str = "buffering"
        self._last_result: dict = {
            "bpm": 0,
            "raw_bpm": 0.0,
            "confidence": 0.0,
            "waveform": [],
            "status": "buffering",
            "methods": {},
            "best_method": "",
            "agreement": 0.0,
            "motion": 0.0,
            "diagnostics": {
                "effective_fps": round(self._effective_fps, 2),
                "artifact_bpm": 0.0,
                "artifact_score": 0.0,
                "usable_methods": 0,
            },
        }
        self.just_computed: bool = False
        self._detrend_window = fps * 2

    def _average_rois(self, rois: dict) -> tuple[float, float, float]:
        r_vals, g_vals, b_vals = [], [], []
        for roi_data in rois.values():
            r_vals.append(roi_data["r"])
            g_vals.append(roi_data["g"])
            b_vals.append(roi_data["b"])
        return np.mean(r_vals), np.mean(g_vals), np.mean(b_vals)

    def append(
        self,
        r: float,
        g: float,
        b: float,
        motion: float = 0.0,
        luminance: float = 0.0,
        background: Optional[dict] = None,
    ) -> None:
        self.r_buffer.append(r)
        self.g_buffer.append(g)
        self.b_buffer.append(b)
        if background:
            self.bg_r_buffer.append(float(background["r"]))
            self.bg_g_buffer.append(float(background["g"]))
            self.bg_b_buffer.append(float(background["b"]))
        else:
            self.bg_r_buffer.append(np.nan)
            self.bg_g_buffer.append(np.nan)
            self.bg_b_buffer.append(np.nan)
        self._sample_times.append(time.time())
        self._motion_buffer.append(motion)
        self._luminance_buffer.append(luminance)

    def _diagnostics(self, artifact_bpm: float = 0.0, artifact_score: float = 0.0, usable_methods: int = 0) -> dict:
        return {
            "effective_fps": round(float(self._effective_fps), 2),
            "artifact_bpm": round(float(artifact_bpm), 1),
            "artifact_score": round(float(artifact_score), 2),
            "usable_methods": int(usable_methods),
        }

    def _apply_background_reference(
        self,
        r_arr: np.ndarray,
        g_arr: np.ndarray,
        b_arr: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        if len(self.bg_r_buffer) != len(r_arr) or len(r_arr) < self.min_full_samples:
            return r_arr, g_arr, b_arr

        bg_r = np.array(self.bg_r_buffer)
        bg_g = np.array(self.bg_g_buffer)
        bg_b = np.array(self.bg_b_buffer)
        valid = np.isfinite(bg_r) & np.isfinite(bg_g) & np.isfinite(bg_b)
        if np.count_nonzero(valid) < max(self.min_full_samples, int(len(r_arr) * 0.8)):
            return r_arr, g_arr, b_arr

        bg_luminance = (bg_r + bg_g + bg_b) / 3.0
        reference = bg_luminance[valid]
        ref_mean = np.mean(reference)
        if ref_mean < 1e-10:
            return r_arr, g_arr, b_arr

        ref_norm = reference / ref_mean - 1.0
        denom = float(np.dot(ref_norm, ref_norm))
        if denom < 1e-10:
            return r_arr, g_arr, b_arr

        corrected = []
        for arr in (r_arr, g_arr, b_arr):
            arr_mean = np.mean(arr[valid])
            if arr_mean < 1e-10:
                corrected.append(arr)
                continue
            arr_norm = arr[valid] / arr_mean - 1.0
            beta = float(np.dot(arr_norm, ref_norm) / denom)
            beta = max(0.0, min(1.5, beta))
            corr_norm = arr_norm - beta * ref_norm
            corr_arr = np.array(arr, copy=True)
            corr_arr[valid] = arr_mean * (1.0 + corr_norm)
            corrected.append(corr_arr)

        return corrected[0], corrected[1], corrected[2]

    def _update_effective_fps(self) -> None:
        if len(self._sample_times) < 20:
            return
        recent = list(self._sample_times)[-120:]
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

    def _compute_snr(self, filtered: np.ndarray, original: np.ndarray) -> float:
        residual = original - filtered
        signal_var = np.var(filtered)
        residual_var = np.var(residual)
        if signal_var < 1e-10:
            return 0.0
        if residual_var < 1e-10:
            return 80.0
        return 10.0 * np.log10(signal_var / residual_var)

    def _welch_bpm(self, signal: np.ndarray) -> tuple[float, float]:
        n = len(signal)
        fps = self._effective_fps
        samples_per_seg = max(int(fps * 4), 64)
        noverlap = samples_per_seg // 2
        if n < samples_per_seg:
            return 0.0, 0.0
        nfft = max(samples_per_seg * 8, 1024)
        freqs, psd = welch(signal, fs=fps, nperseg=samples_per_seg, noverlap=noverlap, nfft=nfft)
        hps_len = len(psd) // 2
        if hps_len < 2:
            return 0.0, 0.0
        hps = psd[:hps_len] * psd[::2][:hps_len]
        hps_freqs = freqs[:hps_len]
        valid = (hps_freqs >= 42.0 / 60.0) & (hps_freqs <= 180.0 / 60.0)
        if not np.any(valid):
            return 0.0, 0.0
        vf = hps_freqs[valid]
        vp = hps[valid]
        peak_idx = int(np.argmax(vp))
        peak_power = vp[peak_idx]
        total_power = np.sum(vp)
        prominence = peak_power / total_power if total_power > 1e-10 else 0.0
        if 0 < peak_idx < len(vp) - 1:
            a = vp[peak_idx - 1]
            b = vp[peak_idx]
            c = vp[peak_idx + 1]
            denom = a - 2.0 * b + c
            delta = 0.5 * (a - c) / denom if abs(denom) > 1e-10 else 0.0
            delta = max(-0.5, min(0.5, delta))
        else:
            delta = 0.0
        bin_width = vf[1] - vf[0] if len(vf) > 1 else 0.0
        peak_freq = vf[peak_idx] + delta * bin_width
        return float(peak_freq * 60.0), prominence

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
        if autocorr[0] <= 1e-10:
            return 0.0, 0.0
        autocorr = autocorr / autocorr[0]
        max_lag = min(max(int(fps / (42.0 / 60.0)), 50), n - 1)
        min_lag = min(int(fps / (180.0 / 60.0)), max(3, max_lag // 2))
        if len(autocorr) <= max_lag:
            return 0.0, 0.0
        region = autocorr[min_lag:max_lag]
        if len(region) < 3:
            return 0.0, 0.0
        peaks, props = find_peaks(region, height=0.06)
        if len(peaks) == 0:
            return 0.0, 0.0
        best = int(np.argmax(props["peak_heights"]))
        peak_idx = int(peaks[best])
        peak_val = float(region[peak_idx])
        if peak_idx <= 0 or peak_idx >= len(region) - 1:
            return 0.0, 0.0
        a = region[peak_idx - 1]
        b_val = region[peak_idx]
        c = region[peak_idx + 1]
        denom = a - 2.0 * b_val + c
        delta = 0.5 * (a - c) / denom if abs(denom) > 1e-10 else 0.0
        delta = max(-0.5, min(0.5, delta))
        lag = float(peak_idx + min_lag) + delta
        bpm = float(60.0 * fps / lag)
        quality = min(peak_val / 0.4, 1.0)
        return bpm, quality

    def _compute_bpm(self, signal: np.ndarray) -> tuple[float, float]:
        n = len(signal)
        if n < self._effective_fps * 2:
            return 0.0, 0.0
        welch_bpm, welch_prom = self._welch_bpm(signal)
        ac_bpm, ac_quality = self._autocorrelation_bpm(signal)
        welch_valid = 42.0 <= welch_bpm <= 180.0 and welch_prom > 0.08
        ac_valid = 42.0 <= ac_bpm <= 180.0
        if not welch_valid and not ac_valid:
            return 0.0, 0.0
        if welch_valid and not ac_valid:
            return welch_bpm, welch_prom
        if ac_valid and not welch_valid:
            return ac_bpm, ac_quality * 0.6
        ratio = max(ac_bpm, welch_bpm) / min(ac_bpm, welch_bpm) if min(ac_bpm, welch_bpm) > 1e-10 else 999
        if ratio < 1.15:
            return (ac_bpm + welch_bpm) / 2.0, max(ac_quality, welch_prom) * 1.3
        elif ratio < 1.3:
            return (ac_bpm + welch_bpm) / 2.0, max(ac_quality, welch_prom)
        else:
            return welch_bpm if welch_prom >= ac_quality else ac_bpm, max(ac_quality, welch_prom) * 0.5

    def _get_recent_motion(self) -> float:
        if len(self._motion_buffer) < 10:
            return 0.0
        return float(np.mean(list(self._motion_buffer)[-30:]))

    def _get_recent_luminance_var(self) -> float:
        if len(self._luminance_buffer) < 10:
            return 0.0
        return float(np.var(list(self._luminance_buffer)[-60:]))

    def _compute_luminance_artifact(self) -> tuple[float, float]:
        if len(self._luminance_buffer) < self.min_full_samples:
            return 0.0, 0.0
        luminance = np.array(self._luminance_buffer)
        lum_signal = extract_green_signal(luminance, self._detrend_window)
        lum_filtered = self._bandpass_filter(lum_signal)
        lum_bpm, lum_rating = self._compute_bpm(lum_filtered)
        lum_snr = self._compute_snr(lum_filtered, lum_signal)
        return lum_bpm, min(max(lum_rating, 0.0) * max(lum_snr, 0.0) / 3.0, 1.0)

    def _remove_luminance_artifacts(
        self,
        method_bpms: dict[str, float],
        artifact_bpm: float,
        artifact_score: float,
    ) -> tuple[dict[str, float], int]:
        is_low_luminance_artifact = (
            42.0 <= artifact_bpm <= 65.0
            and artifact_score >= 0.35
            and self._get_recent_luminance_var() >= 2.0
        )
        if not is_low_luminance_artifact:
            return method_bpms, 0

        artifact_window = 8.0
        clean_bpms = {
            name: bpm
            for name, bpm in method_bpms.items()
            if abs(bpm - artifact_bpm) > artifact_window
        }
        artifact_matches = len(method_bpms) - len(clean_bpms)
        clean_agreement, clean_count, _ = self._compute_agreement(clean_bpms)

        if clean_count >= 2 and clean_agreement > 0.2:
            return clean_bpms, artifact_matches
        if artifact_matches >= 2:
            return clean_bpms, artifact_matches
        return method_bpms, artifact_matches

    def _compute_agreement(self, method_bpms: dict[str, float]) -> tuple[float, int, list[float]]:
        valid_bpms = sorted([v for v in method_bpms.values() if 42.0 <= v <= 180.0])
        if len(valid_bpms) < 2:
            return 0.0, len(valid_bpms), valid_bpms

        best_agreement = 0.0
        best_cluster: list[float] = []

        for i in range(len(valid_bpms)):
            for j in range(i + 1, len(valid_bpms)):
                cluster = valid_bpms[i:j+1]
                spread = cluster[-1] - cluster[0]
                n_cluster = len(cluster)

                agr = max(0.0, 1.0 - spread / self.agreement_threshold)
                agr *= min(n_cluster / 3.0, 1.0)

                if agr > best_agreement:
                    best_agreement = agr
                    best_cluster = cluster

        return best_agreement, len(best_cluster), best_cluster

    def _get_status(self, n_samples: int, bpm: float, confidence: float) -> str:
        if n_samples < self.min_early_samples:
            return "buffering"
        if bpm <= 0 or bpm > 180:
            return "poor_signal"
        if confidence < 0.15:
            return "poor_signal"
        return "measuring"

    def process(self, frame_data: dict) -> dict:
        rois = frame_data.get("rois", {})
        motion = frame_data.get("motion", 0.0)
        luminance = frame_data.get("luminance", 0.0)
        background = frame_data.get("background")

        if not rois:
            self.just_computed = False
            return self._last_result

        r, g, b = self._average_rois(rois)
        self.append(r, g, b, motion, luminance, background)
        self._update_effective_fps()

        n = len(self.r_buffer)
        if n < self.min_early_samples:
            self.just_computed = True
            self._last_result = {
                "bpm": 0, "raw_bpm": 0.0, "confidence": 0.0,
                "waveform": [], "status": "buffering",
                "methods": {}, "best_method": "", "agreement": 0.0, "motion": motion,
                "diagnostics": self._diagnostics(),
            }
            return self._last_result

        now = time.time()
        if now - self.last_compute_time < self.compute_interval:
            self.just_computed = False
            return self._last_result

        self.last_compute_time = now
        self.just_computed = True

        r_arr = np.array(self.r_buffer)
        g_arr = np.array(self.g_buffer)
        b_arr = np.array(self.b_buffer)
        r_arr, g_arr, b_arr = self._apply_background_reference(r_arr, g_arr, b_arr)

        signals = {
            "green": extract_green_signal(g_arr, self._detrend_window),
            "chrom": extract_chrom_signal(r_arr, g_arr, b_arr, self._detrend_window),
            "pos": extract_pos_signal(r_arr, g_arr, b_arr, self._detrend_window),
            "gr": extract_gr_signal(r_arr, g_arr, self._detrend_window),
            "grgb": extract_grgb_signal(r_arr, g_arr, b_arr, self._detrend_window),
        }

        filtered = {}
        method_results = {}
        method_bpms = {}

        for name, sig in signals.items():
            filt = self._bandpass_filter(sig)
            filtered[name] = filt
            bpm, rating = self._compute_bpm(filt)
            snr = self._compute_snr(filt, sig)
            method_results[name] = {"bpm": round(bpm, 1), "snr": round(snr, 2), "rating": rating}
            if 42.0 <= bpm <= 180.0:
                method_bpms[name] = bpm

        artifact_bpm, artifact_score = self._compute_luminance_artifact()
        method_bpms, artifact_matches = self._remove_luminance_artifacts(method_bpms, artifact_bpm, artifact_score)

        best_method = ""
        best_snr = -float("inf")
        for name, mr in method_results.items():
            if name in method_bpms and mr["snr"] > best_snr:
                best_snr = mr["snr"]
                best_method = name

        agreement, n_agreeing, agreement_cluster = self._compute_agreement(method_bpms)

        recent_motion = self._get_recent_motion()
        motion_penalty = max(0.0, 1.0 - recent_motion / self.motion_threshold) if recent_motion > 0.5 else 1.0

        if best_method and best_method in method_bpms and best_snr >= self.snr_threshold and n_agreeing >= 2 and agreement > 0.2:
            raw_bpm = method_bpms[best_method]
            if n_agreeing >= 3 and agreement > 0.5 and agreement_cluster:
                lo, hi = min(agreement_cluster), max(agreement_cluster)
                ws, bs = [], []
                for name, b in method_bpms.items():
                    if lo <= b <= hi:
                        snr = method_results[name]["snr"]
                        ws.append(np.exp(min(snr, 10.0)))
                        bs.append(b)
                if ws:
                    raw_bpm = float(np.sum(np.array(ws) * np.array(bs)) / np.sum(ws))
            bpm_rating = method_results[best_method]["rating"]
            snr_score = min(max(best_snr, 0.0) / 3.0, 1.0)
            confidence = min(snr_score * agreement * motion_penalty * min(bpm_rating * 3.5, 1.0), 1.0)
            if artifact_matches >= 2 and n_agreeing <= 1:
                confidence *= 0.25
            bpm = raw_bpm
        else:
            bpm = 0.0
            raw_bpm = 0.0
            confidence = 0.0

        status = self._get_status(n, bpm, confidence)

        if status == "measuring" and self._prev_status != "measuring":
            self.bpm_history.clear()
        self._prev_status = status

        if bpm > 0 and confidence > 0.15:
            self.bpm_history.append(bpm)

        if len(self.bpm_history) > 3:
            display_bpm = float(np.median(list(self.bpm_history)[-8:]))
        else:
            display_bpm = bpm

        if self._ema_bpm == 0:
            self._ema_bpm = display_bpm
        elif display_bpm > 0:
            self._ema_bpm = self._ema_alpha * display_bpm + (1 - self._ema_alpha) * self._ema_bpm

        waveform_signal = filtered.get(best_method, filtered.get("chrom", filtered.get("green", np.array([]))))
        display_waveform = waveform_signal[-450:].tolist() if len(waveform_signal) > 450 else waveform_signal.tolist()

        methods_response = {name: {"bpm": mr["bpm"], "snr": mr["snr"]} for name, mr in method_results.items()}

        self._last_result = {
            "bpm": round(self._ema_bpm, 1),
            "raw_bpm": round(display_bpm, 1),
            "confidence": round(confidence, 2),
            "waveform": display_waveform,
            "status": status,
            "methods": methods_response,
            "best_method": best_method,
            "agreement": round(agreement, 2),
            "motion": round(recent_motion, 2),
            "diagnostics": self._diagnostics(artifact_bpm, artifact_score, len(method_bpms)),
        }
        return self._last_result
