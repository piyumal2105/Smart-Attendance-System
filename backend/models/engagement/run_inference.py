import cv2
import numpy as np
import pandas as pd
import pickle
import time
from ultralytics import YOLO
from collections import deque, defaultdict

# Fix imports to work both as script and module
try:
    from .head_pose import estimate_pitch_bgr
    from .pose_utils import get_basic_pose_keypoints
except ImportError:
    from head_pose import estimate_pitch_bgr
    from pose_utils import get_basic_pose_keypoints

FPS = 25
WINDOW_SEC = 3
WINDOW_FRAMES = FPS * WINDOW_SEC
SKIP_POSE_FRAMES = 15
FRAME_STRIDE = 3  

# Global stats shared with API
LATEST_STATS = {"total": 0, "engaged": 0, "active": 0}
LATEST_GROUP_STATS = {
    "Front Row": {"engaged": 0, "total": 0},
    "Middle Row": {"engaged": 0, "total": 0},
    "Back Row": {"engaged": 0, "total": 0}
}
STATS_HISTORY = []
VISUALIZE_GROUPS = False
VISUAL_STYLE = "dots" # Options: "dots", "boxes", "detailed"
ZONE_SPLITS = {"back": 0.33, "front": 0.66}

def set_group_visualization(enabled: bool):
    global VISUALIZE_GROUPS
    VISUALIZE_GROUPS = enabled
    print(f"Group visualization set to: {VISUALIZE_GROUPS}")

def set_visual_style(style: str):
    global VISUAL_STYLE
    VISUAL_STYLE = style
    print(f"Visual style set to: {VISUAL_STYLE}")

def set_zone_boundaries(back_split: float, front_split: float):
    global ZONE_SPLITS
    ZONE_SPLITS["back"] = back_split
    ZONE_SPLITS["front"] = front_split
    print(f"Zone boundaries updated: {ZONE_SPLITS}")



def classify_frame_posture(pitch, pose_kpts):
    head_down = 0
    lean_forward = 0
    writing_like = 0

    # 2. Robust Pose/Pitch: conservative pitch threshold if pose is missing
    if pose_kpts is None:
        if pitch is not None and pitch > 25:  # Increased from 15 for valid-only pitch
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

    # Check for critical body parts
    if any(k is None for k in [nose, ls, rs, lh, rh]):
        # Fallback to loose pitch check if we can't estimate torso
        if pitch is not None and pitch > 20: # Slightly higher than 15
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
    nose_offset_x = (nose_x - shoulder_x) / shoulder_width
    if abs(nose_offset_x) > 0.5:
        lean_forward = 1

    # 1. Writing Logic
    # Heuristic: Head is down/forward AND at least one wrist is in the "desk zone"
    # Desk zone approx: below shoulders, above hips (or slightly below hips if camera is high)
    # We'll valid detection if wrist is below shoulder line.
    wrists_on_desk = False
    for w_pt in [lw, rw]:
        if w_pt is not None:
            wy = w_pt[1]
            # Check if wrist is lower than shoulders (y is bigger)
            if wy > shoulder_y:
                wrists_on_desk = True
    
    # If leaning forward or head down, AND wrists are engaging, classify as writing_like
    if (head_down or lean_forward) and wrists_on_desk:                                   
        writing_like = 1
    
    return head_down, lean_forward, writing_like
     
import os

# ...

