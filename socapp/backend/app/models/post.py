from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class Post(BaseModel):
    id: Optional[str]
    author_id: str
    content: str
    image_url: Optional[str] = None
    created_at: datetime = datetime.utcnow()
