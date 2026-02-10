import cv2
import mediapipe as mp
import numpy as np

# Initialize FaceLandmarker with the new API
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# Download the model file if needed
# You can download from: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

# For now, let's use a simpler approach with cv2 DNN face detection
# and estimate pitch based on face bounding box position

def estimate_pitch_bgr(face_bgr):
    """
    Estimate head pitch using a simple heuristic based on face aspect ratio.
    Positive pitch = head tilted down, Negative pitch = head tilted up
    """
    if face_bgr is None or face_bgr.size == 0:
        return None
    
    h, w, _ = face_bgr.shape
    h, w, _ = face_bgr.shape
    if h < 30 or w < 30:
        return None
    
    # Simple heuristic: use aspect ratio as a proxy for pitch
    # When head tilts down, face appears more compressed vertically
    aspect_ratio = h / w
    
    # Normalize to a pitch-like angle (-30 to +30 degrees)
    # Typical face aspect ratio is around 1.3-1.5
    # Lower ratio (wider face) suggests head is tilted down
    # Higher ratio (taller face) suggests head is tilted up
    
    baseline_ratio = 1.4  # Typical neutral face aspect ratio
    pitch = (baseline_ratio - aspect_ratio) * 50  # Scale factor
    
    # Clamp to reasonable range
    pitch = np.clip(pitch, -45, 45)
    
    return pitch
