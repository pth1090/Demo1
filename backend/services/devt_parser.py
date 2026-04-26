"""
Parser for the HaiFisch .devt file format.

Format overview:
  [HiTec-Zang]              - File header (SavedWithVersion, ExportDate)
  [{GUID}]                  - Device definition section (main parameters)
  [{GUID}.SIGNAL_NAME]      - Signal/channel section
  [DeviceList]              - Device index

Special encoding rules:
  - List encoding:    In.ListCount=2 / In.List0=W / In.List1=X
  - Status blocks:    Status.Count=3 / Status.Value0=0 / Status.Text0=Aus
  - Namur commands:   Namur.Count=1 / Namur.mpNXSendStr0=:06...
  - Bilingual fields: Name= (DE) / Name_ENU= (EN)
  - Symbol field:     BMP data as uppercase hex string
"""

from __future__ import annotations
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
        """Sections of the form {GUID} — no dot, ends with }."""
        return [s for s in self.sections if s.startswith("{") and s.endswith("}")]

    def signal_sections(self) -> list[str]:
        """Sections of the form {GUID}.SIGNAL_NAME."""
        return [s for s in self.sections if s.startswith("{") and "." in s]

    def signal_name(self, section: str) -> str:
        """Extract the signal name: '{GUID}.W' → 'W'."""
        dot = section.find(".")
        return section[dot + 1:] if dot >= 0 else section


def parse(content: str) -> DevtDocument:
    doc = DevtDocument(raw_content=content)
    current_section = ""
    order = 0

    for raw_line in content.splitlines():
        line = raw_line.strip()

        # Skip blank lines and comment lines (lines that start with ; or #)
        if not line or line.startswith(";"):
            continue
        # Lines starting with # are comments ONLY if no = present
        # (LargeDescription values contain #13#10 escape sequences)
        if line.startswith("#") and "=" not in line:
            continue

        # Section header
        if line.startswith("[") and line.endswith("]"):
            current_section = line[1:-1]
            if current_section not in doc.sections:
                doc.sections.append(current_section)
            continue

        # Key=Value — split only on first = to preserve = in values
        if "=" in line:
            key, _, value = line.partition("=")
            doc.fields.append(DevtField(
                section=current_section,
                key=key.strip(),
                value=value,   # preserve trailing whitespace / escape sequences as-is
                field_order=order,
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
