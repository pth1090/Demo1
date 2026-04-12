from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Template, Comment
from schemas import CommentCreate, CommentRead
from auth import get_current_user

router = APIRouter(tags=["comments"])


async def _get_visible_template(template_id: int, current_user, db: AsyncSession) -> Template:
    """Return template if visible to current_user, else 404/403."""
    result = await db.execute(
        select(Template).where(Template.id == template_id)
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template nicht gefunden")
    if not tpl.is_public and tpl.owner_id != current_user.id:
        raise HTTPException(403, "Zugriff verweigert")
    return tpl


@router.get("/templates/{template_id}/comments", response_model=list[CommentRead])
async def list_comments(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _get_visible_template(template_id, current_user, db)
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.template_id == template_id)
        .order_by(Comment.created_at.asc())
    )
    return result.scalars().all()


@router.post("/templates/{template_id}/comments", response_model=CommentRead, status_code=201)
async def create_comment(
    template_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await _get_visible_template(template_id, current_user, db)
    comment = Comment(
        template_id=template_id,
        author_id=current_user.id,
        body=payload.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    # Reload with author relationship
    result = await db.execute(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    return result.scalar_one()


@router.delete("/templates/{template_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    template_id: int,
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.template_id == template_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(404, "Kommentar nicht gefunden")
    if comment.author_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Nur der Autor oder ein Admin darf löschen")
    await db.delete(comment)
    await db.commit()
