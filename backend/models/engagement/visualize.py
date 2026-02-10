import cv2
import numpy as np
import os
import sys

# Ensure we can import the local module
# Add the project root to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
sys.path.append(project_root)

from backend.modules.engagement.run_inference import run_inference

def visualize():
    print("Starting visualization...")
    print("Press 'q' to quit.")
    
    # Get the generator
    # We need to provide the absolute path to the video if we are running from root
    # But run_inference defaults to the sample video if None.
    gen = run_inference()
    
    if gen is None:
        print("Failed to initialize inference.")
        return

    for item in gen:
        # Item is bytes: b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
        # We need to extract the jpeg bytes.
        # Find the double newline which separates header from body
        try:
            header_end = item.find(b'\r\n\r\n')
            if header_end == -1:
                continue
            
            # The body starts after \r\n\r\n (4 bytes)
            jpg_start = header_end + 4
            # The footer is \r\n (2 bytes) at the end
            jpg_end = len(item) - 2
            
            jpg_bytes = item[jpg_start:jpg_end]
            
            # Decode
            frame = cv2.imdecode(np.frombuffer(jpg_bytes, np.uint8), cv2.IMREAD_COLOR)
            
            if frame is not None:
                cv2.imshow("Engagement Detection", frame)
                
                # Wait 1 ms
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
        except Exception as e:
            print(f"Error viewing frame: {e}")
            break

    cv2.destroyAllWindows()
    print("Visualization finished.")

if __name__ == "__main__":
    visualize()
