import cv2
import numpy as np
import pandas as pd
import os
import sys
from ultralytics import YOLO
from collections import deque, defaultdict

# Fix imports
try:
    from .head_pose import estimate_pitch_bgr
    from .pose_utils import get_basic_pose_keypoints, draw_pose_keypoints
    from .tracking_utils import non_max_suppression_fast
except ImportError:
    from head_pose import estimate_pitch_bgr
    from pose_utils import get_basic_pose_keypoints, draw_pose_keypoints
    from tracking_utils import non_max_suppression_fast

# Constants
FPS = 25
WINDOW_SEC = 3
WINDOW_FRAMES = FPS * WINDOW_SEC
SKIP_POSE_FRAMES = 15
FRAME_STRIDE = 2
OUTPUT_CSV = "data/labeled_dataset_new.csv"
OUTPUT_VIDEO = "data/annotation_helper.mp4"

def classify_frame_posture(pitch, pose_kpts):
    head_down = 0
    lean_forward = 0
    writing_like = 0

    # 2. Robust Pose/Pitch: conservative pitch threshold if pose is missing
    if pose_kpts is None:
        if pitch is not None and pitch > 25:
            head_down = 1
        return head_down, lean_forward, writing_like

    nose = pose_kpts.get("nose")
    ls = pose_kpts.get("l_shoulder")
    rs = pose_kpts.get("r_shoulder")
    lh = pose_kpts.get("l_hip")
    rh = pose_kpts.get("r_hip")
    lw = pose_kpts.get("l_wrist")
    rw = pose_kpts.get("r_wrist")

    if pitch is not None and pitch > 15:
        head_down = 1

    # Check for critical body parts - require hips for advanced posture
    if any(k is None for k in [nose, ls, rs, lh, rh]):
        # Fallback to loose pitch check if we can't estimate torso
        if pitch is not None and pitch > 20: 
            head_down = 1
        return head_down, lean_forward, writing_like

    # Coordinates
    nose_x, nose_y = nose
    ls_x, ls_y = ls
    rs_x, rs_y = rs
    lh_x, lh_y = lh
    rh_x, rh_y = rh

    # Centers and Lengths
    shoulder_x = (ls_x + rs_x) / 2.0
    shoulder_y = (ls_y + rs_y) / 2.0
    hip_y = (lh_y + rh_y) / 2.0
    
    torso_len = abs(hip_y - shoulder_y) + 1e-6
    shoulder_width = abs(rs_x - ls_x) + 1e-6

    # 2. Lean Forward Logic (Relative X)
    # Check if nose deviates horizontally from shoulder center (relative to shoulder width)
    # This implies leaning sideways or forward if seen from side angle
    nose_offset_x = (nose_x - shoulder_x) / shoulder_width
    if abs(nose_offset_x) > 0.5:
        lean_forward = 1

    # 1. Writing Logic
    wrists_on_desk = False
    for w_pt in [lw, rw]:
        if w_pt is not None:
            wy = w_pt[1]
            if wy > shoulder_y:
                wrists_on_desk = True
    
    if (head_down or lean_forward) and wrists_on_desk:
        writing_like = 1

    return head_down, lean_forward, writing_like

