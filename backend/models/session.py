from sqlalchemy import Column, String, DateTime, Integer, Float
from database import Base

from datetime import datetime

class LectureSession(Base):
    __tablename__ = "lecture_sessions"

    session_id = Column(String, primary_key=True, index=True)
    teacher_id = Column(String, index=True)
    module_code = Column(String)
    module_name = Column(String)

    pin = Column(String(6))
    pin_expires_at = Column(DateTime)

    max_students = Column(Integer, default=999)
    remaining_slots = Column(Integer, default=999)

    created_at = Column(DateTime, default=datetime.utcnow)
