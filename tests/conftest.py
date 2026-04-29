import numpy as np
import pytest


@pytest.fixture
def sine_wave_72bpm():
    fps = 30
    duration = 20
    t = np.linspace(0, duration, fps * duration)
    freq = 72.0 / 60.0
    noise = np.random.normal(0, 0.5, len(t))
    r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t) + noise
    g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t + 0.3) + noise * 0.8
    b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t + 0.6) + noise * 1.2
    return list(zip(r, g, b))


@pytest.fixture
def sine_wave_90bpm():
    fps = 30
    duration = 20
    t = np.linspace(0, duration, fps * duration)
    freq = 90.0 / 60.0
    noise = np.random.normal(0, 0.5, len(t))
    r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t) + noise
    g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t + 0.3) + noise * 0.8
    b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t + 0.6) + noise * 1.2
    return list(zip(r, g, b))
