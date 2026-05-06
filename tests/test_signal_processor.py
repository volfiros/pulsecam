from signal_processor import SignalProcessor
import numpy as np


def _make_frame(r, g, b, motion=0.0, luminance=140.0):
    return {
        "rois": {
            "forehead": {"r": r, "g": g, "b": b},
            "left_cheek": {"r": r + 0.5, "g": g + 0.3, "b": b + 0.2},
            "right_cheek": {"r": r - 0.3, "g": g - 0.2, "b": b - 0.1},
        },
        "motion": motion,
        "luminance": luminance,
    }


def _run_synthetic_session(
    hr_bpm,
    drift_bpm=48.0,
    drift_amp=0.0,
    pulse_amp=2.0,
    fps=30,
    duration=20,
    include_background=False,
):
    sp = SignalProcessor(fps=fps)
    rng = np.random.default_rng(1)
    result = None

    for i in range(fps * duration):
        t = i / fps
        pulse = np.sin(2 * np.pi * (hr_bpm / 60.0) * t)
        drift = drift_amp * np.sin(2 * np.pi * (drift_bpm / 60.0) * t + 0.5)
        r = 140.0 + drift + 0.8 * pulse_amp * pulse + 0.2 * rng.normal()
        g = (
            142.0
            + drift
            + pulse_amp * np.sin(2 * np.pi * (hr_bpm / 60.0) * t + 0.3)
            + 0.2 * rng.normal()
        )
        b = (
            138.0
            + drift
            + 0.4 * pulse_amp * np.sin(2 * np.pi * (hr_bpm / 60.0) * t + 0.6)
            + 0.2 * rng.normal()
        )
        frame = _make_frame(r, g, b, motion=0.1, luminance=(r + g + b) / 3.0)
        if include_background:
            frame["background"] = {
                "r": 100.0 + drift + 0.2 * rng.normal(),
                "g": 102.0 + drift + 0.2 * rng.normal(),
                "b": 98.0 + drift + 0.2 * rng.normal(),
            }
        sp.last_compute_time = -999
        result = sp.process(frame)

    return result


def test_buffering_status_before_enough_samples():
    sp = SignalProcessor(fps=30)
    for i in range(100):
        result = sp.process(_make_frame(140.0, 142.0, 138.0))
    assert result["status"] == "buffering"
    assert result["bpm"] == 0


def test_bpm_detection_72bpm(sine_wave_72bpm):
    sp = SignalProcessor(fps=30)
    result = None
    for r, g, b in sine_wave_72bpm:
        sp.last_compute_time = -999
        res = sp.process(_make_frame(float(r), float(g), float(b)))
        result = res
    assert result is not None
    assert 65 <= result["bpm"] <= 80


def test_bpm_detection_90bpm(sine_wave_90bpm):
    sp = SignalProcessor(fps=30)
    result = None
    for r, g, b in sine_wave_90bpm:
        sp.last_compute_time = -999
        res = sp.process(_make_frame(float(r), float(g), float(b)))
        result = res
    assert result is not None
    assert 83 <= result["bpm"] <= 100


def test_bpm_detection_resists_common_illumination_drift():
    result = _run_synthetic_session(hr_bpm=90.0, drift_amp=4.0)
    assert result is not None
    assert result["status"] == "measuring"
    assert 83 <= result["bpm"] <= 100


def test_bpm_detection_resists_moderate_drift_across_common_heart_rates():
    for hr_bpm in (80.0, 90.0, 100.0):
        result = _run_synthetic_session(hr_bpm=hr_bpm, drift_amp=4.0)
        assert result is not None
        assert result["status"] == "measuring"
        assert hr_bpm - 7 <= result["bpm"] <= hr_bpm + 7


def test_extreme_drift_returns_poor_signal_instead_of_false_low_bpm():
    result = _run_synthetic_session(hr_bpm=90.0, drift_amp=8.0)
    assert result is not None
    assert result["status"] == "poor_signal"
    assert result["bpm"] == 0


def test_background_reference_cancels_extreme_common_drift():
    result = _run_synthetic_session(hr_bpm=90.0, drift_amp=8.0, include_background=True)
    assert result is not None
    assert result["status"] == "measuring"
    assert 83 <= result["bpm"] <= 100


def test_response_includes_methods_dict():
    sp = SignalProcessor(fps=30)
    fps = 30
    t = np.linspace(0, 15, fps * 15)
    freq = 72.0 / 60.0
    for i in range(fps * 15):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        sp.last_compute_time = -999
        result = sp.process(_make_frame(r, g, b))
    assert "methods" in result
    for method_name in ("green", "chrom", "pos", "gr", "grgb"):
        assert method_name in result["methods"]
        assert "bpm" in result["methods"][method_name]
        assert "snr" in result["methods"][method_name]


def test_response_includes_best_method():
    sp = SignalProcessor(fps=30)
    fps = 30
    t = np.linspace(0, 15, fps * 15)
    freq = 72.0 / 60.0
    for i in range(fps * 15):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        sp.last_compute_time = -999
        result = sp.process(_make_frame(r, g, b))
    assert "best_method" in result
    assert result["best_method"] in ("green", "chrom", "pos", "gr", "grgb")


def test_response_includes_diagnostics():
    result = _run_synthetic_session(hr_bpm=90.0, drift_amp=4.0)
    assert result is not None
    assert "diagnostics" in result
    assert result["diagnostics"]["effective_fps"] > 0
    assert result["diagnostics"]["artifact_bpm"] >= 0
    assert result["diagnostics"]["artifact_score"] >= 0
    assert result["diagnostics"]["usable_methods"] >= 0


def test_response_includes_motion():
    sp = SignalProcessor(fps=30)
    sp.last_compute_time = -999
    result = sp.process(_make_frame(140.0, 142.0, 138.0, motion=0.5))
    assert "motion" in result


def test_high_motion_suppresses_reading():
    sp = SignalProcessor(fps=30)
    fps = 30
    t = np.linspace(0, 15, fps * 15)
    freq = 72.0 / 60.0
    for i in range(fps * 15):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        motion = 5.0 if i > fps * 10 else 0.1
        sp.last_compute_time = -999
        result = sp.process(_make_frame(r, g, b, motion=motion))
    assert result["confidence"] < 0.3 or result["status"] == "poor_signal"


def test_waveform_length_capped():
    sp = SignalProcessor(fps=30)
    fps = 30
    t = np.linspace(0, 20, fps * 20)
    freq = 72.0 / 60.0
    for i in range(fps * 20):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        sp.last_compute_time = -999
        sp.process(_make_frame(r, g, b))
    sp.last_compute_time = -999
    last = sp.process(_make_frame(r, g, b))
    assert len(last["waveform"]) <= 450
