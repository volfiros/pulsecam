import sys
import os
import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from signal_processor import (
    extract_green_signal,
    extract_chrom_signal,
    extract_pos_signal,
    extract_gr_signal,
    extract_grgb_signal,
)


@pytest.fixture
def clean_72bpm_rgb():
    fps = 30
    duration = 15
    t = np.linspace(0, duration, fps * duration)
    freq = 72.0 / 60.0
    noise = np.random.normal(0, 0.3, len(t))
    r = 140.0 + 2.0 * np.sin(2 * np.pi * freq * t) + noise
    g = 142.0 + 4.0 * np.sin(2 * np.pi * freq * t + 0.3) + noise * 0.8
    b = 138.0 + 1.0 * np.sin(2 * np.pi * freq * t + 0.6) + noise * 1.2
    return r, g, b


def test_extract_green_signal_returns_array_of_same_length(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_green_signal(g)
    assert isinstance(result, np.ndarray)
    assert len(result) == len(g)


def test_extract_green_signal_nonzero_with_varying_input(clean_72bpm_rgb):
    _, g, _ = clean_72bpm_rgb
    result = extract_green_signal(g)
    assert np.std(result) > 0


def test_extract_chrom_signal_returns_array(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_chrom_signal(r, g, b)
    assert isinstance(result, np.ndarray)
    assert len(result) == len(r)


def test_extract_chrom_signal_nonzero_with_varying_input(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_chrom_signal(r, g, b)
    assert np.std(result) > 0


def test_extract_pos_signal_returns_array(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_pos_signal(r, g, b)
    assert isinstance(result, np.ndarray)
    assert len(result) == len(r)


def test_extract_pos_signal_nonzero_with_varying_input(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_pos_signal(r, g, b)
    assert np.std(result) > 0


def test_extract_gr_signal_returns_array(clean_72bpm_rgb):
    r, g, _ = clean_72bpm_rgb
    result = extract_gr_signal(r, g)
    assert isinstance(result, np.ndarray)
    assert len(result) == len(r)


def test_extract_gr_signal_nonzero_with_varying_input(clean_72bpm_rgb):
    r, g, _ = clean_72bpm_rgb
    result = extract_gr_signal(r, g)
    assert np.std(result) > 0


def test_extract_grgb_signal_returns_array(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_grgb_signal(r, g, b)
    assert isinstance(result, np.ndarray)
    assert len(result) == len(r)


def test_extract_grgb_signal_nonzero_with_varying_input(clean_72bpm_rgb):
    r, g, b = clean_72bpm_rgb
    result = extract_grgb_signal(r, g, b)
    assert np.std(result) > 0


def test_all_methods_zero_on_constant_input():
    n = 300
    r = np.full(n, 140.0)
    g = np.full(n, 142.0)
    b = np.full(n, 138.0)
    assert np.std(extract_green_signal(g)) < 1e-6
    assert np.std(extract_chrom_signal(r, g, b)) < 1e-6
    assert np.std(extract_pos_signal(r, g, b)) < 1e-6
    assert np.std(extract_gr_signal(r, g)) < 1e-6
    assert np.std(extract_grgb_signal(r, g, b)) < 1e-6
