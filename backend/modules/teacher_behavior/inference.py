import cv2
import joblib
import numpy as np
import mediapipe as mp
from collections import deque
import os
import math
try:
    import yt_dlp  # Optional dependency for YouTube URLs
    _HAS_YTDLP = True
except Exception as e:
    yt_dlp = None
    _HAS_YTDLP = False
    print(f"Warning: yt_dlp not available ({e}). YouTube source will be disabled; using webcam instead.")

# --- CONFIGURATION ---
# PASTE YOUR YOUTUBE LINK HERE. Set to None to use Webcam (0).
YOUTUBE_URL = "https://youtu.be/50Bda5VKbqA?si=h_yvn1nmEviIpD8p" 

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "teacher_behavior_rf_tuned2.pkl")
LABELS = {0: "PASSIVE", 1: "LECTURING", 2: "INTERACTIVE"}

# --- LOAD MODEL ---
print(f"Loading Teacher Model from {MODEL_PATH}...")
try:
    model = joblib.load(MODEL_PATH)
except FileNotFoundError:
    print(f"CRITICAL ERROR: Model file not found at {MODEL_PATH}")
    model = None

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# --- GLOBAL STATE ---
current_stats = {
    "behavior": "Initializing...",
    "mobility": 0.0,
    "orientation": 0.0,
    "hand_speed": 0.0
}

hip_ref_global = None
torso_ref_global = None

