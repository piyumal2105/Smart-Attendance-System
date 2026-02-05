import cv2
import numpy as np
import os
import sys
from ultralytics import YOLO
from collections import deque, defaultdict

# Ensure imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

try:
    from pose_utils import get_basic_pose_keypoints, draw_pose_keypoints
except ImportError:
    print("Import failed. Ensure pose_utils.py is present.")
    sys.exit(1)

def generate_annotation_video():
    video_path = os.path.join(current_dir, "data", "sample_classroom.mp4")
    output_path = os.path.join(current_dir, "data", "annotation_helper.mp4")
    
    print(f"Processing: {video_path}")
    print(f"Output will be saved to: {output_path}")

    # Load YOLO
    yolo_path = os.path.join(current_dir, "yolov8n.pt")
    if not os.path.exists(yolo_path):
        yolo_path = os.path.join(current_dir, "yolov8s.pt")
    model = YOLO(yolo_path)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error opening video.")
        return

    # Video Writer Setup
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # We resize for processing but can keep original size or resize output. 
    # Let's resize output to 1280 width for consistency with inference/CSV generation logic
    target_w = 1280
    scale = target_w / width
    target_h = int(height * scale)
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (target_w, target_h))

    frame_count = 0
    
    # Pose cache to avoid re-running every frame (expensive)
    pose_cache = {}
    SKIP_POSE_FRAMES = 15

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            if frame_count % 50 == 0:
                print(f"Processing frame {frame_count}...")
            
            # Limit to match the dataset sample size if needed, but let's do the whole chunk used
            if frame_count > 1000:
                break

            # Resize
            frame = cv2.resize(frame, (target_w, target_h))
            
            # Run Tracking
            # We want to use the same logic as generate_dataset to try and keep IDs consistent
            results = model.track(frame, classes=[0], verbose=False, persist=True)
            frame_boxes = results[0].boxes

            if frame_boxes.id is not None:
                ids = frame_boxes.id.cpu().numpy().astype(int)
                boxes = frame_boxes.xyxy.cpu().numpy()
                
                # Apply NMS
                try:
                    from .tracking_utils import non_max_suppression_fast
                except ImportError:
                    from tracking_utils import non_max_suppression_fast
                
                boxes, ids = non_max_suppression_fast(boxes, ids, overlapThresh=0.3)

                for (x1, y1, x2, y2), tid in zip(boxes, ids):
                    x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                    
                    # 1. Draw Bounding Box & ID
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 2)
                    label = f"ID: {tid}"
                    cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

                    # 2. Draw Pose
                    person_crop = frame[y1:y2, x1:x2]
                    if person_crop.size == 0:
                        continue
                    
                    pose_kpts = None
                    # Update pose periodically
                    if frame_count % SKIP_POSE_FRAMES == 0:
                        try:
                            small_crop = cv2.resize(person_crop, None, fx=0.5, fy=0.5)
                            pose_kpts = get_basic_pose_keypoints(small_crop)
                            pose_cache[tid] = pose_kpts
                        except:
                            pose_kpts = pose_cache.get(tid)
                    else:
                        pose_kpts = pose_cache.get(tid)
                    
                    if pose_kpts:
                        # Scale keypoints from 0.5x crop back to 1.0x crop
                        # And pass offset (x1, y1) to draw on main frame
                        
                        # Create a scaled dict for drawing
                        scaled_kpts = {}
                        for k, v in pose_kpts.items():
                            scaled_kpts[k] = (v[0] * 2, v[1] * 2)
                            
                        draw_pose_keypoints(frame, scaled_kpts, offset=(x1, y1))
                        
                        
            # 3. Draw Frame Number globally
            cv2.putText(frame, f"Frame: {frame_count}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 3)

            out.write(frame)

    except KeyboardInterrupt:
        print("Interrupted...")
    finally:
        cap.release()
        out.release()
        print("Done.")

if __name__ == "__main__":
    generate_annotation_video()
