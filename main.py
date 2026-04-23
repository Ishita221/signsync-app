
0from pathlib import Path
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
    return pts.reshape(-1)


def ensure_model():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        return
    urlretrieve(MODEL_URL, MODEL_PATH)

ensure_model()


def _is_finger_extended(hand_landmarks, tip: int, pip: int) -> bool:
    tip_y = hand_landmarks.landmark[tip].y
    pip_y = hand_landmarks.landmark[pip].y
    return tip_y < pip_y


def classify_simple(hand_landmarks) -> Optional[str]:
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
def home(request: Request)
