export interface CurrentUser {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: CurrentUser;
}

export interface Comment {
  id: number;
  body: string;
  created_at: string;
  author: CurrentUser;
}

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
  is_public: boolean;
  owner_id: number;
  owner: CurrentUser;
  created_at: string;
  updated_at: string;
}

export interface Template extends TemplateSummary {
  raw_content: string | null;
  fields: TemplateField[];
  comments: Comment[];
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
