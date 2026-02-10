from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import timedelta
from typing import List
import base64
from database import get_db
from . import models, schemas, utils, dependencies

router = APIRouter(
    tags=["Authentication"]
)

@router.post("/register/student", response_model=schemas.UserResponse)
async def register_student(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    student_id: str = Form(...),
    full_name: str = Form(...),
    age: int = Form(...),
    gender: str = Form(...),
    phone_number: str = Form(...),
    major: str = Form(...),
    profile_picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Check if email or username exists
    db_user = db.query(models.User).filter(
        or_(models.User.email == email, models.User.username == username)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or Username already registered")
    
    hashed_password = utils.get_password_hash(password)
    # Create User
    new_user = models.User(
        email=email,
        username=username,
        password_hash=hashed_password,
        role=models.UserRole.STUDENT,
        is_approved=False # Requires admin approval
    )
    db.add(new_user)
    db.flush() # Flush to get the new_user.id
    
    # Process profile picture
    profile_picture_data = None
    if profile_picture:
        profile_picture_data = await profile_picture.read()

    # Create Student Profile
    new_profile = models.StudentProfile(
        user_id=new_user.id,
        student_id=student_id,
        full_name=full_name,
        age=age,
        gender=gender,
        phone_number=phone_number,
        major=major,
        profile_picture=profile_picture_data
    )
    db.add(new_profile)
    
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/register/teacher", response_model=schemas.UserResponse)
async def register_teacher(
    email: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    teacher_id: str = Form(...),
    full_name: str = Form(...),
    position: str = Form(...),
    department: str = Form(...),
    phone_number: str = Form(...),
    specialization: str = Form(...),
    years_of_experience: int = Form(...),
    profile_picture: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Check if email or username exists
    db_user = db.query(models.User).filter(
        or_(models.User.email == email, models.User.username == username)
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or Username already registered")
    
    hashed_password = utils.get_password_hash(password)
    # Create User
    new_user = models.User(
        email=email,
        username=username,
        password_hash=hashed_password,
        role=models.UserRole.TEACHER,
        is_approved=False # Requires admin approval
    )
    db.add(new_user)
    db.flush()
    
    # Process profile picture
    profile_picture_data = None
    if profile_picture:
        profile_picture_data = await profile_picture.read()

    # Create Teacher Profile
    new_profile = models.TeacherProfile(
        user_id=new_user.id,
        teacher_id=teacher_id,
        full_name=full_name,
        position=position,
        department=department,
        phone_number=phone_number,
        specialization=specialization,
        years_of_experience=years_of_experience,
        profile_picture=profile_picture_data
    )
    db.add(new_profile)
    
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users/{user_id}/profile-picture")
def get_profile_picture(user_id: int, db: Session = Depends(get_db)):
    """
    Get user's profile picture as image
    Returns the binary image data
    """
    # Check student profile
    student_profile = db.query(models.StudentProfile).filter(models.StudentProfile.user_id == user_id).first()
    if student_profile and student_profile.profile_picture:
        return Response(content=student_profile.profile_picture, media_type="image/jpeg")

    # Check teacher profile
    teacher_profile = db.query(models.TeacherProfile).filter(models.TeacherProfile.user_id == user_id).first()
    if teacher_profile and teacher_profile.profile_picture:
        return Response(content=teacher_profile.profile_picture, media_type="image/jpeg")
    
    # Return a default placeholder or 404
    raise HTTPException(status_code=404, detail="Profile picture not found")


@router.get("/users/{user_id}/profile-picture-base64")
async def get_profile_picture_base64(
    user_id: int,
    current_user: models.User = Depends(dependencies.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's profile picture as base64 encoded string for face verification
    
    Security: Only allows users to get their own profile picture OR
    allows teachers/admins to get any profile picture (for attendance verification)
    """
    # Check if user is requesting their own profile OR is a teacher/admin
    if current_user.id != user_id and current_user.role not in [models.UserRole.TEACHER, models.UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this profile picture"
        )
    
    # Get profile picture from database
    profile_picture_data = None
    
    # Check student profile
    student_profile = db.query(models.StudentProfile).filter(
        models.StudentProfile.user_id == user_id
    ).first()
    
    if student_profile and student_profile.profile_picture:
        profile_picture_data = student_profile.profile_picture
    else:
        # Check teacher profile
        teacher_profile = db.query(models.TeacherProfile).filter(
            models.TeacherProfile.user_id == user_id
        ).first()
        
        if teacher_profile and teacher_profile.profile_picture:
            profile_picture_data = teacher_profile.profile_picture
    
    if not profile_picture_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile picture found for this user"
        )
    
    try:
        # Convert binary data to base64
        image_base64 = base64.b64encode(profile_picture_data).decode('utf-8')
        
        # Return as data URI for easy use in frontend
        return {
            "user_id": user_id,
            "profile_picture_base64": f"data:image/jpeg;base64,{image_base64}"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to encode profile picture: {str(e)}"
        )


@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm expects username field, but we might want to use email login.
    # We'll check if the username is an email or username in the DB.
    # For simplicity, assuming username field contains the username as defined in our model.
    
    # Support login with either username or email
    user = db.query(models.User).filter(
        or_(
            models.User.username == form_data.username,
            models.User.email == form_data.username
        )
    ).first()
    
    if not user or not utils.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending approval. Please contact the administrator.",
        )
    
    access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = utils.create_access_token(
        data={"sub": user.username, "role": user.role.value}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/admin/pending-users", response_model=List[schemas.UserResponse])
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.require_role(models.UserRole.ADMIN))
):
    users = db.query(models.User).filter(models.User.is_approved == False).all()
    return users

@router.post("/admin/approve/{user_id}", response_model=schemas.UserResponse)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(dependencies.require_role(models.UserRole.ADMIN))
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = True
    db.commit()
    db.refresh(user)
    return user

@router.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(dependencies.get_current_user)):
    return current_user