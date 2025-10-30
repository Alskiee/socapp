from fastapi import APIRouter, HTTPException, Depends, status, Form, BackgroundTasks
from fastapi.responses import HTMLResponse 
from pydantic import BaseModel, EmailStr
from uuid import uuid4
from app.core.database import db
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from fastapi.security import OAuth2PasswordBearer
from app.core.email_verification import send_verification_email, generate_verification_token
import datetime
import logging
import asyncio

router = APIRouter(prefix="/auth", tags=["Auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class VerifyEmailRequest(BaseModel):
    token: str

async def send_verification_email_with_delay(email: str, verification_token: str):
    await asyncio.sleep(2)
    return await send_verification_email(email, verification_token)

    
@router.post("/register")
async def register(user: UserCreate, background_tasks: BackgroundTasks):
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
        verification_token = generate_verification_token()
        
        session.run(
            """
            CREATE (u:User {
                id: $id, 
                username: $username, 
                email: $email, 
                password: $password,
                email_verified: $email_verified,
                verification_token: $verification_token,
                created_at: $created_at
            })
            """,
            id=user_id, 
            username=user.username, 
            email=user.email, 
            password=hashed_pw,
            email_verified=False,
            verification_token=verification_token,
            created_at=datetime.datetime.utcnow().isoformat()
        )

    background_tasks.add_task(send_verification_email_with_delay, user.email, verification_token)

    return {
        "message": "Registration successful! Please check your email to verify your account.",
        "user_id": user_id
    }

async def send_verification_email_with_logging(email: str, token: str):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🎯 Starting background email send to: {email}")
    result = await send_verification_email(email, token)
    
    if result:
        logger.info(f"✅ Background email sent successfully to: {email}")
    else:
        logger.error(f"❌ Background email failed to send to: {email}")
    
    return result

@router.get("/verify-email")
def verify_email(token: str):
    with db.get_session() as session:
        result = session.run(
            "MATCH (u:User {verification_token: $token}) RETURN u",
            token=token
        ).single()

        if not result:
            raise HTTPException(status_code=400, detail="Invalid verification token")

        user_data = result["u"]
        
        session.run(
            """
            MATCH (u:User {verification_token: $token})
            SET u.email_verified = true,
                u.verification_token = null,
                u.verified_at = $verified_at
            """,
            token=token,
            verified_at=datetime.datetime.utcnow().isoformat()
        )

    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Email Verified</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: green; font-size: 24px; }
            .message { margin: 20px 0; }
            .button { 
                display: inline-block; 
                background-color: #007bff; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 5px; 
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="success">✅ Email Verified Successfully!</div>
        <div class="message">You can now log in to your account.</div>
        <a href="https://css-social.onrender.com/login" class="button">Go to Login</a>
        <script>
            // Optional: Auto-redirect after 3 seconds
            setTimeout(function() {
                window.location.href = "https://css-social.onrender.com/login";
            }, 3000);
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)

    
@router.post("/resend-verification")
async def resend_verification(email: str, background_tasks: BackgroundTasks):
    with db.get_session() as session:
        result = session.run(
            "MATCH (u:User {email: $email}) RETURN u",
            email=email
        ).single()

        if not result:
            raise HTTPException(status_code=404, detail="User not found")

        user_data = result["u"]
        
        if user_data.get("email_verified", False):
            raise HTTPException(status_code=400, detail="Email is already verified")

        new_token = generate_verification_token()
        
        session.run(
            "MATCH (u:User {email: $email}) SET u.verification_token = $token",
            email=email,
            token=new_token
        )

    background_tasks.add_task(send_verification_email, email, new_token)

    return {"message": "Verification email sent successfully!"}

@router.post("/login")
def login_form(username: str = Form(...), password: str = Form(...)):
    with db.get_session() as session:
        record = session.run(
            "MATCH (u:User {username: $username}) RETURN u",
            username=username
        ).single()

        if not record or not verify_password(password, record["u"]["password"]):
            raise HTTPException(status_code=400, detail="Invalid username or password")

        user_data = record["u"]
        
        if not user_data.get("email_verified", False):
            raise HTTPException(
                status_code=403, 
                detail="Please verify your email before logging in"
            )

        token = create_access_token({"sub": username})
        return {"access_token": token, "token_type": "bearer"}

@router.post("/login-with-username")
def login_json(payload: LoginRequest):
    username = payload.username
    password = payload.password

    with db.get_session() as session:
        record = session.run(
            "MATCH (u:User {username: $username}) RETURN u",
            username=username
        ).single()

        if not record or not verify_password(password, record["u"]["password"]):
            raise HTTPException(status_code=400, detail="Invalid username or password")

        user_data = record["u"]
        
        if not user_data.get("email_verified", False):
            raise HTTPException(
                status_code=403, 
                detail="Please verify your email before logging in"
            )

        token = create_access_token({"sub": username})
        return {"access_token": token, "token_type": "bearer"}

@router.get("/users/me")
def current_user(current_user: dict = Depends(get_current_user)):
    current_user.pop("password", None)
    return current_user


    return {
        "neo4j_uri": settings.NEO4J_URI,
        "neo4j_username": settings.NEO4J_USERNAME,
        "neo4j_user": settings.NEO4J_USER,
        "auth_user_computed": settings.auth_user,
        "database": settings.NEO4J_DATABASE,
        "has_password": bool(settings.NEO4J_PASSWORD)
    }

    import os
    
    sg_api_key = os.getenv("SENDGRID_API_KEY")
    base_url = os.getenv("BASE_URL")
    gmail_email = os.getenv("GMAIL_EMAIL")
    
    return {
        "sendgrid_configured": bool(sg_api_key),
        "api_key_length": len(sg_api_key) if sg_api_key else 0,
        "api_key_prefix": sg_api_key[:10] + "..." if sg_api_key and len(sg_api_key) > 10 else "None",
        "base_url": base_url,
        "gmail_email_configured": bool(gmail_email),
        "environment": "production" if "render.com" in str(base_url) else "development"
    }