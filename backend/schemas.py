from datetime import datetime
from typing import Any
from pydantic import BaseModel


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


class TemplateSummary(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateRead(TemplateSummary):
    raw_content: str | None
    fields: list[FieldRead]


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
