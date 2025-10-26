from fastapi import APIRouter, HTTPException, Depends, status, Form
from pydantic import BaseModel
from uuid import uuid4
from app.core.database import db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# -------------------- Schemas --------------------
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

# -------------------- REGISTER --------------------
@router.post("/register")
def register(user: UserCreate):
    with db.get_session() as session:
        existing = session.run(
            "MATCH (u:User) WHERE u.email=$email OR u.username=$username RETURN u",
            email=user.email,
            username=user.username
        ).single()

        if existing:
            raise HTTPException(status_code=400, detail="Email or username already registered")

        user_id = str(uuid4())
        hashed_pw = get_password_hash(user.password)

        session.run(
            """
            CREATE (u:User {id:$id, username:$username, email:$email, password:$password})
            """,
            id=user_id, username=user.username, email=user.email, password=hashed_pw
        )

    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# -------------------- LOGIN (Form for Swagger) --------------------
@router.post("/login")
def login_form(username: str = Form(...), password: str = Form(...)):
    with db.get_session() as session:
        record = session.run(
            "MATCH (u:User {username:$username}) RETURN u",
            username=username
        ).single()

        if not record or not verify_password(password, record["u"]["password"]):
            raise HTTPException(status_code=400, detail="Invalid username or password")

        token = create_access_token({"sub": username})
        return {"access_token": token, "token_type": "bearer"}

# -------------------- LOGIN (JSON for frontend) --------------------
@router.post("/login-with-username")
def login_json(payload: LoginRequest):
    username = payload.username
    password = payload.password

    with db.get_session() as session:
        record = session.run(
            "MATCH (u:User {username:$username}) RETURN u",
            username=username
        ).single()

        if not record or not verify_password(password, record["u"]["password"]):
            raise HTTPException(status_code=400, detail="Invalid username or password")

        token = create_access_token({"sub": username})
        return {"access_token": token, "token_type": "bearer"}

# -------------------- CURRENT USER --------------------
@router.get("/users/me")
def current_user(current_user: dict = Depends(get_current_user)):
    current_user.pop("password", None)
    return current_user
