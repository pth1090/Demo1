export interface TemplateField {
  id: number;
  section: string | null;
  key: string;
  value: string | null;
  field_order: number;
}

export interface TemplateSummary {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Template extends TemplateSummary {
  raw_content: string | null;
  fields: TemplateField[];
}

export interface FieldDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options: string[] | null;
}

export interface SchemaConfig {
  id: number;
  name: string;
  format_type: string;
  kv_separator: string;
  comment_chars: string;
  field_defs: FieldDef[] | null;
  is_default: number;
}

export interface ParsedSection {
  section: string;
  fields: { key: string; value: string; field_order: number }[];
}

export interface ParsePreviewResponse {
  sections: ParsedSection[];
  raw_content: string;
}
