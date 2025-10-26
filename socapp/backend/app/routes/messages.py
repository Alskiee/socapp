from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone
import os
import uuid

from neo4j import GraphDatabase, basic_auth
from neo4j.exceptions import SessionExpired, ServiceUnavailable, Neo4jError

from app.core.security import get_current_user

router = APIRouter(prefix="/messages", tags=["Messages"])

# ================== Neo4j Aura config (lazy init) ==================
try:
    # Prefer central settings if available
    from app.core.config import settings as _settings  # type: ignore
except Exception:
    _settings = None

NEO4J_URI = os.getenv("NEO4J_URI") or (getattr(_settings, "NEO4J_URI", None) if _settings else None)
# Accept both NEO4J_USER and NEO4J_USERNAME for compatibility with Render env naming
NEO4J_USER = (
    os.getenv("NEO4J_USER")
    or os.getenv("NEO4J_USERNAME")
    or (getattr(_settings, "NEO4J_USER", None) if _settings else None)
    or (getattr(_settings, "NEO4J_USERNAME", None) if _settings else None)
)
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD") or (getattr(_settings, "NEO4J_PASSWORD", None) if _settings else None)
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE") or (getattr(_settings, "NEO4J_DATABASE", "neo4j") if _settings else "neo4j")

_driver = None
_constraints_ready = False

def _get_driver():
    global _driver
    if _driver is None:
        if not (NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD):
            raise HTTPException(status_code=500, detail="Neo4j configuration missing: set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD")
        try:
            _driver = GraphDatabase.driver(NEO4J_URI, auth=basic_auth(NEO4J_USER, NEO4J_PASSWORD))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to connect to Neo4j: {e}")
    return _driver


def run_query(cypher: str, **params):
    """Execute a Cypher query and return a MATERIALIZED list of records.
    Avoids using Result outside session to prevent 'result has been consumed'."""
    global _driver
    attempts = 0
    last_err: Exception | None = None
    while attempts < 3:
        attempts += 1
        try:
            drv = _get_driver()
            with drv.session(database=NEO4J_DATABASE) as session:
                result = session.run(cypher, **params)
                return list(result)
        except (SessionExpired, ServiceUnavailable, OSError) as e:
            _driver = None
            last_err = e
            continue
        except Neo4jError as e:
            raise HTTPException(status_code=500, detail=f"Neo4j error: {e.message}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {e}")
    raise HTTPException(status_code=500, detail=f"Database connection error: {last_err}")


def run_single(cypher: str, **params):
    """Execute a Cypher query and return a SINGLE record, consumed within the session."""
    global _driver
    attempts = 0
    last_err: Exception | None = None
    while attempts < 2:
        attempts += 1
        try:
            drv = _get_driver()
            with drv.session(database=NEO4J_DATABASE) as session:
                return session.run(cypher, **params).single()
        except (SessionExpired, ServiceUnavailable, OSError) as e:
            _driver = None
            last_err = e
            continue
        except Neo4jError as e:
            raise HTTPException(status_code=500, detail=f"Neo4j error: {e.message}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {e}")
    raise HTTPException(status_code=500, detail=f"Database connection error: {last_err}")


def _ensure_constraints_once():
    """Ensure required Neo4j constraints exist. Runs once per process and fails safe."""
    global _constraints_ready
    if _constraints_ready:
        return
    try:
        drv = _get_driver()
        with drv.session(database=NEO4J_DATABASE) as session:
            session.run(
                """
                CREATE CONSTRAINT conversation_id_unique IF NOT EXISTS
                FOR (c:Conversation)
                REQUIRE c.id IS UNIQUE
                """
            )
            # Backfill: ensure 'profile_pic' property key exists on all User nodes to avoid warnings
            session.run(
                """
                MATCH (u:User)
                WHERE NOT exists(u.profile_pic)
                SET u.profile_pic = ''
                """
            )
    except Exception:
        # Do not fail if constraint creation is not permitted or APOC missing, etc.
        pass
    finally:
        _constraints_ready = True


