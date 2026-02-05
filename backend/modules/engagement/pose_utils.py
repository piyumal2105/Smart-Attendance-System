# pose_utils.py
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

import os

# Initialize PoseLandmarker with LITE model for better performance
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'pose_landmarker_lite.task')

base_options = python.BaseOptions(model_asset_path=model_path)
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.IMAGE,
    num_poses=1,  # Detect one pose per person crop
    min_pose_detection_confidence=0.3,  # Lower threshold for faster detection
    min_pose_presence_confidence=0.3,
    min_tracking_confidence=0.3
)
pose_landmarker = vision.PoseLandmarker.create_from_options(options)

# MediaPipe Pose landmark indices
NOSE = 0
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_HIP = 23
RIGHT_HIP = 24
LEFT_ELBOW = 13
RIGHT_ELBOW = 14
LEFT_WRIST = 15
RIGHT_WRIST = 16

def get_basic_pose_keypoints(bgr_img):
    """
    Returns dict with keypoints in image coordinates using MediaPipe PoseLandmarker.
    
    Returns:
        dict with keys: 'nose', 'l_shoulder', 'r_shoulder', 'l_hip', 'r_hip', 'l_elbow', 'r_elbow', 'l_wrist', 'r_wrist'
        Each value is a tuple (x, y) in image coordinates.
        Returns None if no pose detected or image is invalid.
    """
    if bgr_img is None or bgr_img.size == 0:
        return None
    
    h, w, _ = bgr_img.shape
    if h == 0 or w == 0:
        return None
    
    # Convert BGR to RGB for MediaPipe
    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
    
    # Create MediaPipe Image object
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_img)
    
    # Detect pose landmarks
    try:
        detection_result = pose_landmarker.detect(mp_image)
        
        if not detection_result.pose_landmarks or len(detection_result.pose_landmarks) == 0:
            return None
        
        # Get the first pose (we set num_poses=1)
        landmarks = detection_result.pose_landmarks[0]
        
        def xy(idx):
            """Convert normalized coordinates to pixel coordinates"""
            return (landmarks[idx].x * w, landmarks[idx].y * h)
        
        return {
            "nose": xy(NOSE),
            "l_shoulder": xy(LEFT_SHOULDER),
            "r_shoulder": xy(RIGHT_SHOULDER),
            "l_hip": xy(LEFT_HIP),
            "r_hip": xy(RIGHT_HIP),
            "l_elbow": xy(LEFT_ELBOW),
            "r_elbow": xy(RIGHT_ELBOW),
            "l_wrist": xy(LEFT_WRIST),
            "r_wrist": xy(RIGHT_WRIST),
        }
    except Exception as e:
        # If detection fails, return None
        return None

def draw_pose_keypoints(frame, keypoints, offset=(0, 0), color=(255, 0, 255)):
    """
    Draw pose keypoints on the frame.
    
    Args:
        frame: BGR image to draw on
        keypoints: dict from get_basic_pose_keypoints
        offset: (x_offset, y_offset) to add to keypoint coordinates
        color: BGR color tuple for drawing
    """
    if keypoints is None:
        return
    
    x_off, y_off = offset
    
    # helper
    def draw_line(p1_name, p2_name, c=color):
        if p1_name in keypoints and p2_name in keypoints:
            p1 = keypoints[p1_name]
            p2 = keypoints[p2_name]
            pt1 = (int(p1[0] + x_off), int(p1[1] + y_off))
            pt2 = (int(p2[0] + x_off), int(p2[1] + y_off))
            cv2.line(frame, pt1, pt2, c, 2)
            
    # Draw keypoints as circles
    for name, (x, y) in keypoints.items():
        # User requested to hide hips
        if "hip" in name:
            continue
            
        pt = (int(x + x_off), int(y + y_off))
        cv2.circle(frame, pt, 4, color, -1)
        # Add a white border for better visibility
        cv2.circle(frame, pt, 5, (255, 255, 255), 1)
    
    # Draw skeleton lines
    # Upper Body Only
    draw_line("l_shoulder", "r_shoulder")
    
    # Neck
    # (Nose to mid-shoulder) - manually calc mid-shoulder since it's not a keypoint
    if "l_shoulder" in keypoints and "r_shoulder" in keypoints and "nose" in keypoints:
        l_sh = keypoints["l_shoulder"]
        r_sh = keypoints["r_shoulder"]
        nose = keypoints["nose"]
        mid_x = (l_sh[0] + r_sh[0]) / 2
        mid_y = (l_sh[1] + r_sh[1]) / 2
        pt1 = (int(nose[0] + x_off), int(nose[1] + y_off))
        pt2 = (int(mid_x + x_off), int(mid_y + y_off))
        cv2.line(frame, pt1, pt2, color, 2)

    # Arms
    draw_line("l_shoulder", "l_elbow")
    draw_line("l_elbow", "l_wrist")
    draw_line("r_shoulder", "r_elbow")
    draw_line("r_elbow", "r_wrist")
