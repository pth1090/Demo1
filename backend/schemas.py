from datetime import datetime
from typing import Any
from pydantic import BaseModel, field_validator
import re


# ── User ───────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    display_name: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Ungültige E-Mail-Adresse")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Passwort muss mindestens 8 Zeichen haben")
        return v

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 50:
            raise ValueError("Anzeigename muss 2–50 Zeichen lang sein")
        return v


class UserRead(BaseModel):
    id: int
    email: str
    display_name: str
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class LoginRequest(BaseModel):
    email: str
    password: str


# ── TemplateField ──────────────────────────────────────────────────────────────

class FieldRead(BaseModel):
    id: int
    section: str | None
    key: str
    value: str | None
    field_order: int

    model_config = {"from_attributes": True}


class FieldWrite(BaseModel):
    section: str | None = None
    key: str
    value: str | None = None
    field_order: int = 0


# ── Comment ────────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Kommentar darf nicht leer sein")
        if len(v) > 2000:
            raise ValueError("Kommentar darf maximal 2000 Zeichen haben")
        return v


class CommentRead(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: UserRead

    model_config = {"from_attributes": True}


# ── Template ───────────────────────────────────────────────────────────────────

class TemplateBase(BaseModel):
    name: str
    description: str | None = None


class TemplateCreate(TemplateBase):
    raw_content: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    raw_content: str | None = None
    fields: list[FieldWrite] | None = None


class TemplateVisibilityUpdate(BaseModel):
    is_public: bool


class TemplateSummary(TemplateBase):
    id: int
    is_public: bool
    owner_id: int
    owner: UserRead
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateRead(TemplateSummary):
    raw_content: str | None
    fields: list[FieldRead]
    comments: list[CommentRead]


# ── SchemaConfig ───────────────────────────────────────────────────────────────

class FieldDef(BaseModel):
    key: str
    label: str
    type: str = "text"
    required: bool = False
    options: list[str] | None = None


class SchemaConfigBase(BaseModel):
    name: str
    format_type: str = "ini"
    kv_separator: str = "="
    comment_chars: str = "#;"
    field_defs: list[FieldDef] | None = None
    is_default: int = 0


class SchemaConfigCreate(SchemaConfigBase):
    pass


class SchemaConfigRead(SchemaConfigBase):
    id: int

    model_config = {"from_attributes": True}


# ── Parse Preview ──────────────────────────────────────────────────────────────

class ParsedSection(BaseModel):
    section: str
    fields: list[dict[str, Any]]


class ParsePreviewResponse(BaseModel):
    sections: list[ParsedSection]
    raw_content: str
