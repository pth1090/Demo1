"""
Parser for the HiTec-Zang .devt file format.

Format overview:
  [HiTec-Zang]        - File header
  [{GUID}]            - Device definition section
  [...SIGNAL]         - Signal/channel section (dot-prefix)
  [DeviceList]        - Device index

Special encoding rules:
  - Pipe-separated values:  key=val | key2=val2
  - List encoding:          In.ListCount=2 / In.List0=W / In.List1=X
  - Status blocks:          Status.Count=3 / Status.Value0=0 / Status.Text0=Aus
  - Bilingual fields:       Name= (DE) / Name_ENU= (EN)
  - Symbol field:           BMP hex blob, stored as-is
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field


@dataclass
class DevtField:
    section: str
    key: str
    value: str
    field_order: int = 0


@dataclass
class DevtDocument:
    sections: list[str] = field(default_factory=list)
    fields: list[DevtField] = field(default_factory=list)
    raw_content: str = ""

    def fields_for(self, section: str) -> list[DevtField]:
        return [f for f in self.fields if f.section == section]

    def device_sections(self) -> list[str]:
        return [s for s in self.sections if s.startswith("{") and s.endswith("}")]

    def signal_sections(self) -> list[str]:
        return [s for s in self.sections if s.startswith("...")]


def parse(content: str) -> DevtDocument:
    doc = DevtDocument(raw_content=content)
    current_section = ""
    order = 0

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith(";") or line.startswith("#"):
            continue

        # Section header
        if line.startswith("[") and line.endswith("]"):
            current_section = line[1:-1]
            if current_section not in doc.sections:
                doc.sections.append(current_section)
            continue

        # Key=Value (may contain pipe-separated sub-pairs)
        if "=" in line:
            key, _, rest = line.partition("=")
            key = key.strip()
            rest = rest.strip()

            # Pipe-separated values: key=val | key2=val2 | key3=val3
            if "|" in rest and not key.startswith("Namur."):
                pairs = [p.strip() for p in rest.split("|")]
                # First pair is the primary value for this key
                doc.fields.append(DevtField(
                    section=current_section, key=key, value=pairs[0], field_order=order
                ))
                order += 1
                # Remaining pairs are additional key=value entries
                for extra in pairs[1:]:
                    if "=" in extra:
                        ekey, _, eval_ = extra.partition("=")
                        doc.fields.append(DevtField(
                            section=current_section,
                            key=ekey.strip(),
                            value=eval_.strip(),
                            field_order=order,
                        ))
                        order += 1
            else:
                doc.fields.append(DevtField(
                    section=current_section, key=key, value=rest, field_order=order
                ))
                order += 1

    return doc


def fields_to_db_rows(doc: DevtDocument) -> list[dict]:
    """Convert DevtDocument fields to dicts for TemplateField ORM rows."""
    return [
        {
            "section": f.section,
            "key": f.key,
            "value": f.value,
            "field_order": f.field_order,
        }
        for f in doc.fields
    ]


def extract_device_name(doc: DevtDocument) -> str | None:
    """Return the Name (DE) from the first device section."""
    for sec in doc.device_sections():
        for f in doc.fields_for(sec):
            if f.key == "Name":
                return f.value
    return None


def extract_description(doc: DevtDocument) -> str | None:
    """Return the Description (DE) from the first device section."""
    for sec in doc.device_sections():
        for f in doc.fields_for(sec):
            if f.key == "Description":
                return f.value
    return None
