import axios from "axios";
import type { Template, TemplateSummary, SchemaConfig, ParsePreviewResponse } from "../types";

const api = axios.create({ baseURL: "/api/v1" });

// ── Templates ──────────────────────────────────────────────────────────────────

export const getTemplates = (): Promise<TemplateSummary[]> =>
  api.get("/templates").then((r) => r.data);

export const getTemplate = (id: number): Promise<Template> =>
  api.get(`/templates/${id}`).then((r) => r.data);

export const createTemplate = (data: {
  name: string;
  description?: string;
  raw_content?: string;
}): Promise<Template> => api.post("/templates", data).then((r) => r.data);

export const updateTemplate = (
  id: number,
  data: {
    name?: string;
    description?: string;
    fields?: { section: string | null; key: string; value: string | null; field_order: number }[];
  }
): Promise<Template> => api.put(`/templates/${id}`, data).then((r) => r.data);

export const deleteTemplate = (id: number): Promise<void> =>
  api.delete(`/templates/${id}`).then(() => undefined);

export const importTemplate = (file: File): Promise<Template> => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/templates/import", form).then((r) => r.data);
};

export const parsePreview = (file: File): Promise<ParsePreviewResponse> => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/templates/parse-preview", form).then((r) => r.data);
};

export const getExportUrl = (id: number): string => `/api/v1/templates/${id}/export`;

export const getSymbolUrl = (id: number): string => `/api/v1/templates/${id}/symbol`;

export const updateSymbol = (id: number, file: File): Promise<void> => {
  const form = new FormData();
  form.append("file", file);
  return api.put(`/templates/${id}/symbol`, form).then(() => undefined);
};

// ── Schema Configs ─────────────────────────────────────────────────────────────

export const getSchemaConfigs = (): Promise<SchemaConfig[]> =>
  api.get("/schema-configs").then((r) => r.data);

export const getSchemaConfig = (id: number): Promise<SchemaConfig> =>
  api.get(`/schema-configs/${id}`).then((r) => r.data);

export const createSchemaConfig = (data: Omit<SchemaConfig, "id">): Promise<SchemaConfig> =>
  api.post("/schema-configs", data).then((r) => r.data);

export const updateSchemaConfig = (
  id: number,
  data: Omit<SchemaConfig, "id">
): Promise<SchemaConfig> => api.put(`/schema-configs/${id}`, data).then((r) => r.data);

export const deleteSchemaConfig = (id: number): Promise<void> =>
  api.delete(`/schema-configs/${id}`).then(() => undefined);

export const applySchemaConfig = (id: number): Promise<{ updated: number }> =>
  api.post(`/schema-configs/${id}/apply`).then((r) => r.data);
