from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class User(BaseModel):
    id: Optional[str]
    username: str
    email: str
    password: str
    bio: Optional[str] = ""
    profile_pic: Optional[str] = ""
    email_verified: bool = False
    verification_token: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime = datetime.utcnow()