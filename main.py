
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import base64
import os

from typing import Optional
from urllib.request import urlretrieve

import cv2
import mediapipe as mp
import numpy as np
import joblib
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


app = FastAPI(title="SignSync-Web")



app.mount("/static", StaticFiles(directory="static"), name="static")
TEMPLATES_DIR = Path("templates")


MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/latest/hand_landmarker.task"
)
MODELS_DIR = Path("models")
MODEL_PATH = MODELS_DIR / "hand_landmarker.task"
ASL_MODEL_PATH = MODELS_DIR / "asl_model.joblib"



def _landmark_features(lms) -> np.ndarray:
    pts = np.array([[lm.x, lm.y, lm.z] for lm in lms], dtype=np.float32)
    pts = pts - pts[0:1, :]
    scale = np.linalg.norm(pts, axis=1).max()
    if float(scale) > 1e-6:
        pts = pts / scale
    return pts.reshape(-1)  # 63


def ensure_model():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        return
    urlretrieve(MODEL_URL, MODEL_PATH)
ensure_model()


def _is_finger_extended(hand_landmarks, tip: int, pip: int) -> bool:
    # y increases downward in image coordinates
    tip_y = hand_landmarks.landmark[tip].y
    pip_y = hand_landmarks.landmark[pip].y
    return tip_y < pip_y
    


def classify_simple(hand_landmarks) -> Optional[str]:
    """
    Starter real-time classifier (rule-based).
    Replace later with a trained model for full sign vocabulary.
    """
    idx_ext = _is_finger_extended(hand_landmarks, 8, 6)
    mid_ext = _is_finger_extended(hand_landmarks, 12, 10)
    ring_ext = _is_finger_extended(hand_landmarks, 16, 14)
    pinky_ext = _is_finger_extended(hand_landmarks, 20, 18)
    num_extended = sum([idx_ext, mid_ext, ring_ext, pinky_ext])

    thumb_tip_y = hand_landmarks.landmark[4].y
    wrist_y = hand_landmarks.landmark[0].y

    if num_extended == 4:
        return "HELLO"

    if num_extended == 0:
        if thumb_tip_y < wrist_y - 0.02:
            return "YES"
        if thumb_tip_y > wrist_y + 0.02:
            return "NO"
        return "STOP"

    return None


@app.get("/")
def home(request: Request):
    # Serve plain HTML (no Jinja) to avoid template engine issues.
    return FileResponse(TEMPLATES_DIR / "index.html")


@app.websocket("/ws/gesture")
async def ws_gesture(websocket: WebSocket):
    await websocket.accept()

    
    asl_model = None
    if ASL_MODEL_PATH.exists():
        try:
            asl_model = joblib.load(ASL_MODEL_PATH)
        except Exception:
            asl_model = None

    # MediaPipe Tasks API (newer mediapipe builds expose mp.tasks, not mp.solutions)
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    base_options = python.BaseOptions(model_asset_path=str(MODEL_PATH))
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_hands=1,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    landmarker = vision.HandLandmarker.create_from_options(options)

    while True:
     try:
        msg = await websocket.receive_text()

        if "," in msg:
            _, b64 = msg.split(",", 1)
        else:
            b64 = msg

        jpg = base64.b64decode(b64)
        arr = np.frombuffer(jpg, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if frame is None:
            await websocket.send_json({"ok": False})
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = landmarker.detect(mp_image)

        label = None
        if res.hand_landmarks:
            lms = res.hand_landmarks[0]

            if asl_model is not None:
                x = _landmark_features(lms).reshape(1, -1)
                label = str(asl_model.predict(x)[0])
            else:
                class _LMWrap:
                    def __init__(self, lms_):
                        self.landmark = lms_

                label = classify_simple(_LMWrap(lms))

        await websocket.send_json({"ok": True, "label": label})

    except Exception as e:
        await websocket.send_json({"ok": False, "error": str(e)})


@app.get("/health")
def health():
    return {"ok": True}

