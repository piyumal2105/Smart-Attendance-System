import os
import pickle
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "teacher_behavior_rf_tuned2.pkl")

class PoseFeatures(BaseModel):
    # Expecting exactly 9 numeric features
    features: List[float]


def load_model(path=MODEL_PATH):
    if not os.path.exists(path):
        return None
    try:
        with open(path, "rb") as f:
            model = pickle.load(f)
        return model
    except Exception:
        return None


@router.post("/predict")
async def predict(features: PoseFeatures):
    if len(features.features) != 9:
        raise HTTPException(status_code=400, detail="Expected 9 features")

    clf = load_model()
    X = [features.features]

    if clf is None:
        # Fallback: simple threshold heuristic for demonstration
        # avg head pitch (assume feature 0) > 10 -> Interactive/Active
        avg_pitch = features.features[0]
        if avg_pitch > 15:
            label = "Interactive"
            probs = {"Passive": 0.05, "Lecturing": 0.15, "Interactive": 0.80}
        elif avg_pitch > 8:
            label = "Lecturing"
            probs = {"Passive": 0.10, "Lecturing": 0.75, "Interactive": 0.15}
        else:
            label = "Passive"
            probs = {"Passive": 0.85, "Lecturing": 0.10, "Interactive": 0.05}

        return {"label": label, "probabilities": probs, "model_loaded": False}

    try:
        pred = clf.predict(X)[0]
        if hasattr(clf, "predict_proba"):
            proba = clf.predict_proba(X)[0]
            classes = clf.classes_.tolist()
            probs = dict(zip(classes, proba.tolist()))
        else:
            probs = {str(pred): 1.0}

        return {"label": str(pred), "probabilities": probs, "model_loaded": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