# ================== Pydantic bodies (match frontend) ==================
class StartConversationRequest(BaseModel):
    user_id: str = Field(..., description="Other user's ID")


class SendMessageRequest(BaseModel):
    # Allow either conversation_id or user_id for flexibility while migrating
    conversation_id: Optional[str] = Field(None, description="Existing Conversation ID (UUID/string)")
    user_id: Optional[str] = Field(None, description="Other user's ID (UUID/string) when conversation is not known")
    content: str = Field(..., min_length=1, description="Message content")

    @model_validator(mode="after")
    def at_least_one_identifier(self):
        if not self.conversation_id and not self.user_id:
            raise ValueError("Either conversation_id or user_id must be provided")
        return self


class MarkReadRequest(BaseModel):
    conversation_id: str = Field(..., description="Conversation ID")


# ================== Helpers ==================
def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sorted_pair_str(a: str, b: str) -> Tuple[str, str]:
    aa, bb = sorted([str(a), str(b)])
    return aa, bb


def _convo_id_for_pair(a: str, b: str) -> str:
    u1, u2 = _sorted_pair_str(a, b)
    return f"convo:{u1}:{u2}"


def _ensure_user(user_id: str, username: Optional[str] = None, profile_pic: Optional[str] = None):
    cypher = (
        "MERGE (u:User {id: $id})\n"
        "ON CREATE SET u.username = COALESCE($username, $id), u.profile_pic = COALESCE($profile_pic, null)\n"
        "RETURN u.id as id"
    )
    run_query(cypher, id=str(user_id), username=username, profile_pic=profile_pic)


def _ensure_conversation(me: str, other: str) -> Dict[str, Any]:
    cid = _convo_id_for_pair(str(me), str(other))
    cypher = (
        "MERGE (c:Conversation {id: $cid})\n"
        "  ON CREATE SET c.created_at = $now\n"
        "WITH c\n"
        "MATCH (u1:User {id: $me})\n"
        "MATCH (u2:User {id: $other})\n"
        "MERGE (u1)-[:PARTICIPATES_IN]->(c)\n"
        "MERGE (u2)-[:PARTICIPATES_IN]->(c)\n"
        "RETURN c.id as id, c.created_at as created_at"
    )
    rec = run_single(cypher, cid=cid, now=_iso_now(), me=str(me), other=str(other))
    if not rec:
        raise HTTPException(status_code=500, detail="Failed to create conversation")
    return {"id": rec["id"], "created_at": rec["created_at"]}


def _get_conversation_participants(conversation_id: str) -> List[str]:
    cypher = "MATCH (u:User)-[:PARTICIPATES_IN]->(c:Conversation {id: $cid}) RETURN u.id as id"
    rows = run_query(cypher, cid=conversation_id)
    ids = [str(r["id"]) for r in rows]
    if len(ids) != 2:
        raise HTTPException(status_code=404, detail="Conversation not found or invalid")
    return ids


def _other_of(participants: List[str], me: str) -> str:
    for p in participants:
        if str(p) != str(me):
            return str(p)
    raise HTTPException(status_code=400, detail="Invalid conversation participants")


def _is_admin(user: Dict[str, Any]) -> bool:
    """Best-effort admin detection.
    Accept either explicit boolean flag `is_admin` or a role in {admin, superadmin}.
    """
    if not user:
        return False
    if bool(user.get("is_admin")):
        return True
    role = str(user.get("role") or "").lower()
    return role in {"admin", "superadmin"}


def _message_row_to_json(r) -> Dict[str, Any]:
    return {
        "id": r["id"],
        "content": r["content"],
        "timestamp": r["created_at"],
        "sender_id": str(r["sender_id"]),
    }


def _conversation_row_to_json(r) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "id": r["cid"],
        "user": {
            "id": r["oid"] if r["oid"] is not None else None,
            "username": r["ousername"],
            "profile_pic": r["opic"],
        },
        "last_message": None,
    }
    if r["mid"]:
        item["last_message"] = {
            "id": r["mid"],
            "content": r["mcontent"],
            "timestamp": r["mcreated"],
            "sender_id": str(r["msender"]) if r["msender"] is not None else None,
        }
    return item


