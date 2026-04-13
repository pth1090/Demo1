import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useSchemaConfigs,
  useUpdateSchemaConfig,
  useDeleteSchemaConfig,
  useApplySchemaConfig,
} from "../hooks/useSchemaConfig";
import type { SchemaConfig, FieldDef } from "../types";

const FIELD_TYPES = ["text", "integer", "float", "boolean", "select", "textarea"];

export default function SchemaConfigPanel() {
  const navigate = useNavigate();
  const { data: configs, isLoading } = useSchemaConfigs();
  const updateConfig = useUpdateSchemaConfig();
  const deleteConfig = useDeleteSchemaConfig();
  const applyConfig = useApplySchemaConfig();

  const [editing, setEditing] = useState<(Omit<SchemaConfig, "id"> & { id?: number }) | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  const startEdit = (cfg: SchemaConfig) =>
    setEditing({ ...cfg, field_defs: cfg.field_defs ?? [] });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { alert("Name erforderlich."); return; }
    const data = { ...editing, field_defs: editing.field_defs ?? [] };
    if (editing.id) {
      await updateConfig.mutateAsync({ id: editing.id, data });
    }
    setEditing(null);
  };

  const handleDelete = async (cfg: SchemaConfig) => {
    if (!confirm(`Konfiguration "${cfg.name}" löschen?`)) return;
    await deleteConfig.mutateAsync(cfg.id);
  };

  const handleApply = async (id: number) => {
    const result = await applyConfig.mutateAsync(id);
    setApplyMsg(`${result.updated} Templates neu geparst.`);
    setTimeout(() => setApplyMsg(null), 3000);
  };

  const addFieldDef = () =>
    setEditing((prev) =>
      prev
        ? { ...prev, field_defs: [...(prev.field_defs ?? []), { key: "", label: "", type: "text", required: false, options: null }] }
        : prev
    );

  const updateFieldDef = (i: number, patch: Partial<FieldDef>) =>
    setEditing((prev) =>
      prev
        ? { ...prev, field_defs: (prev.field_defs ?? []).map((fd, idx) => idx === i ? { ...fd, ...patch } : fd) }
        : prev
    );

  const removeFieldDef = (i: number) =>
    setEditing((prev) =>
      prev ? { ...prev, field_defs: (prev.field_defs ?? []).filter((_, idx) => idx !== i) } : prev
    );

  const inputCls = "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-1.5 text-gray-500 hover:text-gray-700 rounded">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">HZ</span>
        </div>
        <span className="font-semibold text-gray-900">Schema-Konfigurationen</span>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {applyMsg && (
          <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            {applyMsg}
          </div>
        )}

        {!editing ? (
          <>
            {isLoading && <p className="text-gray-500 text-center py-8">Lade...</p>}
            {!isLoading && (configs ?? []).length === 0 && (
              <p className="text-gray-400 text-center py-8">
                Noch keine Schema-Konfigurationen vorhanden.
              </p>
            )}

            <div className="space-y-3">
              {(configs ?? []).map((cfg) => (
                <div key={cfg.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{cfg.name}</span>
                        {cfg.is_default === 1 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Standard
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Format: {cfg.format_type} · Separator: "{cfg.kv_separator}" ·{" "}
                        {(cfg.field_defs ?? []).length} Felder definiert
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApply(cfg.id)}
                        disabled={applyConfig.isPending}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        title="Alle Templates neu parsen"
                      >
                        Anwenden
                      </button>
                      <button
                        onClick={() => startEdit(cfg)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDelete(cfg)}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Edit form */
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-5">
              Konfiguration bearbeiten
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Format</label>
                <select className={inputCls} value={editing.format_type} onChange={(e) => setEditing({ ...editing, format_type: e.target.value })}>
                  <option value="ini">INI (Sektionen)</option>
                  <option value="kv">Key=Value (flach)</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trenner</label>
                <input className={inputCls} value={editing.kv_separator} onChange={(e) => setEditing({ ...editing, kv_separator: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={editing.is_default === 1}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked ? 1 : 0 })}
                  className="rounded"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700">Als Standard setzen</label>
              </div>
            </div>

            {/* Field definitions */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Felddefinitionen</h3>
                <button onClick={addFieldDef} className="text-xs text-blue-600 hover:text-blue-700">
                  + Feld hinzufügen
                </button>
              </div>
              {(editing.field_defs ?? []).length === 0 && (
                <p className="text-xs text-gray-400 py-2">Keine Felder — Felder werden aus der Datei übernommen.</p>
              )}
              <div className="space-y-2">
                {(editing.field_defs ?? []).map((fd, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 bg-gray-50 rounded">
                    <div className="flex-1">
                      <input
                        className={inputCls}
                        placeholder="Schlüssel (z.B. MODE)"
                        value={fd.key}
                        onChange={(e) => updateFieldDef(i, { key: e.target.value })}
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        className={inputCls}
                        placeholder="Label (z.B. Betriebsmodus)"
                        value={fd.label}
                        onChange={(e) => updateFieldDef(i, { label: e.target.value })}
                      />
                    </div>
                    <div className="w-28">
                      <select className={inputCls} value={fd.type} onChange={(e) => updateFieldDef(i, { type: e.target.value })}>
                        {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-1 pt-1">
                      <input type="checkbox" checked={fd.required} onChange={(e) => updateFieldDef(i, { required: e.target.checked })} />
                      <span className="text-xs text-gray-500">Pflicht</span>
                    </div>
                    <button onClick={() => removeFieldDef(i)} className="text-red-400 hover:text-red-600 pt-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={createConfig.isPending || updateConfig.isPending}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
