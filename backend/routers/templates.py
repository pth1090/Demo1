import io
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from sqlalchemy.orm import selectinload

from database import get_db
from models import Template, TemplateField, Comment
from schemas import (
    TemplateCreate, TemplateUpdate, TemplateSummary, TemplateRead,
    TemplateVisibilityUpdate, FieldWrite, ParsePreviewResponse, ParsedSection,
)
from services.devt_parser import parse, fields_to_db_rows, extract_device_name, extract_description
from services.devt_serializer import serialize
from auth import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])

# Eager-load options used by every returning-template query
_LOAD_FULL = [
    selectinload(Template.fields),
    selectinload(Template.owner),
    selectinload(Template.comments).selectinload(Comment.author),
]
_LOAD_SUMMARY = [selectinload(Template.owner)]


def _field_row(template_id: int, fw: dict) -> TemplateField:
    return TemplateField(
        template_id=template_id,
        section=fw.get("section"),
        key=fw["key"],
        value=fw.get("value"),
        field_order=fw.get("field_order", 0),
    )


def _visibility_filter(current_user):
    """SQLAlchemy filter: own templates + public templates."""
    return or_(Template.owner_id == current_user.id, Template.is_public == True)


@router.get("", response_model=list[TemplateSummary])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Template)
        .options(*_LOAD_SUMMARY)
        .where(_visibility_filter(current_user))
        .order_by(Template.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=TemplateRead, status_code=201)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tpl = Template(
        name=payload.name,
        description=payload.description,
        raw_content=payload.raw_content,
        owner_id=current_user.id,
        is_public=False,
    )
    if payload.raw_content:
        doc = parse(payload.raw_content)
        rows = fields_to_db_rows(doc)
        tpl.fields = [_field_row(0, r) for r in rows]
        if not tpl.description:
            tpl.description = extract_description(doc)
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == tpl.id)
    )
    return result.scalar_one()


@router.get("/import-preview", response_model=ParsePreviewResponse)
async def parse_preview_get():
    raise HTTPException(405, "Use POST /api/v1/templates/parse-preview")


@router.post("/parse-preview", response_model=ParsePreviewResponse)
async def parse_preview(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8", errors="replace")
    doc = parse(content)
    sections = []
    for sec in doc.sections:
        sec_fields = [{"key": f.key, "value": f.value, "field_order": f.field_order}
                      for f in doc.fields_for(sec)]
        sections.append(ParsedSection(section=sec, fields=sec_fields))
    return ParsePreviewResponse(sections=sections, raw_content=content)


@router.post("/import", response_model=TemplateRead, status_code=201)
async def import_template(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    content = (await file.read()).decode("utf-8", errors="replace")
    doc = parse(content)
    name = extract_device_name(doc) or file.filename or "Unbenanntes Template"
    description = extract_description(doc)

    # Ensure unique name within this user's templates
    result = await db.execute(
        select(Template).where(Template.name == name, Template.owner_id == current_user.id)
    )
    if result.scalar_one_or_none():
        name = f"{name} (Import)"

    tpl = Template(
        name=name,
        description=description,
        raw_content=content,
        owner_id=current_user.id,
        is_public=False,
    )
    rows = fields_to_db_rows(doc)
    tpl.fields = [_field_row(0, r) for r in rows]
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == tpl.id)
    )
    return result.scalar_one()


@router.get("/{template_id}", response_model=TemplateRead)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if not tpl.is_public and tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Zugriff verweigert")
    return tpl


@router.put("/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Nur der Eigentümer darf bearbeiten")

    if payload.name is not None:
        tpl.name = payload.name
    if payload.description is not None:
        tpl.description = payload.description

    if payload.raw_content is not None:
        tpl.raw_content = payload.raw_content
        await db.execute(delete(TemplateField).where(TemplateField.template_id == template_id))
        doc = parse(payload.raw_content)
        rows = fields_to_db_rows(doc)
        for r in rows:
            db.add(TemplateField(template_id=template_id, **r))
    elif payload.fields is not None:
        await db.execute(delete(TemplateField).where(TemplateField.template_id == template_id))
        field_dicts = [f.model_dump() for f in payload.fields]
        for fd in field_dicts:
            db.add(TemplateField(template_id=template_id, **fd))
        tpl.raw_content = serialize(field_dicts, tpl.raw_content)

    await db.commit()
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == template_id)
    )
    return result.scalar_one()