# --- YOUTUBE HELPER ---
class MyLogger:
    def debug(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        print(msg)

def get_video_source(url):
    if not url:
        return 0  # Webcam
    if not _HAS_YTDLP:
        print("yt_dlp not installed; cannot use YouTube URL. Falling back to webcam.")
        return 0
    try:
        # 'noprogress': True is critical to avoid WinError 6 (invalid handle) when running in background/no-console
        ydl_opts = {
            'format': 'best[ext=mp4]', 
            'quiet': True, 
            'noprogress': True,
            'logger': MyLogger()
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            # Prefer top-level 'url' if present (some yt-dlp extracts set it), otherwise look through formats
            if isinstance(info, dict):
                if info.get('url'):
                    return info['url']
                formats = info.get('formats') or []
                # pick the best mp4 or first available url
                for f in reversed(formats):
                    if f.get('url'):
                        return f['url']
        print("Couldn't extract usable stream URL from YouTube info; falling back to webcam.")
        return 0
    except Exception as e:
        print(f"Error fetching YouTube URL: {e}. Falling back to webcam.")
        return 0

# --- MATH HELPERS (Keep existing logic) ---
def get_ref_from_frames(frames):
    for frame in frames:
        joints = frame["joints"]
        ls, rs = joints[4], joints[8]
        lh, rh = joints[12], joints[16]
        hip_center = ((lh[0]+rh[0])/2, (lh[1]+rh[1])/2, (lh[2]+rh[2])/2)
        shoulder_center = ((ls[0]+rs[0])/2, (ls[1]+rs[1])/2, (ls[2]+rs[2])/2)
        torso_len = math.dist(hip_center, shoulder_center)
        if torso_len > 1e-5: return hip_center, torso_len
    return None, None

def _orientation_angle(p_left, p_right):
    dx = p_right[0] - p_left[0]
    dz = p_right[2] - p_left[2]
    return math.degrees(math.atan2(dz, dx))

def seq_features_from_frames(frames, hip_ref, torso_ref):
    if len(frames) < 3: return np.zeros(9, dtype=np.float32)
    hand_speeds, mobilities, orientations = [], [], []
    max_hand_heights, hand_spreads, speed_diffs = [], [], []
    prev_lw = prev_rw = prev_hip = None

    def norm(pt): 
        return ((pt[0]-hip_ref[0])/torso_ref, (pt[1]-hip_ref[1])/torso_ref, (pt[2]-hip_ref[2])/torso_ref)

    fps = 30.0
    for frame in frames:
        joints = frame["joints"]
        ls, rs = joints[4], joints[8]
        lw, rw = joints[6], joints[10]
        lh, rh = joints[12], joints[16]

        hip_center = ((lh[0]+rh[0])/2, (lh[1]+rh[1])/2, (lh[2]+rh[2])/2)
        hip_n, lw_n, rw_n = norm(hip_center), norm(lw), norm(rw)
        ls_n, rs_n = norm(ls), norm(rs)

        orientations.append(_orientation_angle(ls_n, rs_n))
        max_hand_heights.append(max(lw_n[1], rw_n[1]))
        hand_spreads.append(math.dist(lw_n, rw_n))

        if prev_lw is not None:
            dt = 1.0/fps
            lw_s = math.dist(lw_n, prev_lw)/dt
            rw_s = math.dist(rw_n, prev_rw)/dt
            hand_speeds.append((lw_s + rw_s)/2.0)
            speed_diffs.append(abs(lw_s - rw_s))
            mobilities.append(math.dist(hip_n, prev_hip)/dt)
        prev_lw, prev_rw, prev_hip = lw_n, rw_n, hip_n

    if not hand_speeds: return np.zeros(9, dtype=np.float32)
    ori_diff = np.diff(orientations) if len(orientations) > 1 else [0.0]

    return np.array([
        float(np.mean(hand_speeds)), float(np.std(hand_speeds)),
        float(np.mean(mobilities)), float(np.std(mobilities)),
        float(np.mean(ori_diff)), float(np.std(ori_diff)),
        float(np.mean(max_hand_heights)), float(np.mean(hand_spreads)),
        float(np.mean(speed_diffs))
    ], dtype=np.float32)

def process_frame_for_features(results):
    if not results.pose_landmarks: return None
    lm = results.pose_landmarks.landmark
    kinect_joints = [(0,0,0)] * 25
    def get_xyz(idx): return (lm[idx].x, lm[idx].y, lm[idx].z)
    kinect_joints[4], kinect_joints[8] = get_xyz(11), get_xyz(12)
    kinect_joints[6], kinect_joints[10] = get_xyz(15), get_xyz(16)
    kinect_joints[12], kinect_joints[16] = get_xyz(23), get_xyz(24)
    return {"joints": kinect_joints}

# --- GENERATOR ---
def run_teacher_inference():
    source = get_video_source(YOUTUBE_URL)
    cap = cv2.VideoCapture(source)
    # If VideoCapture failed (common for some remote URLs), try webcam fallback
    if not cap.isOpened():
        print(f"Failed to open video source ({source}). Falling back to webcam.")
        try:
            cap.release()
        except Exception:
            pass
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            raise RuntimeError("Unable to open any video source (YouTube and webcam both failed). Ensure webcam is connected or disable YOUTUBE_URL.")

    frame_buffer = deque(maxlen=30)
    global hip_ref_global, torso_ref_global

    while True:
        success, frame = cap.read()
        if not success: 
            # Loop video if using YouTube/File
            if YOUTUBE_URL:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                break

        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)
        mp.solutions.drawing_utils.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        skel = process_frame_for_features(results)
        if skel: frame_buffer.append(skel)

        if len(frame_buffer) == 30 and model:
            win = list(frame_buffer)
            if hip_ref_global is None:
                hip_ref_global, torso_ref_global = get_ref_from_frames(win)

            if hip_ref_global:
                feats = seq_features_from_frames(win, hip_ref_global, torso_ref_global)
                pred = model.predict(feats.reshape(1, -1))[0]

                current_stats["behavior"] = LABELS.get(pred, "Unknown")
                current_stats["mobility"] = round(float(feats[2]), 3)
                current_stats["orientation"] = round(float(feats[5]), 3)
                current_stats["hand_speed"] = round(float(feats[0]), 3)

                color = (0, 255, 0) if pred == 2 else (0, 165, 255)
                cv2.putText(frame, f"{current_stats['behavior']}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

        ret, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\n' b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

def get_latest_stats(): return current_stats