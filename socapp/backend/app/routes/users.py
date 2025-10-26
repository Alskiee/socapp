from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File
from app.core.database import db
from app.core.security import get_current_user
from app.schemas.user_schema import UserUpdate
import os
from uuid import uuid4
from shutil import copyfileobj

router = APIRouter(prefix="/users", tags=["Users"])

UPLOADS_DIR = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

BASE_URL = "http://127.0.0.1:8000"

def _full_profile_pic(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("/uploads/"):
        return f"{BASE_URL}{value}"
    return value

def _is_admin(user: dict | None) -> bool:
    """Best-effort admin detection using `is_admin` flag or role."""
    if not user:
        return False
    if bool(user.get("is_admin")):
        return True
    role = str(user.get("role") or "").lower()
    return role in {"admin", "superadmin"}

@router.get("/")
def list_users(me: str | None = None):
    """Return a list of users with counts and is_following relative to optional me.
    profile_pic is a full URL.
    """
    with db.get_session() as session:
        results = session.run(
            """
            MATCH (u:User)
            OPTIONAL MATCH (u)<-[:FOLLOWS]-(f)
            WITH u, count(f) AS followers_count
            OPTIONAL MATCH (u)-[:FOLLOWS]->(g)
            WITH u, followers_count, count(g) AS following_count
            RETURN u, followers_count, following_count
            LIMIT 500
            """
        )
        # Pre-compute following set for 'me' if provided
        my_following: set[str] = set()
        if me:
            q = session.run(
                "MATCH (:User {id: $me})-[:FOLLOWS]->(x:User) RETURN x.id AS id",
                me=me,
            )
            my_following = {rec["id"] for rec in q}

        out = []
        for r in results:
            u = dict(r["u"])
            u.pop("password", None)
            out.append({
                "id": u.get("id"),
                "username": u.get("username"),
                "bio": u.get("bio"),
                "followers_count": r["followers_count"] or 0,
                "following_count": r["following_count"] or 0,
                "is_following": (u.get("id") in my_following) if me else False,
                # Return FULL URL per requirement
                "profile_pic": _full_profile_pic(u.get("avatar_url")),
            })
        return out


@router.delete("/{user_id}")
def delete_user_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: delete a user node and all their messages.
    Also prunes conversations that become empty after deletion.

    Returns: { "success": true, "deleted_user": user_id, "deleted_messages": X }
    """
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin privileges required")

    with db.get_session() as session:
        # Validate user exists
        rec = session.run("MATCH (u:User {id:$id}) RETURN u.id as id", id=user_id).single()
        if not rec:
            raise HTTPException(status_code=404, detail="User not found")

        # Count messages sent by user
        count_rec = session.run(
            """
            MATCH (:User {id:$uid})-[:SENT]->(m:Message)
            RETURN count(m) as cnt
            """,
            uid=user_id,
        ).single()
        deleted_messages = int(count_rec["cnt"] or 0) if count_rec else 0

        # Delete messages sent by user
        session.run(
            """
            MATCH (:User {id:$uid})-[:SENT]->(m:Message)
            DETACH DELETE m
            """,
            uid=user_id,
        )

        # Delete the user node and all its relationships
        session.run("MATCH (u:User {id:$id}) DETACH DELETE u", id=user_id)

        # Prune empty conversations
        session.run(
            """
            MATCH (c:Conversation)
            WHERE NOT (c)-[:HAS_MESSAGE]->()
            DETACH DELETE c
            """
        )

    return {"success": True, "deleted_user": user_id, "deleted_messages": deleted_messages}

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    # Fetch pinned posts and follow relationships
    with db.get_session() as session:
        pinned = session.run(
            "MATCH (u:User {id: $id})-[:PINNED]->(p:Post) RETURN p", id=current_user["id"]
        )
        pinned_posts = [dict(r["p"]) for r in pinned]

        rels = session.run(
            """
            MATCH (me:User {id: $id})
            OPTIONAL MATCH (me)-[:FOLLOWS]->(f:User)
            WITH me, collect(f.id) AS following_ids
            OPTIONAL MATCH (f2:User)-[:FOLLOWS]->(me)
            RETURN following_ids, collect(f2.id) AS followers_ids
            """,
            id=current_user["id"],
        ).single()

    user = current_user.copy()
    user["pinned_posts"] = pinned_posts
    user["following_ids"] = rels["following_ids"] or []
    user["followers_ids"] = rels["followers_ids"] or []
    # Add full URL for profile_pic
    user["profile_pic"] = _full_profile_pic(user.get("avatar_url"))
    return user

@router.put("/me")
async def update_me(
    username: str = Form(...),
    bio: str = Form(None),
    avatar: UploadFile = File(None),  # prefer 'avatar' field name
    file: UploadFile = File(None),    # also accept 'file' as alias
    current_user: dict = Depends(get_current_user),
):
    updates = {}
    if username is not None:
        updates["username"] = username
    if bio is not None:
        updates["bio"] = bio

    # Choose whichever field was provided
    upload = avatar or file
    if upload is not None:
        ext = os.path.splitext(upload.filename)[1] or ".jpg"
        filename = f"{uuid4()}{ext}"
        file_path = os.path.join(UPLOADS_DIR, filename)
        with open(file_path, "wb") as f:
            copyfileobj(upload.file, f)
        updates["avatar_url"] = f"/uploads/{filename}"

    if not updates:
        return current_user

    with db.get_session() as session:
        session.run(
            "MATCH (u:User {id: $id}) SET u += $updates RETURN u",
            id=current_user["id"],
            updates=updates,
        )
        rec = session.run("MATCH (u:User {id: $id}) RETURN u", id=current_user["id"]).single()
        if not rec:
            raise HTTPException(status_code=404, detail="User not found")
        u = dict(rec["u"])
        u.pop("password", None)
        # Return full URL for profile_pic
        u["profile_pic"] = _full_profile_pic(u.get("avatar_url"))
        return u

@router.put("/{user_id}")
async def update_user_by_id(
    user_id: str,
    username: str = Form(...),
    bio: str = Form(None),
    avatar: UploadFile = File(None),
    file: UploadFile = File(None),
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's own profile by explicit ID.
    Prevents editing other users.
    """
    if user_id != current_user.get("id"):
        raise HTTPException(status_code=403, detail="You can only update your own profile")

    # Reuse the existing update logic and pass both fields; update_me will pick whichever exists
    return await update_me(username=username, bio=bio, avatar=avatar, current_user=current_user, file=file)

@router.get("/{user_id}")
def get_user_by_id(user_id: str, me: str | None = None):
    with db.get_session() as session:
        rec = session.run("MATCH (u:User {id: $id}) RETURN u", id=user_id).single()
        if not rec:
            raise HTTPException(status_code=404, detail="User not found")
        u = dict(rec["u"])
        u.pop("password", None)

        # Counts
        counts = session.run(
            """
            MATCH (u:User {id: $id})
            OPTIONAL MATCH (u)<-[:FOLLOWS]-(f)
            WITH u, count(f) AS followers_count
            OPTIONAL MATCH (u)-[:FOLLOWS]->(g)
            RETURN followers_count, count(g) AS following_count
            """,
            id=user_id,
        ).single()
        followers_count = counts["followers_count"] or 0
        following_count = counts["following_count"] or 0

        # is_following relative to me
        following_bool = False
        if me:
            chk = session.run(
                "MATCH (:User {id: $me})-[:FOLLOWS]->(:User {id: $id}) RETURN 1 AS ok",
                me=me,
                id=user_id,
            ).single()
            following_bool = bool(chk)

        # Include pinned posts
        pinned = session.run(
            "MATCH (u:User {id: $id})-[:PINNED]->(p:Post) RETURN p", id=user_id
        )
        result = {
            "id": u.get("id"),
            "username": u.get("username"),
            "bio": u.get("bio"),
            "followers_count": followers_count,
            "following_count": following_count,
            "is_following": following_bool,
            "profile_pic": _full_profile_pic(u.get("avatar_url")),
            "pinned_posts": [dict(r["p"]) for r in pinned],
        }
        return result


@router.post("/{user_id}/follow")
def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    with db.get_session() as session:
        session.run(
            "MATCH (me:User {id: $me}), (u:User {id: $uid}) MERGE (me)-[:FOLLOWS]->(u)",
            me=current_user["id"], uid=user_id
        )
    return {"detail": "Followed"}


@router.post("/{user_id}/unfollow")
def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    with db.get_session() as session:
        session.run(
            "MATCH (me:User {id: $me})-[r:FOLLOWS]->(u:User {id: $uid}) DELETE r",
            me=current_user["id"], uid=user_id
        )
    return {"detail": "Unfollowed"}

@router.get("/{user_id}/followers")
def list_followers(user_id: str):
    with db.get_session() as session:
        recs = session.run(
            "MATCH (:User {id: $id})<-[:FOLLOWS]-(f:User) RETURN f",
            id=user_id,
        )
        out = []
        for r in recs:
            u = dict(r["f"])
            u.pop("password", None)
            out.append({
                "id": u.get("id"),
                "username": u.get("username"),
                "bio": u.get("bio"),
                "profile_pic": _full_profile_pic(u.get("avatar_url")),
            })
        return out

@router.get("/{user_id}/following")
def list_following(user_id: str):
    with db.get_session() as session:
        recs = session.run(
            "MATCH (:User {id: $id})-[:FOLLOWS]->(f:User) RETURN f",
            id=user_id,
        )
        out = []
        for r in recs:
            u = dict(r["f"])
            u.pop("password", None)
            out.append({
                "id": u.get("id"),
                "username": u.get("username"),
                "bio": u.get("bio"),
                "profile_pic": _full_profile_pic(u.get("avatar_url")),
            })
        return out


@router.get("/me/feed")
def get_my_feed(current_user: dict = Depends(get_current_user)):
    with db.get_session() as session:
        results = session.run(
            """
            MATCH (me:User {id: $me})-[:FOLLOWS]->(u:User)-[:AUTHORED]->(p:Post)
            RETURN p ORDER BY p.created_at DESC
            """,
            me=current_user["id"]
        )
        posts = [dict(r["p"]) for r in results]
        # Include pinned posts
        pinned = session.run(
            "MATCH (me:User {id: $me})-[:PINNED]->(p:Post) RETURN p", me=current_user["id"]
        )
        pinned_posts = [dict(r["p"]) for r in pinned]
        return {"posts": posts, "pinned_posts": pinned_posts}


@router.get("/search/{query}")
def search_users(query: str):
    with db.get_session() as session:
        results = session.run(
            """
            MATCH (u:User)
            WHERE toLower(u.username) CONTAINS toLower($q) OR toLower(u.email) CONTAINS toLower($q)
            RETURN u LIMIT 50
            """,
            q=query
        )
        out = []
        for r in results:
            u = dict(r["u"])
            u.pop("password", None)
            out.append(u)
        return out
