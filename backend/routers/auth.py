from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User
from schemas import UserCreate, UserRead, TokenResponse, LoginRequest
from auth import hash_password, create_access_token, authenticate_user, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user and return an access token."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="E-Mail bereits registriert")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        display_name=payload.display_name,
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # First ever real user gets admin rights
    result = await db.execute(select(User).where(User.is_active == True, User.id != 1))
    real_users = result.scalars().all()
    if len(real_users) == 1:
        user.is_admin = True
        await db.commit()
        await db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/token", response_model=TokenResponse)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """OAuth2 password flow — used by Swagger UI 'Authorize' button."""
    user = await authenticate_user(form_data.username, form_data.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login_json(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """JSON login — used by the React frontend."""
    user = await authenticate_user(payload.email, payload.password, db)
    if not user:
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return current_user
