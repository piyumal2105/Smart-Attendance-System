from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from .models import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.STUDENT

class UserCreate(UserBase):
    password: str

class StudentRegistration(UserCreate):
    student_id: str
    full_name: str
    age: int
    gender: str
    phone_number: str
    major: str

class TeacherRegistration(UserCreate):
    teacher_id: str
    full_name: str
    position: str
    department: str
    phone_number: str
    specialization: str
    years_of_experience: int

class StudentProfileResponse(BaseModel):
    student_id: str
    full_name: str
    age: int
    gender: str
    phone_number: str
    major: str
    # We don't send large binary here, we assume client fetches via URL
    
    class Config:
        orm_mode = True

class TeacherProfileResponse(BaseModel):
    teacher_id: str
    full_name: str
    position: str
    department: str
    phone_number: str
    specialization: str
    years_of_experience: int

    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_approved: bool
    student_profile: Optional[StudentProfileResponse] = None
    teacher_profile: Optional[TeacherProfileResponse] = None
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
