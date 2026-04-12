import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db

# ── Configuration ──────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))

_PLACEHOLDER_SECRET = "change-me-in-production-use-openssl-rand-hex-32"

if not JWT_SECRET or JWT_SECRET == _PLACEHOLDER_SECRET:
    raise RuntimeError(
        "JWT_SECRET muss gesetzt sein. "
        "Generiere einen sicheren Wert mit: openssl rand -hex 32"
    )

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)

# Dummy hash for constant-time comparison when user is not found
_DUMMY_HASH = pwd_context.hash("dummy-password-that-never-matches")


# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Token helpers ──────────────────────────────────────────────────────────────

def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> int | None:
    """Decode JWT and return user_id, or None on any error."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, ValueError):
        return None


# ── FastAPI Dependencies ───────────────────────────────────────────────────────

async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Require authenticated user. Raises 401 if token missing/invalid."""
    from models import User  # avoid circular import at module level

    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")

    user_id = _decode_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Ungültiges Token")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Return current user or None if not authenticated (no error)."""
    from models import User

    if not token:
        return None

    user_id = _decode_token(token)
    if user_id is None:
        return None

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    return result.scalar_one_or_none()


async def authenticate_user(email: str, password: str, db: AsyncSession):
    """Verify email+password. Returns User or None. Always runs bcrypt to prevent timing attacks."""
    from models import User

    result = await db.execute(select(User).where(User.email == email.strip().lower()))
    user = result.scalar_one_or_none()

    # Always verify to prevent user-enumeration via timing
    check_hash = user.hashed_password if user else _DUMMY_HASH
    if not verify_password(password, check_hash):
        return None
    if user and not user.is_active:
        return None
    return user
