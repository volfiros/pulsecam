import sys
import os
import time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from signal_processor import SignalProcessor


def test_buffering_status_before_enough_samples():
    sp = SignalProcessor(fps=30)
    for i in range(100):
        result = sp.process(140.0, 142.0, 138.0)
    assert result["status"] == "buffering"
    assert result["bpm"] == 0


def test_calibrating_status_at_5_seconds():
    sp = SignalProcessor(fps=30)
    for i in range(150):
        result = sp.process(140.0 + (i % 10) * 0.1, 142.0 + (i % 8) * 0.1, 138.0)
    assert result is not None
    assert result["status"] in ("calibrating", "measuring", "poor_signal")


def test_bpm_detection_72bpm(sine_wave_72bpm):
    sp = SignalProcessor(fps=30)
    sp.compute_interval = 0.0
    result = None
    for r, g, b in sine_wave_72bpm:
        res = sp.process(float(r), float(g), float(b))
        if res is not None:
            result = res
    assert result is not None
    assert result["status"] in ("measuring", "poor_signal")
    assert 65 <= result["bpm"] <= 80


def test_bpm_detection_90bpm(sine_wave_90bpm):
    sp = SignalProcessor(fps=30)
    sp.compute_interval = 0.0
    result = None
    for r, g, b in sine_wave_90bpm:
        res = sp.process(float(r), float(g), float(b))
        if res is not None:
            result = res
    assert result is not None
    assert result["status"] in ("measuring", "poor_signal")
    assert 83 <= result["bpm"] <= 100


def test_confidence_increases_with_buffer():
    sp = SignalProcessor(fps=30)
    sp.compute_interval = 0.0
    fps = 30
    duration = 20
    import numpy as np
    t = np.linspace(0, duration, fps * duration)
    freq = 72.0 / 60.0
    confidences = []
    for i in range(fps * duration):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        res = sp.process(r, g, b)
        if res is not None and res["confidence"] > 0:
            confidences.append(res["confidence"])
    assert len(confidences) >= 2
    assert confidences[-1] >= confidences[0]


def test_waveform_length_capped():
    sp = SignalProcessor(fps=30)
    sp.compute_interval = 0.0
    import numpy as np
    fps = 30
    duration = 20
    t = np.linspace(0, duration, fps * duration)
    freq = 72.0 / 60.0
    for i in range(fps * duration):
        r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t[i])
        g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t[i] + 0.3)
        b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t[i] + 0.6)
        sp.process(r, g, b)
    time.sleep(0.05)
    last = sp.process(r, g, b)
    assert last is not None
    assert len(last["waveform"]) <= 450


def test_compute_throttled_to_1hz():
    sp = SignalProcessor(fps=30)
    sp.min_calibrate_samples = 5
    for i in range(10):
        sp.process(140.0, 142.0, 138.0)
    results = []
    for i in range(60):
        res = sp.process(140.0, 142.0, 138.0)
        if res is not None:
            results.append(res)
    assert len(results) <= 3
