from pydantic import BaseModel, EmailStr 
from typing import Optional

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str  # keep as-is

class UserLogin(BaseModel):
    email: EmailStr
    password: str  # keep as-is

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    bio: str
    profile_pic: str

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    bio: Optional[str] = None
    profile_pic: Optional[str] = None
