Teacher Behavior module

Quick start:

- Install Python deps (see root `requirements.txt`).
- Fix Python / MediaPipe environment (if you see attribute errors with protobuf):

  pip uninstall mediapipe protobuf -y
  pip install mediapipe protobuf==3.20.3

- Ensure the trained model file `teacher_behavior_rf_tuned2.pkl` is placed at `backend/modules/teacher_behavior/teacher_behavior_rf_tuned2.pkl` or in `backend/modules/teacher_behavior/models/`.

- NOTE: The dummy model generator was intentionally removed to prevent accidental use of synthetic models; do NOT add or use dummy models for demos.

- CSV Report: The system writes a CSV report at `backend/modules/teacher_behavior/reports/teacher_behavior_report.csv` with columns: `timestamp, behavior, mobility, orientation`. This file is appended to as inference runs, and can be downloaded from the backend using the report endpoint.
- To use your trained model, place `teacher_behavior_rf_tuned2.pkl` at `backend/modules/teacher_behavior/teacher_behavior_rf_tuned2.pkl` or in `backend/modules/teacher_behavior/models/`.

- Run the backend (from `backend` folder):

  uvicorn main:app --reload --port 8000

- Frontend: run the Next.js app (`frontend`) and open `/teacher/teacher_behavior` page.

API:

POST /teacher_behavior/predict
Body: { "features": [f1, f2, ..., f9] }
Response: { "label": "Passive|Lecturing|Interactive", "probabilities": {...}, "model_loaded": true/false }
