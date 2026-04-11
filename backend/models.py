from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    fields: Mapped[list["TemplateField"]] = relationship(
        "TemplateField", back_populates="template", cascade="all, delete-orphan"
    )


class TemplateField(Base):
    __tablename__ = "template_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    section: Mapped[str | None] = mapped_column(String(255), nullable=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    field_order: Mapped[int] = mapped_column(Integer, default=0)

    template: Mapped["Template"] = relationship("Template", back_populates="fields")


class SchemaConfig(Base):
    __tablename__ = "schema_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    format_type: Mapped[str] = mapped_column(String(50), default="ini")
    kv_separator: Mapped[str] = mapped_column(String(10), default="=")
    comment_chars: Mapped[str] = mapped_column(String(10), default="#;")
    field_defs: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[int] = mapped_column(Integer, default=0)
