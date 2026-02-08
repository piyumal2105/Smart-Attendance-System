"""Face Recognition using DeepFace (works with Python 3.13)"""

import numpy as np
import base64
import io
from PIL import Image
from typing import Tuple, Optional
import logging
import tempfile
import os

logger = logging.getLogger(__name__)

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    logger.warning("DeepFace not available")


def base64_to_image(base64_string: str) -> np.ndarray:
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    image_bytes = base64.b64decode(base64_string)
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != 'RGB':
        image = image.convert('RGB')
    return np.array(image)


def save_temp_image(image_array: np.ndarray, filename: str) -> str:
    temp_dir = tempfile.gettempdir()
    filepath = os.path.join(temp_dir, filename)
    image = Image.fromarray(image_array)
    image.save(filepath, 'JPEG')
    return filepath


def verify_face_from_base64(
    profile_picture_base64: str,
    selfie_base64: str,
    tolerance: float = 0.4
) -> Tuple[bool, str, Optional[float]]:
    if not DEEPFACE_AVAILABLE:
        return False, "Face recognition not available", None
    
    temp_profile = None
    temp_selfie = None
    
    try:
        profile_image = base64_to_image(profile_picture_base64)
        selfie_image = base64_to_image(selfie_base64)
        
        temp_profile = save_temp_image(profile_image, 'temp_profile.jpg')
        temp_selfie = save_temp_image(selfie_image, 'temp_selfie.jpg')
        
        result = DeepFace.verify(
            img1_path=temp_profile,
            img2_path=temp_selfie,
            model_name="VGG-Face",
            distance_metric="cosine",
            enforce_detection=True,
            detector_backend='opencv'
        )
        
        is_match = result['verified']
        distance = result['distance']
        
        final_match = distance < tolerance
        
        if final_match:
            confidence = (1 - distance) * 100
            return True, f"Face verified successfully! (Confidence: {confidence:.1f}%)", distance
        else:
            return False, f"Face verification failed. Distance: {distance:.4f}", distance
    
    except Exception as e:
        logger.error(f"Face verification error: {e}")
        if "Face could not be detected" in str(e):
            return False, "No face detected. Please ensure your face is clearly visible.", None
        return False, f"Verification error: {str(e)}", None
    
    finally:
        for temp_file in [temp_profile, temp_selfie]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass


def validate_face_quality(base64_image: str) -> Tuple[bool, str]:
    if not DEEPFACE_AVAILABLE:
        return True, "Validation skipped"
    
    temp_file = None
    try:
        image = base64_to_image(base64_image)
        height, width = image.shape[:2]
        
        if width < 200 or height < 200:
            return False, "Image resolution too low"
        
        temp_file = save_temp_image(image, 'temp_validation.jpg')
        
        face_objs = DeepFace.extract_faces(
            img_path=temp_file,
            detector_backend='opencv',
            enforce_detection=True
        )
        
        if len(face_objs) == 0:
            return False, "No face detected"
        if len(face_objs) > 1:
            return False, f"Multiple faces detected ({len(face_objs)})"
        
        return True, "Face quality good"
    
    except Exception as e:
        if "Face could not be detected" in str(e):
            return False, "No face detected"
        return False, f"Validation error: {str(e)}"
    
    finally:
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass


def get_face_encoding(image: np.ndarray) -> Optional[np.ndarray]:
    return None

def compare_faces(known, unknown, tolerance=0.6) -> Tuple[bool, float]:
    return False, 1.0