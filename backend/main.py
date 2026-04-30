import logging
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from signal_processor import SignalProcessor

app = FastAPI()


class ROIData(BaseModel):
    r: float
    g: float
    b: float


class FrameData(BaseModel):
    rois: dict[str, ROIData]
    motion: float = 0.0
    luminance: float = 0.0


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    processor = SignalProcessor()
    try:
        while True:
            try:
                data = await websocket.receive_json()
                frame = FrameData(**data)
                rois_dict = {name: {"r": roi.r, "g": roi.g, "b": roi.b} for name, roi in frame.rois.items()}
                result = processor.process({
                    "rois": rois_dict,
                    "motion": frame.motion,
                    "luminance": frame.luminance,
                })
                if processor.just_computed:
                    await websocket.send_json(result)
            except WebSocketDisconnect:
                break
            except Exception as e:
                logging.getLogger("uvicorn").exception("WebSocket processing error")
                await websocket.send_json({"error": str(e), "status": "error"})
    finally:
        del processor


if os.path.isdir("static"):
    app.mount("/assets", StaticFiles(directory="static/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse("static/index.html")
