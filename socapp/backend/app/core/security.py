from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.core.database import db

pwd_context = CryptContext(
    # Argon2 for new hashes, keep bcrypt to verify existing users
    schemes=["argon2", "bcrypt"],
    deprecated="auto",
)

def create_access_token(data: dict, expires_delta: int | None = None) -> str:
    """
    Create a JWT token with an expiration.
    """
    to_encode = data.copy()
    minutes = expires_delta if expires_delta is not None else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_value, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    Let Passlib handle bcrypt's internal 72-byte limit.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Hash a password. New hashes will use Argon2 (first scheme).
    Existing bcrypt hashes remain valid for verification.
    """
    return pwd_context.hash(password)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Retrieve the current user from a JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_value, algorithms=[settings.JWT_ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    with db.get_session() as session:
        # Try email first
        record = session.run("MATCH (u:User {email: $sub}) RETURN u", sub=subject).single()
        if not record:
            # Fallback to username
            record = session.run("MATCH (u:User {username: $sub}) RETURN u", sub=subject).single()
        if not record:
            raise credentials_exception

        user = dict(record["u"])
        user.pop("password", None)  # Remove password for safety
        return user
