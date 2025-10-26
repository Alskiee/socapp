from fastapi import APIRouter, Depends, HTTPException
from uuid import uuid4
from datetime import datetime
from app.core.database import db
from app.core.security import get_current_user
from app.schemas.comment_schema import CommentCreate, CommentUpdate

# ✅ Only one prefix — no need to repeat "/posts" later
router = APIRouter(prefix="/posts", tags=["Comments"])

# -----------------------------
# CREATE COMMENT
# -----------------------------
@router.post("/{post_id}/comments")
def create_comment(
    post_id: str,
    payload: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    comment_id = str(uuid4())
    created_at = datetime.utcnow().isoformat() + "Z"

    with db.get_session() as session:
        # Check if post exists first
        exists = session.run("MATCH (p:Post {id: $id}) RETURN p", id=post_id).single()
        if not exists:
            raise HTTPException(status_code=404, detail="Post not found")

        # ✅ FIXED QUERY: Added WITH between MERGE and MATCH
        session.run(
            """
            MERGE (u:User {id: $uid})
            WITH u
            MATCH (p:Post {id: $pid})
            CREATE (c:Comment {
                id: $id,
                content: $content,
                created_at: $created_at
            })
            MERGE (u)-[:AUTHORED]->(c)
            MERGE (c)-[:ON_POST]->(p)
            """,
            uid=current_user["id"],
            pid=post_id,
            id=comment_id,
            content=payload.content,
            created_at=created_at,
        )

        user_data = current_user.copy()
        user_data.pop("password", None)

    return {
        "id": comment_id,
        "post_id": post_id,
        "author_id": current_user["id"],
        "content": payload.content,
        "created_at": created_at,
        "user": user_data,
    }

# -----------------------------
# GET COMMENTS FOR A POST
# -----------------------------
@router.get("/{post_id}/comments")
def get_comments_for_post(post_id: str):
    with db.get_session() as session:
        results = session.run(
            """
            MATCH (u:User)-[:AUTHORED]->(c:Comment)-[:ON_POST]->(p:Post {id: $pid})
            RETURN c, u
            ORDER BY c.created_at ASC
            """,
            pid=post_id,
        )

        comments = []
        for record in results:
            comment = dict(record["c"])
            user = dict(record["u"])
            user.pop("password", None)
            comment["user"] = user
            comments.append(comment)

    return comments


# -----------------------------
# UPDATE COMMENT
# -----------------------------
@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: str,
    payload: CommentUpdate,
    current_user: dict = Depends(get_current_user)
):
    updated_at = datetime.utcnow().isoformat() + "Z"

    with db.get_session() as session:
        record = session.run(
            """
            MATCH (u:User {id: $uid})-[:AUTHORED]->(c:Comment {id: $cid})
            RETURN c
            """,
            uid=current_user["id"],
            cid=comment_id,
        ).single()

        if not record:
            raise HTTPException(status_code=403, detail="You can only edit your own comments.")

        session.run(
            """
            MATCH (c:Comment {id: $cid})
            SET c.content = $content,
                c.updated_at = $updated_at
            """,
            cid=comment_id,
            content=payload.content,
            updated_at=updated_at,
        )

    return {"message": "Comment updated successfully", "updated_at": updated_at}


# -----------------------------
# DELETE COMMENT
# -----------------------------
@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    with db.get_session() as session:
        record = session.run(
            """
            MATCH (u:User {id: $uid})-[:AUTHORED]->(c:Comment {id: $cid})
            RETURN c
            """,
            uid=current_user["id"],
            cid=comment_id,
        ).single()

        if not record:
            raise HTTPException(status_code=403, detail="You can only delete your own comments.")

        session.run(
            """
            MATCH (c:Comment {id: $cid})
            DETACH DELETE c
            """,
            cid=comment_id,
        )

    return {"message": "Comment deleted successfully"}

