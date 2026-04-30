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