@router.patch("/{template_id}/visibility", response_model=TemplateSummary)
async def set_visibility(
    template_id: int,
    payload: TemplateVisibilityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Toggle a template between public and private. Owner only."""
    result = await db.execute(
        select(Template).options(*_LOAD_SUMMARY).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Nur der Eigentümer darf die Sichtbarkeit ändern")
    tpl.is_public = payload.is_public
    await db.commit()
    result = await db.execute(
        select(Template).options(*_LOAD_SUMMARY).where(Template.id == template_id)
    )
    return result.scalar_one()


@router.post("/{template_id}/fork", response_model=TemplateRead, status_code=201)
async def fork_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Copy a visible template into the current user's private area."""
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == template_id)
    )
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(404, "Template nicht gefunden")
    if not src.is_public and src.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Zugriff verweigert")

    # Determine a unique name for the fork
    base_name = f"{src.name} (Kopie)"
    name = base_name
    suffix = 2
    while True:
        existing = await db.execute(
            select(Template).where(Template.name == name, Template.owner_id == current_user.id)
        )
        if not existing.scalar_one_or_none():
            break
        name = f"{base_name} {suffix}"
        suffix += 1

    fork = Template(
        name=name,
        description=src.description,
        raw_content=src.raw_content,
        owner_id=current_user.id,
        is_public=False,
    )
    fork.fields = [
        TemplateField(section=f.section, key=f.key, value=f.value, field_order=f.field_order)
        for f in src.fields
    ]
    db.add(fork)
    await db.commit()
    await db.refresh(fork)
    result = await db.execute(
        select(Template).options(*_LOAD_FULL).where(Template.id == fork.id)
    )
    return result.scalar_one()


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Nur der Eigentümer oder ein Admin darf löschen")
    await db.delete(tpl)
    await db.commit()


@router.get("/{template_id}/symbol")
async def get_symbol(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if not tpl.is_public and tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Zugriff verweigert")

    field_result = await db.execute(
        select(TemplateField).where(
            TemplateField.template_id == template_id,
            TemplateField.key == "Symbol",
        )
    )
    field = field_result.scalar_one_or_none()
    if not field or not field.value:
        raise HTTPException(404, "Kein Symbol vorhanden")
    try:
        bmp_bytes = bytes.fromhex(field.value.strip())
    except ValueError:
        raise HTTPException(422, "Symbol-Daten ungültig")
    return Response(content=bmp_bytes, media_type="image/bmp")


@router.put("/{template_id}/symbol", status_code=204)
async def update_symbol(
    template_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Nur der Eigentümer darf das Symbol ändern")

    raw = await file.read()
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(422, "Datei konnte nicht als Bild geöffnet werden")

    img = img.resize((23, 23), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    hex_value = buf.getvalue().hex().upper()

    sym_field = next((f for f in tpl.fields if f.key == "Symbol"), None)
    if sym_field:
        sym_field.value = hex_value
    else:
        dev_sec = next(
            (f.section for f in tpl.fields if f.section and f.section.startswith("{") and f.section.endswith("}")),
            "",
        )
        max_order = max((f.field_order for f in tpl.fields), default=0) + 1
        db.add(TemplateField(
            template_id=template_id,
            section=dev_sec,
            key="Symbol",
            value=hex_value,
            field_order=max_order,
        ))

    if tpl.raw_content and "Symbol=" in tpl.raw_content:
        lines = tpl.raw_content.splitlines()
        new_lines = []
        for line in lines:
            if line.startswith("Symbol="):
                new_lines.append(f"Symbol={hex_value}")
            else:
                new_lines.append(line)
        tpl.raw_content = "\n".join(new_lines)

    await db.commit()


@router.get("/{template_id}/export")
async def export_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if not tpl.is_public and tpl.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Zugriff verweigert")

    content = tpl.raw_content or serialize(
        [{"section": f.section, "key": f.key, "value": f.value, "field_order": f.field_order}
         for f in tpl.fields]
    )
    safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in tpl.name)
    return Response(
        content=content.encode("utf-8"),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.devt"'},
    )