def run_inference(video_path=None, show_video=False):
    print("Entered run_inference...", flush=True)
    # Base path for this module
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

    # If video_path is None, default to the sample in data/
    if video_path is None:
        video_path = os.path.join(BASE_DIR, "data", "1.mp4")
    
    print(f"Target Video Path: {video_path}", flush=True)

    # Load engagement model
    model_path = os.path.join(BASE_DIR, "models", "engagement_model.pkl")
    print(f"Loading engagement model from {model_path}...", flush=True)
    
    clf = None
    threshold = 0.5
    
    with open(model_path, "rb") as f:
        artifact = pickle.load(f)
        
    if isinstance(artifact, dict) and "model" in artifact:
        clf = artifact["model"]
        threshold = artifact.get("threshold", 0.5)
        print(f"Loaded optimized model with threshold: {threshold:.3f}", flush=True)
    else:
        clf = artifact
        print("Loaded legacy model (default threshold 0.5)", flush=True)
        
    print("Engagement model loaded.", flush=True)

    # Load YOLO
    # Prioritize yolov8n (Nano) for speed
    yolo_path = os.path.join(BASE_DIR, "yolov8s.pt")
    if not os.path.exists(yolo_path):
        print("yolov8m.pt not found, using yolov8s.pt...", flush=True)
        yolo_path = os.path.join(BASE_DIR, "yolov8s.pt")
    
    print(f"Loading YOLO from {yolo_path}...", flush=True)
    model = YOLO(yolo_path)
    print("YOLO loaded.", flush=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error opening video {video_path}", flush=True)
        return

    # --- Pre-load frames for Boomerang Loop (max 7s) ---
    print("Buffering frames for boomerang loop...", flush=True)
    frames_buffer = []
    
    while True:
        ret, raw_frame = cap.read()
        if not ret:
            break
            
        # Stop buffering after 7 seconds
        if cap.get(cv2.CAP_PROP_POS_MSEC) > 7000:
            break
            
        # Resize immediately to store "ready" frames (saves memory/CPU)
        h, w = raw_frame.shape[:2]
        target_w = 1280
        if w > target_w:
            scale = target_w / w
            new_h = int(h * scale)
            raw_frame = cv2.resize(raw_frame, (target_w, new_h))
            
        frames_buffer.append(raw_frame)
        
    cap.release()
    print(f"Buffered {len(frames_buffer)} frames for looping.", flush=True)
    
    if not frames_buffer:
        print("Error: No frames loaded.")
        return

    # Boomerang state
    buffer_idx = 0
    direction = 1 # 1 for forward, -1 for backward
    # ---------------------------------------------------

    history = defaultdict(lambda: deque(maxlen=WINDOW_FRAMES))
    # 4. Tracking Stability: Smooth predictions
    prediction_history = defaultdict(lambda: deque(maxlen=5)) 
    engagement_state = {}
    pose_cache = {}

    # Global stats for API
    # Global stats for API
    # Do NOT reassign LATEST_STATS = { ... } as it breaks the reference imported by main.py
    LATEST_STATS.update({"total": 0, "engaged": 0, "active": 0})
    
    # Reset group stats
    for key in LATEST_GROUP_STATS:
        LATEST_GROUP_STATS[key] = {"engaged": 0, "total": 0}
    
    frame_count = 0
    last_detections = []  # list of dicts: {x1,y1,x2,y2,color,text}
    
    t_start = time.time() # Start time for FPS calc

    print("Starting inference loop...")

    while True:
        # Get frame from buffer
        frame = frames_buffer[buffer_idx].copy() # Copy essential to avoid drawing on cached frame
        
        # Update index for next iteration (Boomerang Logic)
        buffer_idx += direction
        
        # Bounce at ends
        if buffer_idx >= len(frames_buffer):
            buffer_idx = len(frames_buffer) - 2
            direction = -1
        elif buffer_idx < 0:
            buffer_idx = 1
            direction = 1

        frame_count += 1
        
        h, w = frame.shape[:2] # Get dimensions of the pre-sized frame
            
        # Define zone limits for every frame
        y_back_limit = h * ZONE_SPLITS["back"]
        y_front_limit = h * ZONE_SPLITS["front"]

        run_heavy = (frame_count % FRAME_STRIDE == 0)

        if run_heavy:
            # Run YOLO tracking
            # FORCE GPU: device=0
            try:
                # REDUCED imgsz to 640 from 1280 for speed. 
                # Conf=0.25 (standard) to reduce false positives if any.
                results = model.track(frame, device="cuda", classes=[0], verbose=False, persist=True, conf=0.10, imgsz=960)
            except Exception as e:
                # Fallback to CPU if GPU fails
                print(f"Tracking error (trying CPU fallback): {e}")
                results = model.track(frame, device="cpu", classes=[0], verbose=False, persist=True, conf=0.10, imgsz=960)

            frame_boxes = results[0].boxes
            last_detections = []

            if frame_boxes.id is not None:
                ids = frame_boxes.id.cpu().numpy().astype(int)
                boxes = frame_boxes.xyxy.cpu().numpy()
                
                # Apply NMS to remove duplicates
                try:
                    from .tracking_utils import non_max_suppression_fast
                except ImportError:
                    from tracking_utils import non_max_suppression_fast
                
                # Relaxed NMS threshold to 0.75
                boxes, ids = non_max_suppression_fast(boxes, ids, overlapThresh=0.75)

                for (x1, y1, x2, y2), tid in zip(boxes, ids):
                    x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                    x1 = max(0, x1); y1 = max(0, y1)
                    x2 = min(w, x2); y2 = min(h, y2)
                    if x2 <= x1 or y2 <= y1:
                        continue

                    person_crop = frame[y1:y2, x1:x2]
                    if person_crop.size == 0:
                        continue

                    # Pose (downscaled, infrequent)
                    pose_kpts = None
                    # Pose (downscaled, infrequent, staggered)
                    # Stagger updates to avoid lag spikes: (frame + tid) % SKIP == 0
                    pose_kpts = None
                    if (frame_count + tid) % SKIP_POSE_FRAMES == 0:
                        try:
                            # small_crop = cv2.resize(person_crop, None, fx=0.5, fy=0.5) 
                            # MediaPipe Lite is fast enough, but resizing helps CPU usage further
                            # Let's keep it small for speed
                            h_crop, w_crop = person_crop.shape[:2]
                            if h_crop > 64 and w_crop > 64:
                                small_crop = cv2.resize(person_crop, (0,0), fx=0.5, fy=0.5)
                            else:
                                small_crop = person_crop
                                
                            pose_kpts = get_basic_pose_keypoints(small_crop)
                            pose_cache[tid] = pose_kpts
                        except Exception:
                            pose_kpts = pose_cache.get(tid, None)
                    else:
                        pose_kpts = pose_cache.get(tid, None)

                    # Head pitch (downscaled)
                    head_h = (y2 - y1) // 3
                    head_crop = frame[y1:y1 + head_h, x1:x2]
                    if head_crop.size > 0:
                        head_small = cv2.resize(head_crop, None, fx=0.5, fy=0.5)
                        pitch = estimate_pitch_bgr(head_small)
                    else:
                        pitch = None

                    hd, lf, wl = classify_frame_posture(pitch, pose_kpts)
                    p_val = pitch if pitch is not None else np.nan
                    history[tid].append((p_val, hd, lf, wl))

                    # Update engagement every 5 heavy frames
                    if len(history[tid]) >= 10 and frame_count % (FRAME_STRIDE * 5) == 0:
                        buffer = list(history[tid])
                        df_buff = pd.DataFrame(buffer, columns=["p", "hd", "lf", "wl"])

                        # Handle Pitch
                        if df_buff["p"].isnull().all():
                             df_buff["p"] = 0.0
                        else:
                             df_buff["p"] = df_buff["p"].fillna(df_buff["p"].mean())
                        
                        avg_pitch = df_buff["p"].mean()
                        
                        # 3. Static Listening features
                        df_buff["p_delta"] = df_buff["p"].diff().abs().fillna(0.0)
                        p_delta_mean = df_buff["p_delta"].mean()
                        p_delta_std = df_buff["p_delta"].std()
                        if np.isnan(p_delta_std): p_delta_std = 0.0

                        r_hd = df_buff["hd"].mean()
                        r_lf = df_buff["lf"].mean()
                        r_wl = df_buff["wl"].mean()

                        X_in = pd.DataFrame(
                            [[avg_pitch, r_hd, r_lf, r_wl, p_delta_mean, p_delta_std]],
                            columns=["avg_pitch", "ratio_head_down",
                                     "ratio_lean_forward", 
                                     "ratio_writing_like", "pitch_delta_mean", "pitch_delta_std"]
                        )

                        try:
                            # IMPORTANT: This will fail until model is retrained with new features.
                            # For now, we wrap in try/except and just output a default or warning if shape mismatch
                            if clf.n_features_in_ != X_in.shape[1]:
                                # print(f"Model mismatch: expect {clf.n_features_in_}, got {X_in.shape[1]}")
                                pred = 0; prob = 0.0
                            else:
                                prob = clf.predict_proba(X_in)[0][1]
                                pred = 1 if prob >= threshold else 0
                            
                            # Smoothing
                            prediction_history[tid].append(pred)
                            # Majority vote
                            if sum(prediction_history[tid]) > len(prediction_history[tid]) / 2:
                                final_pred = 1
                            else:
                                final_pred = 0
                                
                            engagement_state[tid] = (final_pred, prob)
                        except Exception:
                            pass

                    # Prepare visualization info
                    label, score = engagement_state.get(tid, (None, 0.0))
                    if label == 1:
                        color = (0, 255, 0)
                        text = f"Engaged ({score:.2f})"
                    elif label == 0:
                        color = (0, 0, 255)
                        text = f"Not Engaged ({score:.2f})"
                    else:
                        color = (0, 255, 255)
                        text = "Analyzing..."

                    # 4. Tracking Stability: Enforce valid history length
                    if len(history[tid]) < WINDOW_FRAMES / 2:
                         text = "Analyzing..."
                         color = (0, 255, 255)

                    last_detections.append({
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                        "color": color, "text": text
                    })

            # Update global stats
            engaged_count = sum(1 for d in last_detections if "Engaged" in d["text"] and "Not" not in d["text"])
            total_active = len(last_detections)
            
            # --- Grouping Logic (Rows) ---
            # Reset local counters
            group_counts = {
                "Front Row": {"engaged": 0, "total": 0},
                "Middle Row": {"engaged": 0, "total": 0},
                "Back Row": {"engaged": 0, "total": 0}
            }
            
            # Frame height is h
            y_back_limit = h * ZONE_SPLITS["back"]
            y_front_limit = h * ZONE_SPLITS["front"]
            
            for d in last_detections:
                # Calculate center Y
                cy = (d["y1"] + d["y2"]) / 2.0
                is_engaged = "Engaged" in d["text"] and "Not" not in d["text"]
                
                if cy < y_back_limit:
                    group = "Back Row"
                elif cy < y_front_limit:
                    group = "Middle Row"
                else:
                    group = "Front Row"
                    
                group_counts[group]["total"] += 1
                if is_engaged:
                    group_counts[group]["engaged"] += 1
            
            # Update global group stats
            for key in LATEST_GROUP_STATS:
                LATEST_GROUP_STATS[key] = group_counts[key]
            # -----------------------------

            LATEST_STATS["total"] = total_active # Total people visible
            LATEST_STATS["engaged"] = engaged_count
            LATEST_STATS["active"] = total_active # Using total visible as active for now

            LATEST_STATS["active"] = total_active # Using total visible as active for now

            # Update history every ~1 second (25 frames)
            if frame_count % 25 == 0:
                timestamp = time.time()
                STATS_HISTORY.append({
                    "timestamp": timestamp,
                    "engaged": engaged_count,
                    "total": total_active,
                    "front_engaged": group_counts["Front Row"]["engaged"],
                    "front_total": group_counts["Front Row"]["total"],
                    "mid_engaged": group_counts["Middle Row"]["engaged"],
                    "mid_total": group_counts["Middle Row"]["total"],
                    "back_engaged": group_counts["Back Row"]["engaged"],
                    "back_total": group_counts["Back Row"]["total"]
                })
                # History is now kept indefinitely as per user request

        # Draw on frame (every frame, using latest detections)
        # Draw on frame (every frame, using latest detections)
        if VISUALIZE_GROUPS:
            # Draw Zone Lines
            cv2.line(frame, (0, int(y_back_limit)), (w, int(y_back_limit)), (255, 255, 0), 2)
            cv2.line(frame, (0, int(y_front_limit)), (w, int(y_front_limit)), (255, 255, 0), 2)
            
            # Zone Labels
            cv2.putText(frame, "BACK ROW", (10, int(y_back_limit) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            cv2.putText(frame, "MIDDLE ROW", (10, int(y_front_limit) - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            cv2.putText(frame, "FRONT ROW", (10, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        # Draw Legend with Background
        # Background Box (Semi-transparent)
        overlay = frame.copy()
        cv2.rectangle(overlay, (w - 260, 5), (w - 10, 50), (0, 0, 0), -1) 
        frame = cv2.addWeighted(overlay, 0.6, frame, 0.4, 0)

        # Text and Indicators
        cv2.putText(frame, "Status: ", (w - 250, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2) # Cyan for label
        cv2.circle(frame, (w - 160, 25), 6, (0, 255, 0), -1)
        cv2.putText(frame, "Engaged", (w - 145, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        cv2.circle(frame, (w - 50, 25), 6, (0, 0, 255), -1)
        cv2.putText(frame, "Not Engaged", (w - 35, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        for det in last_detections:
            x1 = det["x1"]; y1 = det["y1"]
            x2 = det["x2"]; y2 = det["y2"]
            color = det["color"] # This is Green/Red based on status
            text = det["text"]

            cx = int((x1 + x2) / 2)
            cy_head = y1 + 15
            
            # Use center Y of the box to determine zone for coloring
            if VISUALIZE_GROUPS:
                box_cy = (y1 + y2) / 2.0
                if box_cy < y_back_limit:
                    color = (255, 100, 100) # Blue-ish for Back (BGR)
                elif box_cy < y_front_limit:
                    color = (0, 255, 255)   # Yellow for Middle
                else:
                    color = (255, 0, 255)   # Magenta for Front
            
            if VISUAL_STYLE == "boxes":
                # Boxes style: Rectangle only
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                
            elif VISUAL_STYLE == "detailed":
                # Detailed style: Rectangle + Text
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
            else: 
                # Default "dots" style: Just the dot
                cv2.circle(frame, (cx, cy_head), 8, color, -1)
                # Optional shadow for visibility
                cv2.circle(frame, (cx, cy_head), 8, (0,0,0), 1)

        # Show video if requested
        if show_video:
            cv2.imshow("Engagement Analysis", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        # Encode frame to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue

        # FPS Calculation
        if frame_count % 10 == 0:
            t_end = time.time()
            fps = 10 / (t_end - t_start)
            t_start = time.time()
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    # When run as script, show the video
    print("Running in standalone mode...", flush=True)
    for _ in run_inference(video_path=None, show_video=True):
        pass
