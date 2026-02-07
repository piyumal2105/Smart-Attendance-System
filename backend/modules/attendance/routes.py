from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from modules.attendance.store import store

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ----------- WebSocket Manager -----------
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: str):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                await connection.send_text(message)

manager = ConnectionManager()

# ----------- WebSocket Endpoint -----------
@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)


# ----------- Request/Response Models -----------
class CreateSessionReq(BaseModel):
    module_code: str
    module_name: str
    year: str
    faculty: str
    batch: str
    start_time: str
    end_time: str
    hours: float
    location: str
    max_students: int = Field(ge=1, le=1000)

    expiry_minutes: int = Field(default=10, ge=1, le=120)
    regen_limit: int = Field(default=3, ge=0, le=50)


class SessionRes(BaseModel):
    session_id: str
    module_code: str
    module_name: str
    year: str
    faculty: str
    batch: str
    start_time: str
    end_time: str
    hours: float
    location: str

    pin: str
    pin_expires_at: str
    max_students: int
    remaining_slots: int
    regen_left: int


class AttendanceItem(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    selfie_base64: Optional[str] = None
    marked_at: str


class SessionDetailRes(SessionRes):
    attendance_count: int
    attendance: List[AttendanceItem]


class RegeneratePinReq(BaseModel):
    expiry_minutes: int = Field(default=10, ge=1, le=120)


class CheckInReq(BaseModel):
    pin: str = Field(min_length=6, max_length=6)
    student_id: str
    student_name: Optional[str] = None
    selfie_base64: Optional[str] = None  # optional


# ----------- Helpers -----------

def _session_to_res(sess) -> SessionRes:
    return SessionRes(
        session_id=sess.session_id,
        module_code=sess.module_code,
        module_name=sess.module_name,
        year=sess.year,
        faculty=sess.faculty,
        batch=sess.batch,
        start_time=sess.start_time,
        end_time=sess.end_time,
        hours=sess.hours,
        location=sess.location,
        pin=sess.pin,
        pin_expires_at=sess.pin_expires_at.isoformat(),
        max_students=sess.max_students,
        remaining_slots=sess.remaining_slots,
        regen_left=sess.regen_left,
    )


def _session_to_detail_res(sess) -> SessionDetailRes:
    attendance_list = [
        AttendanceItem(
            student_id=a.student_id,
            student_name=a.student_name,
            selfie_base64=a.selfie_base64,
            marked_at=a.marked_at.isoformat(),
        )
        for a in sess.attendance.values()
    ]
    base = _session_to_res(sess)
    return SessionDetailRes(
        **base.model_dump(),
        attendance_count=len(attendance_list),
        attendance=attendance_list,
    )


# ----------- Endpoints -----------

@router.post("/sessions", response_model=SessionRes)
def create_session(payload: CreateSessionReq):
    sess = store.create_session(
        module_code=payload.module_code,
        module_name=payload.module_name,
        year=payload.year,
        faculty=payload.faculty,
        batch=payload.batch,
        start_time=payload.start_time,
        end_time=payload.end_time,
        hours=payload.hours,
        location=payload.location,
        max_students=payload.max_students,
        expiry_minutes=payload.expiry_minutes,
        regen_limit=payload.regen_limit,
    )
    return _session_to_res(sess)


@router.post("/sessions/{session_id}/regenerate-pin", response_model=SessionRes)
def regenerate_pin(session_id: str, payload: RegeneratePinReq):
    try:
        sess = store.regenerate_pin(session_id, expiry_minutes=payload.expiry_minutes)
        return _session_to_res(sess)
    except ValueError as e:
        code = str(e)
        if code == "SESSION_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Session not found")
        if code == "REGEN_LIMIT_REACHED":
            raise HTTPException(status_code=400, detail="PIN regeneration limit reached")
        raise HTTPException(status_code=400, detail="Failed to regenerate PIN")


@router.get("/sessions/{session_id}", response_model=SessionDetailRes)
def get_session(session_id: str):
    sess = store.get_session(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")

    return _session_to_detail_res(sess)


@router.post("/checkin", response_model=SessionDetailRes)
async def check_in(payload: CheckInReq):
    try:
        sess = store.check_in(
            pin=payload.pin,
            student_id=payload.student_id,
            student_name=payload.student_name,
            selfie_base64=payload.selfie_base64,
        )
        print(f"[CHECKIN] Student {payload.student_id} marked in session {sess.session_id}")
        print(f"[CHECKIN] Current attendance count: {len(sess.attendance)}")

        # Broadcast update to connected WebSockets (real-time notification)
        await manager.broadcast(sess.session_id, "update")

        return _session_to_detail_res(sess)
    except ValueError as e:
        code = str(e)
        if code == "INVALID_PIN":
            raise HTTPException(status_code=400, detail="Invalid PIN")
        if code == "PIN_EXPIRED":
            raise HTTPException(status_code=400, detail="PIN expired")
        if code == "SESSION_FULL":
            raise HTTPException(status_code=400, detail="No remaining slots")
        raise HTTPException(status_code=400, detail="Check-in failed")


@router.get("/student/{student_id}/summary")
def get_student_summary(student_id: str, module_code: str | None = None):
    return store.student_summary(student_id=student_id, module_code=module_code)