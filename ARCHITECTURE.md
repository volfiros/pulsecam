<div align="center">
  <img src="./assets/architecture.svg" alt="PulseCam Architecture" width="80%" />
</div>

# PulseCam Architecture

This document details the system architecture, data flow, and signal processing pipeline used in PulseCam.

## 🏗️ System Overview

PulseCam operates on a client-server model connected via WebSockets to enable real-time, low-latency video frame analysis without the overhead of HTTP requests.

### 1. Frontend (React / WebGL)
- **Webcam Capture:** Accesses the user's camera via `getUserMedia` and captures frames at a target 30 FPS.
- **Client-side Processing:** The frontend utilizes MediaPipe FaceLandmarker locally to track facial landmarks and extract average RGB values from Regions of Interest (ROIs), significantly reducing the payload sent to the backend.
- **WebSocket Client:** Sends frame payloads containing the average RGB values of the detected cheeks and facial motion metrics.
- **UI & Visualization:** Renders the real-time waveform and calculated BPM using `framer-motion` and WebGL shaders for the background.

### 2. Backend (FastAPI / WebSockets)
- **WebSocket Server:** Receives continuous streams of RGB data from the frontend.
- **Signal Processor (`SignalProcessor`):** Maintains a rolling buffer of RGB values and timestamps. It dynamically calculates the effective FPS to ensure accurate frequency analysis.
- **Extraction Pipeline:** Applies 5 different rPPG extraction algorithms in parallel.
- **Response:** Sends back the calculated BPM, signal confidence, and current status (`buffering`, `measuring`, etc.) to the frontend.

## 🧬 Signal Processing Workflow

The core of PulseCam is the `SignalProcessor`, which isolates the tiny color changes in the skin from background noise and motion artifacts.

### 1. Signal Extraction
For every frame, we extract several signals from the raw RGB values:
- **Green Channel:** The simplest rPPG signal, as hemoglobin absorbs green light effectively.
- **Chrominance (CHROM):** Projects RGB into a chrominance space to eliminate specular reflection (lighting changes).
- **POS (Plane-Orthogonal to Skin):** Another projection method highly robust to motion.
- **GR & GRGB:** Ratio-based signals that normalize against the red and blue channels.

### 2. Filtering
Each extracted signal passes through a **Butterworth Bandpass Filter** (typically 0.7 Hz to 3.5 Hz) to isolate frequencies corresponding to human heart rates (42 to 210 BPM).

### 3. BPM Estimation
We use two primary methods to estimate the heart rate from the filtered signals:
- **Welch's Method (Power Spectral Density):** Identifies the dominant frequency in the signal's frequency domain. Good for steady signals.
- **Autocorrelation:** Measures how well the signal matches a delayed version of itself. Excellent for finding the periodicity in the time domain, even if the signal shape isn't a perfect sine wave.

### 4. Method Selection & Agreement
- The system evaluates the **Signal-to-Noise Ratio (SNR)** of all 5 extracted signals.
- It checks if the Welch and Autocorrelation methods **agree** on the heart rate for a given signal.
- The signal with the highest SNR and highest method agreement is selected as the `best_method`.

### 5. Final Calculation
- A confidence score is generated based on SNR, method agreement, and a motion penalty (derived from face tracking stability).
- The final displayed BPM is an **Exponential Moving Average (EMA)** of the best recent measurements to provide a stable, readable output.
- To determine the resting/stabilized heart rate at the end of a session, the frontend calculates a weighted average of the last 15 seconds of measurements.

## 🚢 Deployment Architecture
The entire application is containerized using Docker. 
- **Stage 1:** Bun builds the Vite React frontend into static files.
- **Stage 2:** Python slim image installs FastAPI, Uvicorn, SciPy, and NumPy.
- **Execution:** FastAPI mounts the static files from the frontend build and serves them on the root (`/`), while simultaneously listening on `/ws` for WebSocket connections.
- Hosted effortlessly on **Hugging Face Spaces** as a single Docker Space.