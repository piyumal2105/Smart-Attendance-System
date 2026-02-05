from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import secrets
import threading


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _gen_pin() -> str:
    # 6-digit PIN
    return f"{secrets.randbelow(1_000_000):06d}"


@dataclass
class AttendanceEntry:
    student_id: str
    student_name: Optional[str] = None
    selfie_base64: Optional[str] = None  # optional
    marked_at: datetime = field(default_factory=_now_utc)


@dataclass
class LectureSession:
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
    pin_expires_at: datetime
    max_students: int
    remaining_slots: int

    regen_limit: int = 3
    regen_left: int = 3

    created_at: datetime = field(default_factory=_now_utc)
    attendance: Dict[str, AttendanceEntry] = field(default_factory=dict)  # key = student_id


class InMemoryAttendanceStore:
    """
    In-memory store for demo/dev.
    Swap this later with PostgreSQL (SQLAlchemy) without changing your routes logic.
    """
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: Dict[str, LectureSession] = {}

    def create_session(
        self,
        module_code: str,
        module_name: str,
        year: str,
        faculty: str,
        batch: str,
        start_time: str,
        end_time: str,
        hours: float,
        location: str,
        max_students: int,
        expiry_minutes: int = 10,
        regen_limit: int = 3,
    ) -> LectureSession:
        with self._lock:
            session_id = secrets.token_hex(8)
            pin = _gen_pin()
            expires = _now_utc() + timedelta(minutes=expiry_minutes)

            sess = LectureSession(
                session_id=session_id,
                module_code=module_code,
                module_name=module_name,
                year=year,
                faculty=faculty,
                batch=batch,
                start_time=start_time,
                end_time=end_time,
                hours=hours,
                location=location,
                pin=pin,
                pin_expires_at=expires,
                max_students=max_students,
                remaining_slots=max_students,
                regen_limit=regen_limit,
                regen_left=regen_limit,
            )
            self._sessions[session_id] = sess
            return sess

    def get_session(self, session_id: str) -> Optional[LectureSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def regenerate_pin(self, session_id: str, expiry_minutes: int = 10) -> LectureSession:
        with self._lock:
            sess = self._sessions.get(session_id)
            if not sess:
                raise ValueError("SESSION_NOT_FOUND")

            if sess.regen_left <= 0:
                raise ValueError("REGEN_LIMIT_REACHED")

            sess.pin = _gen_pin()
            sess.pin_expires_at = _now_utc() + timedelta(minutes=expiry_minutes)
            sess.regen_left -= 1
            return sess

    def check_in(
        self,
        pin: str,
        student_id: str,
        student_name: Optional[str] = None,
        selfie_base64: Optional[str] = None,
    ) -> LectureSession:
        with self._lock:
            # Find the active session by PIN
            sess = next((s for s in self._sessions.values() if s.pin == pin), None)
            if not sess:
                raise ValueError("INVALID_PIN")

            if _now_utc() > sess.pin_expires_at:
                raise ValueError("PIN_EXPIRED")

            # If already marked, don't decrease slots again
            if student_id in sess.attendance:
                return sess

            if sess.remaining_slots <= 0:
                raise ValueError("SESSION_FULL")

            sess.attendance[student_id] = AttendanceEntry(
                student_id=student_id,
                student_name=student_name,
                selfie_base64=selfie_base64,
            )
            sess.remaining_slots -= 1
            return sess

    def student_summary(self, student_id: str, module_code: Optional[str] = None) -> dict:
        """
        Very simple summary from in-memory data (for UI).
        Later you can compute semester % from DB.
        """
        with self._lock:
            sessions = list(self._sessions.values())

        filtered = []
        for s in sessions:
            if module_code and s.module_code != module_code:
                continue
            present = student_id in s.attendance
            filtered.append({
                "session_id": s.session_id,
                "module_code": s.module_code,
                "module_name": s.module_name,
                "date": s.created_at.isoformat(),
                "present": present,
            })

        total = len(filtered)
        present_count = sum(1 for x in filtered if x["present"])
        percentage = (present_count / total * 100.0) if total else 0.0

        return {
            "student_id": student_id,
            "module_code": module_code,
            "total_sessions": total,
            "present_sessions": present_count,
            "attendance_percentage": round(percentage, 2),
            "records": filtered,
        }


store = InMemoryAttendanceStore()