# ================== Routes ==================
# Optional Socket.IO import (non-fatal if missing)
try:
    from app.sockets import sio  # type: ignore
except Exception:
    sio = None


@router.post("/send")
async def send_and_create_if_needed(body: SendMessageRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Single endpoint to send a message. Auto-creates conversation if missing.
    Input: { user_id, content }
    Returns: { conversation_id, message: { id, content, timestamp, sender_id } }
    """
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="Message content cannot be empty")

    try:
        me = str(current_user["id"])  # current user id from auth (string/UUID)
        # Determine conversation and other participant
        conversation_id = body.conversation_id
        other = body.user_id if body.user_id is not None else None

        if other is not None and me == str(other):
            raise HTTPException(status_code=422, detail="Cannot message yourself")

        # Ensure users and conversation exist / or validate provided conversation
        _ensure_user(me, username=str(current_user.get("username") or me), profile_pic=current_user.get("profile_pic"))
        if conversation_id:
            # Ensure user participates
            parts = _get_conversation_participants(conversation_id)
            if me not in parts:
                raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        else:
            if not other:
                raise HTTPException(status_code=422, detail="user_id is required when conversation_id is not provided")
            other = str(other)
            _ensure_user(other)
            convo = _ensure_conversation(me, other)
            conversation_id = convo["id"]

        # Create message with required 'timestamp' property
        mid = str(uuid.uuid4())
        now = _iso_now()
        cypher = (
            "MATCH (c:Conversation {id: $cid})\n"
            "MATCH (s:User {id: $sid})\n"
            "MATCH (r:User {id: $rid})\n"
            "CREATE (m:Message {id: $mid, content: $content, timestamp: $now, created_at: $now, sender_id: $sid, receiver_id: $rid})\n"
            "MERGE (s)-[:SENT]->(m)\n"
            "MERGE (c)-[:HAS_MESSAGE]->(m)\n"
            "RETURN m.id as id, m.content as content, m.timestamp as timestamp, m.sender_id as sender_id"
        )
        rec = run_single(
            cypher,
            cid=str(conversation_id),
            sid=str(me),
            rid=str(_other_of(_get_conversation_participants(conversation_id), me) if not other else other),
            mid=mid,
            content=content,
            now=now,
        )
        if not rec:
            raise HTTPException(status_code=500, detail="Failed to create message")

        message = {
            "id": rec["id"],
            "content": rec["content"],
            "timestamp": rec["timestamp"],
            "sender_id": str(rec["sender_id"]),
        }

        # Real-time emit via Socket.IO to the conversation room
        if sio is not None:
            try:
                await sio.emit("message:new", {"conversation_id": conversation_id, "message": message}, room=conversation_id)
            except Exception:
                # Do not fail the request if socket emit fails
                pass

        return {"conversation_id": conversation_id, "message": message}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {e}")


@router.get("")
def get_messages(conversation_id: str = Query(..., description="Conversation ID"), current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Return all messages in a conversation ascending by time in the shape:
    [ { id, content, timestamp, sender_id }, ... ]
    """
    try:
        me = str(current_user["id"])
        parts = _get_conversation_participants(conversation_id)
        if str(me) not in parts:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")
        cypher = (
            "MATCH (c:Conversation {id: $cid})-[:HAS_MESSAGE]->(m:Message)\n"
            "RETURN m.id as id, m.content as content, COALESCE(m.timestamp, m.created_at) as timestamp, m.sender_id as sender_id\n"
            "ORDER BY timestamp ASC"
        )
        rows = run_query(cypher, cid=str(conversation_id))
        return [
            {
                "id": r["id"],
                "content": r["content"],
                "timestamp": r["timestamp"],
                "sender_id": str(r["sender_id"]),
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list messages: {e}")


@router.get("/by/{conversation_id}")
def get_messages_by_path(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Alternative path-based version:
    GET /messages/by/{conversation_id}
    Returns all messages for a conversation in ascending timestamp order.
    """
    try:
        me = str(current_user["id"])
        parts = _get_conversation_participants(conversation_id)
        if me not in parts:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")

        cypher = (
            "MATCH (c:Conversation {id: $cid})-[:HAS_MESSAGE]->(m:Message)\n"
            "RETURN m.id as id, m.content as content, COALESCE(m.timestamp, m.created_at) as timestamp, m.sender_id as sender_id\n"
            "ORDER BY timestamp ASC"
        )
        rows = run_query(cypher, cid=str(conversation_id))
        return [
            {
                "id": r["id"],
                "content": r["content"],
                "timestamp": r["timestamp"],
                "sender_id": str(r["sender_id"]),
            }
            for r in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list messages: {e}")


# ================== Additional Endpoints for Frontend ==================
class StartConversationRequest(BaseModel):
    user_id: str = Field(..., description="Other user's ID")


@router.post("/start")
def start_conversation(body: StartConversationRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Start or get a conversation with the given user_id. Returns { conversation_id, user }"""
    try:
        me = str(current_user["id"])
        other = str(body.user_id)
        if me == other:
            raise HTTPException(status_code=422, detail="Cannot start conversation with yourself")

        _ensure_user(me, username=str(current_user.get("username") or me), profile_pic=current_user.get("profile_pic"))
        _ensure_user(other)
        convo = _ensure_conversation(me, other)

        # Fetch other user's public fields (APOC-safe property access)
        try:
            urec = run_single(
                """
                MATCH (u:User {id:$id})
                RETURN u.id as id,
                       u.username as username,
                       coalesce(apoc.property(u, 'profile_pic'), u.avatar_url, '') as profile_pic
                """,
                id=other,
            )
        except Exception:
            # Fallback without APOC
            urec = run_single(
                """
                MATCH (u:User {id:$id})
                RETURN u.id as id,
                       u.username as username,
                       COALESCE(u.profile_pic, u.avatar_url, '') as profile_pic
                """,
                id=other,
            )
        user_obj = {"id": urec["id"], "username": urec.get("username"), "profile_pic": urec.get("profile_pic")} if urec else {"id": other}

        return {"conversation_id": convo["id"], "user": user_obj}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start conversation: {e}")


@router.get("/conversation/with/{user_id}")
def get_conversation_with(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return existing conversation with a specific user if it exists, without creating one.
    Response: { conversation_id, user, last_message } or { conversation_id: None } if not found.
    """
    try:
        me = str(current_user["id"])
        other = str(user_id)
        if me == other:
            raise HTTPException(status_code=422, detail="Cannot open conversation with yourself")

        # Try APOC for safe property access
        cypher_apoc = (
            "MATCH (me:User {id:$me})-[:PARTICIPATES_IN]->(c:Conversation)<-[:PARTICIPATES_IN]-(other:User {id:$other})\n"
            "OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(m:Message)\n"
            "WITH c, other, m\n"
            "ORDER BY m.timestamp DESC\n"
            "WITH c, other, head(collect(m)) AS last\n"
            "RETURN c.id AS cid, other.id AS oid, other.username AS ousername,\n"
            "       coalesce(apoc.property(other,'profile_pic'), other.avatar_url, '') AS opic,\n"
            "       (CASE WHEN last IS NULL THEN NULL ELSE last.id END) AS mid,\n"
            "       (CASE WHEN last IS NULL THEN NULL ELSE last.content END) AS mcontent,\n"
            "       (CASE WHEN last IS NULL THEN NULL ELSE last.timestamp END) AS mcreated,\n"
            "       (CASE WHEN last IS NULL THEN NULL ELSE last.sender_id END) AS msender"
        )

        try:
            rec = run_single(cypher_apoc, me=me, other=other)
        except Exception:
            cypher_fb = (
                "MATCH (me:User {id:$me})-[:PARTICIPATES_IN]->(c:Conversation)<-[:PARTICIPATES_IN]-(other:User {id:$other})\n"
                "OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(m:Message)\n"
                "WITH c, other, m\n"
                "ORDER BY m.timestamp DESC\n"
                "WITH c, other, head(collect(m)) AS last\n"
                "RETURN c.id AS cid, other.id AS oid, other.username AS ousername,\n"
                "       COALESCE(other.profile_pic, other.avatar_url, '') AS opic,\n"
                "       (CASE WHEN last IS NULL THEN NULL ELSE last.id END) AS mid,\n"
                "       (CASE WHEN last IS NULL THEN NULL ELSE last.content END) AS mcontent,\n"
                "       (CASE WHEN last IS NULL THEN NULL ELSE last.timestamp END) AS mcreated,\n"
                "       (CASE WHEN last IS NULL THEN NULL ELSE last.sender_id END) AS msender"
            )
            rec = run_single(cypher_fb, me=me, other=other)

        if not rec or not rec.get("cid"):
            return {"conversation_id": None}

        data = {
            "conversation_id": rec["cid"],
            "user": {"id": rec["oid"], "username": rec.get("ousername"), "profile_pic": rec.get("opic")},
            "last_message": (
                {"id": rec["mid"], "content": rec["mcontent"], "timestamp": rec["mcreated"], "sender_id": rec["msender"]}
                if rec.get("mid") else None
            ),
        }
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get conversation: {e}")

@router.get("/conversations")
def get_conversations(
    limit: int = Query(20, ge=1, le=100, description="Max conversations to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return user's conversations with last message and other participant.
    Supports pagination with limit/offset. Orders by last message timestamp desc.
    Uses APOC property access if available to avoid warnings on missing properties.
    """
    try:
        _ensure_constraints_once()
        me = str(current_user["id"])

        # Try with APOC first to avoid missing property warnings
        apoc_cypher = (
            "MATCH (me:User {id:$me})-[:PARTICIPATES_IN]->(c:Conversation)<-[:PARTICIPATES_IN]-(other:User)\n"
            "MATCH (c)-[:HAS_MESSAGE]->(m:Message)\n"
            "WITH c, other, m\n"
            "ORDER BY m.timestamp DESC\n"
            "WITH c, other, head(collect(m)) AS last\n"
            "RETURN c.id AS cid, other.id AS oid, other.username AS ousername,\n"
            "       coalesce(apoc.property(other, 'profile_pic'), other.avatar_url, '') AS opic,\n"
            "       last.id AS mid,\n"
            "       last.content AS mcontent,\n"
            "       last.timestamp AS mcreated,\n"
            "       last.sender_id AS msender\n"
            "ORDER BY mcreated DESC\n"
            "SKIP $offset LIMIT $limit"
        )

        try:
            rows = run_query(apoc_cypher, me=me, limit=int(limit), offset=int(offset))
        except Exception:
            # Fallback to plain COALESCE if APOC is unavailable or any error occurs
            fallback_cypher = (
                "MATCH (me:User {id:$me})-[:PARTICIPATES_IN]->(c:Conversation)<-[:PARTICIPATES_IN]-(other:User)\n"
                "MATCH (c)-[:HAS_MESSAGE]->(m:Message)\n"
                "WITH c, other, m\n"
                "ORDER BY m.timestamp DESC\n"
                "WITH c, other, head(collect(m)) AS last\n"
                "RETURN c.id AS cid, other.id AS oid, other.username AS ousername,\n"
                "      COALESCE(other.avatar_url, '') AS opic,\n"
                "       last.id AS mid,\n"
                "       last.content AS mcontent,\n"
                "       last.timestamp AS mcreated,\n"
                "       last.sender_id AS msender\n"
                "ORDER BY mcreated DESC\n"
                "SKIP $offset LIMIT $limit"
            )
            rows = run_query(fallback_cypher, me=me, limit=int(limit), offset=int(offset))

        # Build response
        convos: List[Dict[str, Any]] = []
        for r in rows:
            convos.append({
                "id": r["cid"],
                "user": {"id": r["oid"], "username": r.get("ousername"), "profile_pic": r.get("opic")},
                "last_message": (
                    {"id": r["mid"], "content": r["mcontent"], "timestamp": r["mcreated"], "sender_id": r["msender"]}
                    if r["mid"] else None
                ),
            })
        return convos
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load conversations: {e}")


@router.post("/mark_read")
def mark_read(body: MarkReadRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Mark messages in a conversation as read for the current user (UUID-safe).
    Returns: { ok, count }
    """
    try:
        me = str(current_user["id"])
        parts = _get_conversation_participants(body.conversation_id)
        if me not in parts:
            raise HTTPException(status_code=403, detail="Not a participant in this conversation")

        cypher = (
            "MATCH (u:User {id: $uid})\n"
            "MATCH (:Conversation {id: $cid})-[:HAS_MESSAGE]->(m:Message {receiver_id: $uid})\n"
            "WHERE NOT (u)-[:READ_BY]->(m)\n"
            "WITH u, m\n"
            "MERGE (u)-[:READ_BY]->(m)\n"
            "RETURN count(m) as marked"
        )
        rec = run_single(cypher, uid=me, cid=str(body.conversation_id))
        count = int((rec and rec.get("marked")) or 0)
        return {"ok": True, "count": count}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark read: {e}")


# ================== Deletion Endpoints (backend-only) ==================
@router.delete("/conversation/{conversation_id}")
def delete_messages_in_conversation(conversation_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Delete all messages in a conversation.
    Authorization: participant of the conversation or admin.
    Returns: { success: true, deleted_messages: X }
    """
    try:
        me = str(current_user["id"]) if current_user and current_user.get("id") else None
        if not conversation_id:
            raise HTTPException(status_code=422, detail="conversation_id is required")

        # Validate conversation and authorization
        parts = _get_conversation_participants(conversation_id)
        if me not in parts and not _is_admin(current_user):
            raise HTTPException(status_code=403, detail="Not authorized to delete this conversation's messages")

        # Count messages first
        count_rec = run_single(
            """
            MATCH (c:Conversation {id: $cid})-[:HAS_MESSAGE]->(m:Message)
            RETURN count(m) as cnt
            """,
            cid=str(conversation_id),
        )
        deleted = int(count_rec["cnt"] or 0) if count_rec else 0

        # Delete messages
        run_query(
            """
            MATCH (c:Conversation {id: $cid})-[:HAS_MESSAGE]->(m:Message)
            DETACH DELETE m
            """,
            cid=str(conversation_id),
        )

        # Optionally delete empty conversation
        run_query(
            """
            MATCH (c:Conversation {id: $cid})
            WHERE NOT (c)-[:HAS_MESSAGE]->()
            DETACH DELETE c
            """,
            cid=str(conversation_id),
        )

        return {"success": True, "deleted_messages": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete messages: {e}")


@router.delete("/user/{user_id}")
def delete_messages_by_user(user_id: str, current_user: Dict[str, Any] = Depends(get_current_user)):
    """Delete all messages sent by a specific user.
    Authorization: the user themselves or an admin.
    Returns: { success: true, deleted_messages: X }
    """
    try:
        if not user_id:
            raise HTTPException(status_code=422, detail="user_id is required")
        me = str(current_user["id"]) if current_user and current_user.get("id") else None
        if me != str(user_id) and not _is_admin(current_user):
            raise HTTPException(status_code=403, detail="Not authorized to delete messages for this user")

        # Confirm user exists
        urec = run_single("MATCH (u:User {id:$id}) RETURN u.id as id", id=str(user_id))
        if not urec:
            raise HTTPException(status_code=404, detail="User not found")

        # Count messages first
        count_rec = run_single(
            """
            MATCH (:User {id:$uid})-[:SENT]->(m:Message)
            RETURN count(m) as cnt
            """,
            uid=str(user_id),
        )
        deleted = int(count_rec["cnt"] or 0) if count_rec else 0

        # Delete those messages
        run_query(
            """
            MATCH (:User {id:$uid})-[:SENT]->(m:Message)
            DETACH DELETE m
            """,
            uid=str(user_id),
        )

        # Optionally prune empty conversations after message deletions
        run_query(
            """
            MATCH (c:Conversation)
            WHERE NOT (c)-[:HAS_MESSAGE]->()
            DETACH DELETE c
            """,
        )

        return {"success": True, "deleted_messages": deleted}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user's messages: {e}")
