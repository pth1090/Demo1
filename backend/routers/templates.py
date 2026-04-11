import io
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from database import get_db
from models import Template, TemplateField
from schemas import (
    TemplateCreate, TemplateUpdate, TemplateSummary, TemplateRead,
    FieldWrite, ParsePreviewResponse, ParsedSection,
)
from services.devt_parser import parse, fields_to_db_rows, extract_device_name, extract_description
from services.devt_serializer import serialize

router = APIRouter(prefix="/templates", tags=["templates"])


def _field_row(template_id: int, fw: dict) -> TemplateField:
    return TemplateField(
        template_id=template_id,
        section=fw.get("section"),
        key=fw["key"],
        value=fw.get("value"),
        field_order=fw.get("field_order", 0),
    )


@router.get("", response_model=list[TemplateSummary])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).order_by(Template.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=TemplateRead, status_code=201)
async def create_template(payload: TemplateCreate, db: AsyncSession = Depends(get_db)):
    tpl = Template(
        name=payload.name,
        description=payload.description,
        raw_content=payload.raw_content,
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
        select(Template).options(selectinload(Template.fields)).where(Template.id == tpl.id)
    )
    return result.scalar_one()


@router.get("/import-preview", response_model=ParsePreviewResponse)
async def parse_preview_get():
    raise HTTPException(405, "Use POST /api/v1/templates/parse-preview")


@router.post("/parse-preview", response_model=ParsePreviewResponse)
async def parse_preview(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8", errors="replace")
    doc = parse(content)
    sections = []
    for sec in doc.sections:
        sec_fields = [{"key": f.key, "value": f.value, "field_order": f.field_order}
                      for f in doc.fields_for(sec)]
        sections.append(ParsedSection(section=sec, fields=sec_fields))
    return ParsePreviewResponse(sections=sections, raw_content=content)


@router.post("/import", response_model=TemplateRead, status_code=201)
async def import_template(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = (await file.read()).decode("utf-8", errors="replace")
    doc = parse(content)
    name = extract_device_name(doc) or file.filename or "Unbenanntes Template"
    description = extract_description(doc)

    # Ensure unique name
    result = await db.execute(select(Template).where(Template.name == name))
    existing = result.scalar_one_or_none()
    if existing:
        name = f"{name} (Import)"

    tpl = Template(name=name, description=description, raw_content=content)
    rows = fields_to_db_rows(doc)
    tpl.fields = [_field_row(0, r) for r in rows]
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == tpl.id)
    )
    return result.scalar_one()


@router.get("/{template_id}", response_model=TemplateRead)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    return tpl


@router.put("/{template_id}", response_model=TemplateRead)
async def update_template(
    template_id: int, payload: TemplateUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")

    if payload.name is not None:
        tpl.name = payload.name
    if payload.description is not None:
        tpl.description = payload.description

    if payload.raw_content is not None:
        tpl.raw_content = payload.raw_content
        # Re-parse fields from new raw_content
        await db.execute(delete(TemplateField).where(TemplateField.template_id == template_id))
        doc = parse(payload.raw_content)
        rows = fields_to_db_rows(doc)
        for r in rows:
            db.add(TemplateField(template_id=template_id, **r))
    elif payload.fields is not None:
        # Update from structured fields
        await db.execute(delete(TemplateField).where(TemplateField.template_id == template_id))
        field_dicts = [f.model_dump() for f in payload.fields]
        for fd in field_dicts:
            db.add(TemplateField(template_id=template_id, **fd))
        # Regenerate raw_content
        tpl.raw_content = serialize(field_dicts, tpl.raw_content)

    await db.commit()
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    return result.scalar_one()


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    await db.delete(tpl)
    await db.commit()


@router.get("/{template_id}/symbol")
async def get_symbol(template_id: int, db: AsyncSession = Depends(get_db)):
    """Return the BMP icon of a template as an image."""
    result = await db.execute(
        select(TemplateField).where(
            TemplateField.template_id == template_id,
            TemplateField.key == "Symbol",
        )
    )
    field = result.scalar_one_or_none()
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
):
    """Replace the BMP icon. Accepts BMP/PNG/JPG — resizes to 23×23 and converts to BMP hex."""
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")

    raw = await file.read()
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(422, "Datei konnte nicht als Bild geöffnet werden")

    img = img.resize((23, 23), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="BMP")
    hex_value = buf.getvalue().hex().upper()

    # Find existing Symbol field or create one
    sym_field = next((f for f in tpl.fields if f.key == "Symbol"), None)
    if sym_field:
        sym_field.value = hex_value
    else:
        # Find device section to attach field to
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

    # Also update raw_content so export stays consistent
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
async def export_template(template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Template).options(selectinload(Template.fields)).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")

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
