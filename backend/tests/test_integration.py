import os
import sys
import types
import numpy as np

# Ensure backend path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Provide minimal stubs for heavy deps if not available (cv2, mediapipe)
try:
    import cv2  # pragma: no cover
except Exception:
    import types
    cv2_mod = types.ModuleType('cv2')
    cv2_mod.FONT_HERSHEY_SIMPLEX = 0
    cv2_mod.COLOR_BGR2RGB = 0
    cv2_mod.imencode = lambda *args, **kwargs: (True, np.array([0], dtype=np.uint8))
    cv2_mod.cvtColor = lambda img, code: img
    cv2_mod.destroyAllWindows = lambda: None
    cv2_mod.putText = lambda *args, **kwargs: None
    class _DummyCapture:
        def __init__(self, *a, **k):
            pass
        def read(self):
            return False, None
        def release(self):
            pass
    cv2_mod.VideoCapture = lambda *args, **kwargs: _DummyCapture()
    import sys as _sys
    _sys.modules['cv2'] = cv2_mod

try:
    import mediapipe as mp  # pragma: no cover
except Exception:
    import types
    mediapipe_mod = types.ModuleType('mediapipe')
    solutions = types.SimpleNamespace()
    class DummyPose:
        def __init__(self, *args, **kwargs):
            pass
        def process(self, image):
            class R: pass
            r = R()
            r.pose_landmarks = None
            return r
        def close(self):
            pass
    pose_ns = types.SimpleNamespace(Pose=DummyPose)
    solutions.pose = pose_ns
    solutions.drawing_utils = types.SimpleNamespace(draw_landmarks=lambda *args, **kwargs: None)
    mediapipe_mod.solutions = solutions
    import sys as _sys
    _sys.modules['mediapipe'] = mediapipe_mod

from modules.teacher_behavior import inference


def make_dummy_capture(n_frames=35, shape=(480, 640, 3)):
    class DummyCapture:
        def __init__(self):
            self.n = n_frames
            self.i = 0
            self.opened = True
        def isOpened(self):
            return True
        def read(self):
            if self.i < self.n:
                self.i += 1
                frame = np.zeros(shape, dtype=np.uint8)
                return True, frame
            return False, None
        def release(self):
            self.opened = False
    return DummyCapture


def test_run_teacher_inference_generates_frames_and_stats(monkeypatch):
    # Monkeypatch VideoCapture and cv2 utilities to avoid heavy deps
    DummyCap = make_dummy_capture(n_frames=35)
    monkeypatch.setattr(inference.cv2, 'VideoCapture', lambda *args, **kwargs: DummyCap())
    monkeypatch.setattr(inference.cv2, 'cvtColor', lambda img, code: img)
    monkeypatch.setattr(inference.cv2, 'imencode', lambda ext, frame: (True, np.array([0], dtype=np.uint8)))
    monkeypatch.setattr(inference.cv2, 'putText', lambda *args, **kwargs: None)

    # Ensure drawing utils exist on mp.solutions to avoid errors
    mp = inference.mp
    if not hasattr(mp.solutions, 'drawing_utils'):
        mp.solutions.drawing_utils = types.SimpleNamespace(draw_landmarks=lambda *args, **kwargs: None)
    else:
        monkeypatch.setattr(mp.solutions.drawing_utils, 'draw_landmarks', lambda *args, **kwargs: None)

    # Run the generator and collect yields
    gen = inference.run_teacher_inference(camera_index=0)
    frames = []
    for chunk in gen:
        # Each yielded chunk should be bytes-like
        assert isinstance(chunk, (bytes, bytearray))
        frames.append(chunk)

    # We expect 35 frames to be yielded (one per dummy frame)
    assert len(frames) == 35
    # Each frame boundary should begin with the multipart boundary
    assert frames[0].startswith(b'--frame')

    # current_stats should be accessible and contain required keys
    stats = inference.get_latest_stats()
    assert isinstance(stats, dict)
    for k in ('behavior', 'mobility', 'orientation'):
        assert k in stats
