import os
import sys
import tempfile
import csv
import numpy as np
# Ensure backend folder is on sys.path so we can import the local `modules` package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Provide minimal stubs for heavy deps if not available (cv2, mediapipe)
try:
    import cv2  # pragma: no cover
except Exception:
    import types
    cv2_mod = types.ModuleType('cv2')
    cv2_mod.FONT_HERSHEY_SIMPLEX = 0
    cv2_mod.imencode = lambda *args, **kwargs: (True, np.array([0], dtype=np.uint8))
    cv2_mod.cvtColor = lambda img, code: img
    cv2_mod.destroyAllWindows = lambda: None
    cv2_mod.putText = lambda *args, **kwargs: None
    cv2_mod.VideoCapture = lambda *args, **kwargs: type('V', (), {'read': lambda self: (False, None), 'release': lambda self: None})()
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
    mediapipe_mod.solutions = solutions
    import sys as _sys
    _sys.modules['mediapipe'] = mediapipe_mod

from modules.teacher_behavior import inference


def make_joint(x, y, z):
    return (float(x), float(y), float(z))


def make_frame(ls, rs, lh, rh, lw=None, rw=None, le=None, re=None):
    joints = [(0.0, 0.0, 0.0)] * 25
    joints[4] = ls
    joints[8] = rs
    joints[12] = lh
    joints[16] = rh
    # optional wrists/elbows
    if lw is not None:
        joints[6] = lw
    if rw is not None:
        joints[10] = rw
    if le is not None:
        joints[13] = le
    if re is not None:
        joints[14] = re
    return {"joints": joints}


def test_get_ref_from_frames_torso_length():
    # Shoulder at y=3, hip at y=0, torso length should be 3
    ls = make_joint(0, 3, 0)
    rs = make_joint(2, 3, 0)
    lh = make_joint(0, 0, 0)
    rh = make_joint(2, 0, 0)

    frames = [make_frame(ls, rs, lh, rh)]
    hip_center, torso_len = inference.get_ref_from_frames(frames)

    assert hip_center == ((lh[0] + rh[0]) / 2.0, (lh[1] + rh[1]) / 2.0, (lh[2] + rh[2]) / 2.0)
    assert abs(torso_len - 3.0) < 1e-6


def test_seq_features_from_frames_shape():
    # Create 5 frames with slight motion
    frames = []
    for i in range(5):
        ls = make_joint(0, 3, 0)
        rs = make_joint(2, 3, 0)
        lh = make_joint(0, 0, 0)
        rh = make_joint(2, 0, 0)
        # hands move in x slightly
        lw = make_joint(0.1 * i, 1.5 + 0.01 * i, 0)
        rw = make_joint(1.9 - 0.1 * i, 1.5 - 0.01 * i, 0)
        frames.append(make_frame(ls, rs, lh, rh, lw=lw, rw=rw))

    hip_ref, torso_ref = inference.get_ref_from_frames(frames)
    feats = inference.seq_features_from_frames(frames, hip_ref, torso_ref)
    assert isinstance(feats, np.ndarray)
    assert feats.shape == (9,)


def test_write_report_row_appends(tmp_path, monkeypatch):
    # Redirect REPORT_CSV to a temp file
    tmpfile = tmp_path / "test_report.csv"
    monkeypatch.setattr(inference, "REPORT_CSV", str(tmpfile))

    # Ensure header created
    if os.path.exists(str(tmpfile)):
        os.remove(str(tmpfile))
    # Call write function
    inference._write_report_row("PASSIVE", 0.12, 0.34)

    # Read file and verify a header + one row
    with open(str(tmpfile), newline='') as fh:
        reader = list(csv.reader(fh))
    assert len(reader) == 2
    assert reader[0] == ["timestamp", "behavior", "mobility", "orientation"]
    # Second row: timestamp, behavior, mobility, orientation
    assert reader[1][1] == "PASSIVE"
    assert abs(float(reader[1][2]) - 0.12) < 1e-6
    assert abs(float(reader[1][3]) - 0.34) < 1e-6
