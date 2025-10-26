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
    created_at: datetime = datetime.utcnow()
