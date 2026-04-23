# SignSync-Web (Real-time Sign Communicator)

This is a **real-time** web app:
- Browser uses your **camera**
- Frames are sent to a **Python backend**
- Backend uses **MediaPipe Hands** to detect landmarks and outputs a **gesture label**
- You can also type text and see **sign cards** (placeholder images for now)

## Run (VS Code or PowerShell)

```powershell
cd C:\Users\hp\SignSync-Web
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python generate_sign_assets.py
uvicorn app.main:app --reload
```

Open the site at `http://127.0.0.1:8000`

## Notes
- If the browser asks for camera permission: click **Allow**
- If you have multiple cameras, we can add a dropdown later.

## Train on ASL Alphabet (Kaggle) using MediaPipe landmarks (recommended path)

This is how you turn the Kaggle **ASL Alphabet** images into a real **A–Z** real-time recognizer:

### Step A: Download the dataset

1) Download **ASL Alphabet** from Kaggle (zip).
2) Extract it so you have folders like:

`dataset/asl_alphabet_train/asl_alphabet_train/A/...jpg`

Put it inside this project like:

`C:\Users\hp\SignSync-Web\dataset\asl_alphabet_train\asl_alphabet_train\A\...`

### Step B: Extract hand landmarks to a CSV

```powershell
cd C:\Users\hp\SignSync-Web
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python train\extract_landmarks.py --dataset .\dataset\asl_alphabet_train\asl_alphabet_train --out .\models\asl_landmarks.csv
```

### Step C: Train a model and save it

```powershell
python train\train_asl.py --csv .\models\asl_landmarks.csv --out .\models\asl_model.joblib
```

### Step D: Use the model in the live web app

Start the server and the app will auto-load `models/asl_model.joblib` if present.

```powershell
uvicorn app.main:app --reload
```

