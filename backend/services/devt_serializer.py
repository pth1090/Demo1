"""
Serializer: converts TemplateField rows back into .devt file content.

Reconstructs the original INI-like format preserving section order.
Each field is written as a plain key=value line — no pipe grouping.
"""

from __future__ import annotations
from collections import defaultdict


def serialize(fields: list[dict], raw_content: str | None = None) -> str:
    """
    Rebuild devt content from a list of field dicts.
    Falls back to raw_content if fields list is empty.
    """
    if not fields and raw_content:
        return raw_content

    # Group fields by section, preserving insertion order via field_order
    sections: dict[str, list[dict]] = defaultdict(list)
    for f in sorted(fields, key=lambda x: (x.get("section") or "", x.get("field_order", 0))):
        sections[f.get("section") or ""].append(f)

    lines: list[str] = []
    for section, sec_fields in sections.items():
        if section:
            lines.append(f"[{section}]")
        for f in sec_fields:
            key = f.get("key", "")
            value = f.get("value") or ""
            lines.append(f"{key}={value}")
        lines.append("")  # blank line between sections

    return "\n".join(lines)
