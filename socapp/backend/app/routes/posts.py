from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, Body
from app.core.database import db
from app.core.security import get_current_user
from uuid import uuid4
from datetime import datetime
from typing import Optional
import os

router = APIRouter(prefix="/posts", tags=["Posts"])

UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

# ✅ Your Render backend URL (update if yours is different)
BACKEND_URL = "https://socapp-backend.onrender.com"


@router.post("/")
async def create_post(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    # Determine payload source
    ct = request.headers.get("content-type", "").lower()
    
    if ct.startswith("application/json"):
        # Handle JSON payload (Cloudinary URL)
        try:
            json_payload = await request.json()
            content = json_payload.get("content", "")
            image_url = json_payload.get("image_url")  # Cloudinary URL
            
            # Validate content
            if not content.strip() and not image_url:
                raise HTTPException(status_code=400, detail="Content or image required")
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")
            
    else:
        # Handle FormData (legacy file upload)
        form_data = await request.form()
        content = form_data.get("content", "")
        image = form_data.get("image")
        
        image_url = None
        if image and hasattr(image, 'file'):  # It's an uploaded file
            try:
                _, ext = os.path.splitext(image.filename or "")
                if not ext:
                    ext = ".jpg"
                filename = f"{uuid4()}{ext}"
                file_path = os.path.join(UPLOADS_DIR, filename)
                with open(file_path, "wb") as f:
                    f.write(await image.read())
                image_url = f"{BACKEND_URL}/uploads/{filename}"
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")
        else:
            image_url = None

    post_id = str(uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"

    with db.get_session() as session:
        session.run(
            """
            MERGE (u:User {id: $author_id})
            ON CREATE SET u.name = $name, u.username = $username, u.avatar_url = $avatar_url
            CREATE (p:Post {
                id: $id,
                content: $content,
                image_url: $image_url,
                created_at: $created_at
            })
            MERGE (u)-[:AUTHORED]->(p)
            """,
            author_id=current_user["id"],
            name=current_user.get("name"),
            username=current_user.get("username"),
            avatar_url=current_user.get("avatar_url"),
            id=post_id,
            content=content,
            image_url=image_url,
            created_at=created_at,
        )

    return {
        "id": post_id,
        "content": content,
        "image_url": image_url,
        "created_at": created_at,
        "user": {
            "id": current_user["id"],
            "name": current_user.get("name"),
            "username": current_user.get("username"),
            "avatar_url": current_user.get("avatar_url"),
        },
    }


@router.put("/{post_id}")
async def update_post(
    post_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    # Ensure ownership
    with db.get_session() as session:
        rel = session.run(
            "MATCH (u:User {id: $uid})-[:AUTHORED]->(p:Post {id: $pid}) RETURN p",
            uid=current_user["id"], pid=post_id,
        ).single()
        if not rel:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Determine payload source
    ct = request.headers.get("content-type", "").lower()
    
    if ct.startswith("application/json"):
        # Handle JSON payload (Cloudinary URL)
        try:
            json_payload = await request.json()
            content = json_payload.get("content")
            image_url = json_payload.get("image_url")  # Cloudinary URL or null to remove
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {e}")
            
    else:
        # Handle FormData (legacy file upload)
        form_data = await request.form()
        content = form_data.get("content")
        image = form_data.get("image")
        
        image_url = None
        if image and hasattr(image, 'file'):  # It's an uploaded file
            try:
                _, ext = os.path.splitext(image.filename or "")
                if not ext:
                    ext = ".jpg"
                filename = f"{uuid4()}{ext}"
                file_path = os.path.join(UPLOADS_DIR, filename)
                with open(file_path, "wb") as f:
                    f.write(await image.read())
                image_url = f"{BACKEND_URL}/uploads/{filename}"
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")
        else:
            # If image field exists but is empty, remove the image
            image_url = None

    # Apply updates
    updates = {}
    if content is not None:
        updates["content"] = content
    if image_url is not None or 'image_url' in (await request.json() if ct.startswith("application/json") else {}):
        updates["image_url"] = image_url

    with db.get_session() as session:
        if updates:
            session.run("MATCH (p:Post {id: $id}) SET p += $updates", id=post_id, updates=updates)

        rec = session.run(
            """
            MATCH (u:User)-[:AUTHORED]->(p:Post {id: $id})
            OPTIONAL MATCH (p)<-[:LIKED]-(l:User)
            OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
            RETURN p, u,
                   count(DISTINCT l) as likes_count,
                   count(DISTINCT c) as comments_count
            """,
            id=post_id,
        ).single()

        if not rec:
            return {"id": post_id, **updates}

        p = dict(rec["p"])
        p["user"] = dict(rec["u"])
        p["likes_count"] = rec["likes_count"]
        p["comments_count"] = rec["comments_count"]
        return p


# Keep the other endpoints (get_posts, get_post, delete_post, like_post) the same as in your original code
@router.get("/")
def get_posts(user_id: Optional[str] = None):
    with db.get_session() as session:
        if user_id:
            results = session.run(
                """
                MATCH (u:User {id: $uid})-[:AUTHORED]->(p:Post)
                OPTIONAL MATCH (p)<-[:LIKED]-(l:User)
                OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
                RETURN p, u,
                       count(DISTINCT l) as likes_count,
                       count(DISTINCT c) as comments_count
                ORDER BY p.created_at DESC
                """,
                uid=user_id,
            )
        else:
            results = session.run(
                """
                MATCH (u:User)-[:AUTHORED]->(p:Post)
                OPTIONAL MATCH (p)<-[:LIKED]-(l:User)
                OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
                RETURN p, u,
                       count(DISTINCT l) as likes_count,
                       count(DISTINCT c) as comments_count
                ORDER BY p.created_at DESC
                """
            )

        posts = []
        for record in results:
            p = dict(record["p"])
            u = dict(record["u"])
            p["user"] = u
            p["likes_count"] = record["likes_count"]
            p["comments_count"] = record["comments_count"]
            posts.append(p)
        return posts


@router.get("/{post_id}")
def get_post(post_id: str):
    with db.get_session() as session:
        rec = session.run(
            """
            MATCH (u:User)-[:AUTHORED]->(p:Post {id: $id})
            OPTIONAL MATCH (p)<-[:LIKED]-(l:User)
            OPTIONAL MATCH (c:Comment)-[:ON_POST]->(p)
            RETURN p, u,
                   count(DISTINCT l) as likes_count,
                   count(DISTINCT c) as comments_count
            """,
            id=post_id,
        ).single()

        if not rec:
            raise HTTPException(status_code=404, detail="Post not found")

        p = dict(rec["p"])
        p["user"] = dict(rec["u"])
        p["likes_count"] = rec["likes_count"]
        p["comments_count"] = rec["comments_count"]
        return p


@router.delete("/{post_id}")
def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    with db.get_session() as session:
        rel = session.run(
            "MATCH (u:User {id: $uid})-[:AUTHORED]->(p:Post {id: $pid}) RETURN p",
            uid=current_user["id"], pid=post_id,
        ).single()
        if not rel:
            raise HTTPException(status_code=403, detail="Not authorized")

        session.run("MATCH (p:Post {id: $id}) DETACH DELETE p", id=post_id)

    return {"detail": "Post deleted"}


@router.post("/{post_id}/like")
def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    with db.get_session() as session:
        exists = session.run("MATCH (p:Post {id: $id}) RETURN p", id=post_id).single()
        if not exists:
            raise HTTPException(status_code=404, detail="Post not found")

        session.run(
            """
            MATCH (u:User {id: $uid}), (p:Post {id: $pid})
            MERGE (u)-[:LIKED]->(p)
            """,
            uid=current_user["id"],
            pid=post_id,
        )

        count_rec = session.run(
            "MATCH (:User)-[:LIKED]->(p:Post {id: $pid}) RETURN count(*) as likes",
            pid=post_id,
        ).single()

        return {"post_id": post_id, "likes": count_rec["likes"]}