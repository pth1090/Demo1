import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import get_db
from models import SchemaConfig, Template, TemplateField
from schemas import SchemaConfigCreate, SchemaConfigRead, FieldDef
from services.devt_parser import parse, fields_to_db_rows

router = APIRouter(prefix="/schema-configs", tags=["schema-configs"])


def _serialize_field_defs(field_defs: list[FieldDef] | None) -> str | None:
    if field_defs is None:
        return None
    return json.dumps([fd.model_dump() for fd in field_defs])


def _deserialize_field_defs(raw: str | None) -> list[FieldDef] | None:
    if not raw:
        return None
    return [FieldDef(**item) for item in json.loads(raw)]


def _to_read(cfg: SchemaConfig) -> SchemaConfigRead:
    return SchemaConfigRead(
        id=cfg.id,
        name=cfg.name,
        format_type=cfg.format_type,
        kv_separator=cfg.kv_separator,
        comment_chars=cfg.comment_chars,
        field_defs=_deserialize_field_defs(cfg.field_defs),
        is_default=cfg.is_default,
    )


@router.get("", response_model=list[SchemaConfigRead])
async def list_schema_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SchemaConfig).order_by(SchemaConfig.id))
    return [_to_read(c) for c in result.scalars().all()]


@router.post("", response_model=SchemaConfigRead, status_code=201)
async def create_schema_config(payload: SchemaConfigCreate, db: AsyncSession = Depends(get_db)):
    if payload.is_default:
        # Unset previous default
        result = await db.execute(select(SchemaConfig).where(SchemaConfig.is_default == 1))
        for cfg in result.scalars().all():
            cfg.is_default = 0

    cfg = SchemaConfig(
        name=payload.name,
        format_type=payload.format_type,
        kv_separator=payload.kv_separator,
        comment_chars=payload.comment_chars,
        field_defs=_serialize_field_defs(payload.field_defs),
        is_default=payload.is_default,
    )
    db.add(cfg)
    await db.commit()
    await db.refresh(cfg)
    return _to_read(cfg)


@router.get("/{config_id}", response_model=SchemaConfigRead)
async def get_schema_config(config_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SchemaConfig).where(SchemaConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "Konfiguration nicht gefunden")
    return _to_read(cfg)


@router.put("/{config_id}", response_model=SchemaConfigRead)
async def update_schema_config(
    config_id: int, payload: SchemaConfigCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SchemaConfig).where(SchemaConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "Konfiguration nicht gefunden")

    if payload.is_default and not cfg.is_default:
        result2 = await db.execute(select(SchemaConfig).where(SchemaConfig.is_default == 1))
        for other in result2.scalars().all():
            other.is_default = 0

    cfg.name = payload.name
    cfg.format_type = payload.format_type
    cfg.kv_separator = payload.kv_separator
    cfg.comment_chars = payload.comment_chars
    cfg.field_defs = _serialize_field_defs(payload.field_defs)
    cfg.is_default = payload.is_default

    await db.commit()
    await db.refresh(cfg)
    return _to_read(cfg)


@router.delete("/{config_id}", status_code=204)
async def delete_schema_config(config_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SchemaConfig).where(SchemaConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "Konfiguration nicht gefunden")
    await db.delete(cfg)
    await db.commit()


@router.post("/{config_id}/apply", response_model=dict)
async def apply_schema_config(config_id: int, db: AsyncSession = Depends(get_db)):
    """Re-parse all templates using this schema config (refreshes template_fields)."""
    result = await db.execute(select(SchemaConfig).where(SchemaConfig.id == config_id))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, "Konfiguration nicht gefunden")

    result = await db.execute(select(Template))
    templates = result.scalars().all()
    updated = 0
    for tpl in templates:
        if not tpl.raw_content:
            continue
        await db.execute(delete(TemplateField).where(TemplateField.template_id == tpl.id))
        doc = parse(tpl.raw_content)
        for row in fields_to_db_rows(doc):
            db.add(TemplateField(template_id=tpl.id, **row))
        updated += 1

    await db.commit()
    return {"updated": updated}
