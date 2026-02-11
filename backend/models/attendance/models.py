from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    module_code = Column(String)
    module_name = Column(String)
    year = Column(String)
    faculty = Column(String)
    batch = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    hours = Column(Integer)
    location = Column(String)
    pin = Column(String)
    pin_expires_at = Column(DateTime)
    max_students = Column(Integer)
    remaining_slots = Column(Integer)
    regen_left = Column(Integer)
    teacher_id = Column(Integer, ForeignKey("users.id"))  # ADDED THIS
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    teacher = relationship("User", foreign_keys=[teacher_id])
    attendance_records = relationship("AttendanceRecord", back_populates="session")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("attendance_sessions.session_id"))
    student_id = Column(String)
    marked_at = Column(DateTime, default=datetime.utcnow)
    selfie_base64 = Column(String)
    verified = Column(Boolean, default=False)
    
    # Relationships
    session = relationship("AttendanceSession", back_populates="attendance_records")