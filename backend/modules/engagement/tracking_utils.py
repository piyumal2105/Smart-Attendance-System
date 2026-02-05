import numpy as np

def compute_iou(box1, box2):
    """
    Compute Intersection over Union (IoU) of two bounding boxes.
    Boxes are [x1, y1, x2, y2].
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    if inter_area == 0:
        return 0.0

    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])

    iou = inter_area / float(box1_area + box2_area - inter_area)
    return iou

def non_max_suppression_fast(boxes, ids, overlapThresh=0.3):
    """
    Standard NMS.
    boxes: list or np.array of [x1, y1, x2, y2]
    ids: list or np.array of detection IDs
    """
    if len(boxes) == 0:
        return [], []

    boxes = np.array(boxes)
    ids = np.array(ids)
    
    if boxes.dtype.kind == "i":
        boxes = boxes.astype("float")

    pick = []

    x1 = boxes[:,0]
    y1 = boxes[:,1]
    x2 = boxes[:,2]
    y2 = boxes[:,3]

    area = (x2 - x1 + 1) * (y2 - y1 + 1)
    idxs = np.argsort(y2) # Sort by bottom coordinate (approx depth/position?) or just score?
    # Since we don't have scores here (tracker output), let's just process.
    # Actually, usually we sort by score. Here we only have tracking IDs.
    # Let's assume larger boxes are better? Or just greedy.
    
    # Better heuristic: If two boxes overlap significantly, keep the one that is "older" (smaller ID)?
    # Or just keep the larger one.
    idxs = np.argsort(area) 

    while len(idxs) > 0:
        last = len(idxs) - 1
        i = idxs[last]
        pick.append(i)

        xx1 = np.maximum(x1[i], x1[idxs[:last]])
        yy1 = np.maximum(y1[i], y1[idxs[:last]])
        xx2 = np.minimum(x2[i], x2[idxs[:last]])
        yy2 = np.minimum(y2[i], y2[idxs[:last]])

        w = np.maximum(0, xx2 - xx1 + 1)
        h = np.maximum(0, yy2 - yy1 + 1)

        overlap = (w * h) / area[idxs[:last]]

        idxs = np.delete(idxs, np.concatenate(([last],
            np.where(overlap > overlapThresh)[0])))

    return boxes[pick].astype("int"), ids[pick]
