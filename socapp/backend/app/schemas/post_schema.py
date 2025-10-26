from pydantic import BaseModel
from typing import Optional

class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None

class PostResponse(BaseModel):
    id: str
    author_id: str
    content: str
    image_url: Optional[str]
    created_at: str