def generate_synced_data(video_path=None):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    if video_path is None:
        video_path = os.path.join(BASE_DIR, "data", "sample_classroom.mp4")

    # Output Paths
    csv_path = os.path.join(BASE_DIR, OUTPUT_CSV)
    vid_path = os.path.join(BASE_DIR, OUTPUT_VIDEO)
    
    print(f"Processing: {video_path}")
    print(f"Generating Synced CSV: {csv_path}")
    print(f"Generating Synced Video: {vid_path}")

    # Load YOLO
    yolo_path = os.path.join(BASE_DIR, "yolov8n.pt")
    if not os.path.exists(yolo_path):
        yolo_path = os.path.join(BASE_DIR, "yolov8s.pt")
    model = YOLO(yolo_path)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error opening video.")
        return

    # Video Writer
    fps_in = cap.get(cv2.CAP_PROP_FPS)
    w_in = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h_in = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    print(f"Video FPS: {fps_in}")
    
    # Resize to 1280
    target_w = 1280
    scale = target_w / w_in
    target_h = int(h_in * scale)
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(vid_path, fourcc, fps_in, (target_w, target_h))

    history = defaultdict(lambda: deque(maxlen=WINDOW_FRAMES))
    pose_cache = {}
    dataset_rows = []
    
    frame_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # accurate timestamp
            current_time_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            
            frame_count += 1
            if frame_count % 50 == 0:
                print(f"Processing frame {frame_count} ({current_time_sec:.2f}s)...")
            
            # Stop at 1000 frames to keep file size manageable
            if frame_count > 1000:
                break
            
            # Resize
            frame = cv2.resize(frame, (target_w, target_h))
            h, w = frame.shape[:2]
            
            # Tracking - using ByteTrack for better stability
            results = model.track(frame, classes=[0], verbose=False, persist=True, tracker="bytetrack.yaml")
            frame_boxes = results[0].boxes
            
            if frame_boxes.id is not None:
                ids = frame_boxes.id.cpu().numpy().astype(int)
                boxes = frame_boxes.xyxy.cpu().numpy()
                
                # NMS
                boxes, ids = non_max_suppression_fast(boxes, ids, overlapThresh=0.3)
                
                for (x1, y1, x2, y2), tid in zip(boxes, ids):
                    x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                    
                    # 1. Visualization
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                    cv2.putText(frame, f"ID: {tid}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                    
                    # 2. Features
                    person_crop = frame[y1:y2, x1:x2]
                    if person_crop.size == 0: continue
                    
                    # Pose
                    pose_kpts = None
                    if frame_count % SKIP_POSE_FRAMES == 0:
                        try:
                            small_crop = cv2.resize(person_crop, None, fx=0.5, fy=0.5)
                            pose_kpts = get_basic_pose_keypoints(small_crop)
                            pose_cache[tid] = pose_kpts
                        except:
                            pose_kpts = pose_cache.get(tid)
                    else:
                        pose_kpts = pose_cache.get(tid)
                    
                    # Draw Pose
                    if pose_kpts:
                        # Scale back up
                        scaled_kpts = {k: (v[0]*2, v[1]*2) for k,v in pose_kpts.items()}
                        draw_pose_keypoints(frame, scaled_kpts, offset=(x1, y1))
                        
                    # Pitch
                    head_h = (y2 - y1) // 3
                    head_crop = frame[y1:y1 + head_h, x1:x2]
                    pitch = None
                    if head_crop.size > 0:
                         pitch = estimate_pitch_bgr(cv2.resize(head_crop, None, fx=0.5, fy=0.5))
                    
                    # Store Features
                    hd, lf, wl = classify_frame_posture(pitch, pose_kpts)
                    p_val = pitch if pitch is not None else 0.0 # simple fallback
                    history[tid].append((p_val, hd, lf, wl))

                    # 3. Add to Dataset (Every 10 frames to avoid bloat, same as before)
                    # Sync Logic: Use exactly the logic that writes the row
                    if len(history[tid]) >= 5 and frame_count % 10 == 0:
                        buffer = list(history[tid])
                        df_buff = pd.DataFrame(buffer, columns=["p", "hd", "lf", "wl"])
                        
                        # Calculate delta between consecutive frames (Match run_inference.py)
                        df_buff["p_delta"] = df_buff["p"].diff().abs().fillna(0.0)
                        p_delta_mean = df_buff["p_delta"].mean()
                        p_delta_std = df_buff["p_delta"].std()
                        if np.isnan(p_delta_std): p_delta_std = 0.0
                        
                        row = {
                            "frame": frame_count,
                            "time_sec": round(current_time_sec, 2), # Use accurate time
                            "student_id": tid,
                            "avg_pitch": df_buff["p"].mean(),
                            "ratio_head_down": df_buff["hd"].mean(),
                            "ratio_lean_forward": df_buff["lf"].mean(),
                            "ratio_writing_like": df_buff["wl"].mean(),
                            "pitch_delta_mean": p_delta_mean,
                            "pitch_delta_std": p_delta_std,
                            "label_engaged": "" # To be labeled
                        }
                        dataset_rows.append(row)

            # Global Vis
            cv2.putText(frame, f"Frame: {frame_count}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)
            out.write(frame)

    except KeyboardInterrupt:
        print("Interrupted.")
    finally:
        cap.release()
        out.release()
        
        # Save CSV
        df = pd.DataFrame(dataset_rows)
        # removed zero-filling loop
            
        cols = ["frame", "time_sec", "student_id", 
                "avg_pitch", "ratio_head_down", "ratio_lean_forward",
                "ratio_writing_like", "pitch_delta_mean", "pitch_delta_std", "label_engaged"]
        df = df[cols] if not df.empty else pd.DataFrame(columns=cols)
        
        df.to_csv(csv_path, index=False)
        print("Done. Synced Video and CSV generated.")

if __name__ == "__main__":
    generate_synced_data()
