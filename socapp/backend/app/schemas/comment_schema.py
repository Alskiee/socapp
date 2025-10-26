from pydantic import BaseModel
from typing import Optional


# -----------------------------
# Create Comment Schema
# -----------------------------
class CommentCreate(BaseModel):
    content: str


# -----------------------------
# Update Comment Schema
# -----------------------------
class CommentUpdate(BaseModel):
    content: str


# -----------------------------
# Comment Response Schema
# -----------------------------
class CommentResponse(BaseModel):
    id: str
    post_id: str
    author_id: str
    content: str
    created_at: str
    updated_at: Optional[str] = None  # optional for edited comments
    user: Optional[dict] = None       # include user info when returned
