import sys
import os

# Add the module path to sys.path so imports work
current_dir = os.path.dirname(os.path.abspath(__file__))
# Removed sys.path hack to rely on proper package execution
from backend.modules.engagement.run_inference import run_inference

# Mock the current directory to be where run_inference is, so it finds models
os.chdir(current_dir)

print("Starting inference test...")
try:
    # Run for 150 frames (approx 6 seconds) to trigger the feature extraction logic (every 5 heavy frames = 10 frames? No, stride 2 * 5 = 10 frames... wait. 
    # Logic: frame_count % (FRAME_STRIDE * 5) == 0. Stride=2 => every 10 frames.
    # History maxlen=75 (3 secs). Need > 10 frames history.
    # So need at least 10 * 2 = 20 frames minimum for one prediction.
    # Run for 50 frames.
    
    gen = run_inference()
    for i, _ in enumerate(gen):
        if i % 10 == 0:
            print(f"Processed frame {i}")
        if i > 50:
            break
    print("Inference ran successfully without crashing.")
except Exception as e:
    print(f"Runtime Error: {e}")
    import traceback
    traceback.print_exc()
