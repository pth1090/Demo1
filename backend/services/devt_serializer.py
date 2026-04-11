"""
Serializer: converts TemplateField rows back into .devt file content.

Reconstructs the original INI-like format preserving section order.
Pipe-separated fields (same section, consecutive) are re-joined where
they originated from a single line (detected by shared base key grouping).
"""

from __future__ import annotations
from collections import defaultdict


PIPE_GROUPED_PREFIXES = {"WorkAreaMin", "WorkAreaMax", "WorkAreaStep", "Postdecimal",
                         "Unit", "Optional", "ValueType", "Direction", "LoadLastValue",
                         "InitValue"}


def serialize(fields: list[dict], raw_content: str | None = None) -> str:
    """
    Rebuild devt content from a list of field dicts.
    Falls back to raw_content if fields list is empty.
    """
    if not fields and raw_content:
        return raw_content

    # Group by section, preserving insertion order
    sections: dict[str, list[dict]] = defaultdict(list)
    for f in sorted(fields, key=lambda x: (x.get("section") or "", x.get("field_order", 0))):
        sections[f.get("section") or ""].append(f)

    lines: list[str] = []
    for section, sec_fields in sections.items():
        if section:
            lines.append(f"[{section}]")
        # Detect which keys belong to a pipe-group (same conceptual line)
        # Simple heuristic: if the key is in PIPE_GROUPED_PREFIXES it gets
        # appended to the previous line with " | " instead of a new line.
        pending_pipe: list[str] = []
        for f in sec_fields:
            key = f.get("key", "")
            value = f.get("value") or ""
            entry = f"{key}={value}"
            if key in PIPE_GROUPED_PREFIXES and pending_pipe:
                pending_pipe.append(entry)
            else:
                if pending_pipe:
                    lines.append(" | ".join(pending_pipe))
                    pending_pipe = []
                pending_pipe = [entry]
        if pending_pipe:
            lines.append(" | ".join(pending_pipe))
        lines.append("")  # blank line between sections

    return "\n".join(lines)
