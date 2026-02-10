from sqlalchemy import Column, String, DateTime, ForeignKey
from database import Base

from datetime import datetime

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("lecture_sessions.session_id"))
    student_id = Column(String)
    student_name = Column(String, nullable=True)
    marked_at = Column(DateTime, default=datetime.utcnow)
