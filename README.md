---
title: Pulsecam
emoji: 💓
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
license: mit
---

<div align="center">
  <img src="./assets/banner.svg" alt="PulseCam Banner" width="100%" />

  # PulseCam 💓
  
  **Your Pulse, From Your Camera**

  [![Hugging Face Space](https://img.shields.io/badge/🤗%20Hugging%20Face-Space-yellow.svg)](https://huggingface.co/spaces/agaroth/pulsecam)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
</div>

## 🎯 The Problem
Measuring heart rate traditionally requires dedicated hardware like smartwatches, chest straps, or pulse oximeters. This limits accessibility for quick, everyday health monitoring, especially for telehealth integrations or fitness apps where users might not have specialized devices on hand.

## ✨ What PulseCam Does
PulseCam turns your standard webcam into a contactless heart rate monitor. Using remote photoplethysmography (rPPG), it detects micro-variations in skin color caused by blood flow with each heartbeat. 

Simply sit in front of your camera, and PulseCam tracks your face, isolates the optimal regions of interest (cheeks), and processes the subtle color changes in real-time to calculate your heart rate (BPM).

## 🛠️ Tech Stack & Core Libraries
- **Frontend:** React, TypeScript, Vite, Framer Motion, WebGL (for stunning shader backgrounds)
- **Backend:** Python, FastAPI, WebSockets
- **Core Models & Algorithms:**
  - **MediaPipe FaceLandmarker:** Real-time facial landmark detection to isolate stable regions of interest (ROI).
  - **SciPy & NumPy:** Advanced signal processing, bandpass filtering, Welch's method, and autocorrelation to extract the heart rate signal from noisy RGB data.

## 🚀 Live Demo
Try it out directly in your browser without installing anything!
👉 **[PulseCam on Hugging Face](https://agaroth-pulsecam.hf.space)** (or [view the Space](https://huggingface.co/spaces/agaroth/pulsecam))

## ⚙️ Installation & Local Setup

### Prerequisites
- Node.js (via Bun or npm)
- Python 3.11+

### Steps
1. **Clone the repository:**
   ```bash
   git clone git@github.com:volfiros/pulsecam.git
   cd pulsecam
   ```

2. **Start the Backend:**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. **Start the Frontend:**
   ```bash
   cd frontend
   bun install
   bun run dev
   ```

4. Open `http://localhost:5173` in your browser.

## 📈 Future Improvements
- **Lighting Compensation:** Improve robustness against uneven or flickering lighting conditions.
- **Motion Artifact Reduction:** Implement better independent component analysis (ICA) to separate motion from the pulse signal.
- **Mobile Optimization:** Enhance camera access and processing efficiency on mobile devices.
- **HRV (Heart Rate Variability):** Extract inter-beat intervals to measure stress levels.

See the [Architecture Document](ARCHITECTURE.md) for a deep dive into how the signal processing pipeline works.