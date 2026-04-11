import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTemplate, useUpdateTemplate, useCreateTemplate } from "../hooks/useTemplates";
import { getExportUrl, getSymbolUrl, updateSymbol } from "../api/client";
import type { TemplateField } from "../types";

type Tab = "overview" | "signals" | "raw";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getField(fields: TemplateField[], section: string | null, key: string): string {
  return fields.find((f) => f.section === section && f.key === key)?.value ?? "";
}

/** Returns the main device section: [{GUID}] — starts with { and ends with } */
function deviceSection(fields: TemplateField[]): string | null {
  const s = fields.find(
    (f) => f.section?.startsWith("{") && f.section.endsWith("}")
  )?.section;
  return s ?? null;
}

/** Returns all signal sections: [{GUID}.SIGNAL_NAME] — starts with { and contains . */
function signalSections(fields: TemplateField[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const f of fields) {
    if (f.section?.startsWith("{") && f.section.includes(".") && !seen.has(f.section)) {
      seen.add(f.section);
      result.push(f.section);
    }
  }
  return result;
}

/** Extract display name from signal section: '{GUID}.COM_ERR' → 'COM_ERR' */
function signalDisplayName(section: string): string {
  const dot = section.indexOf(".");
  return dot >= 0 ? section.slice(dot + 1) : section;
}

function buildList(fields: TemplateField[], section: string | null, prefix: string): string[] {
  const count = parseInt(getField(fields, section, `${prefix}.ListCount`) || "0", 10);
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(getField(fields, section, `${prefix}.List${i}`));
  }
  return result;
}

function buildStatusList(
  fields: TemplateField[],
  section: string | null
): { value: string; textDe: string; textEn: string }[] {
  const count = parseInt(getField(fields, section, "Status.Count") || "0", 10);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push({
      value: getField(fields, section, `Status.Value${i}`),
      textDe: getField(fields, section, `Status.Text${i}`),
      textEn: getField(fields, section, `Status.Text_ENU${i}`),
    });
  }
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const templateId = isNew ? null : parseInt(id ?? "0", 10);

  const { data: template, isLoading, refetch } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();
  const createTemplate = useCreateTemplate();

  const [tab, setTab] = useState<Tab>("overview");
  const [lang, setLang] = useState<"de" | "en">("de");
  const [dirty, setDirty] = useState(false);

  // Editable field state (flat map: "section::key" → value)
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Selected signal for detail view
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);

  // New template form
  const [newName, setNewName] = useState("");

  // Symbol upload
  const symbolInputRef = useRef<HTMLInputElement>(null);
  const [symbolUploading, setSymbolUploading] = useState(false);
  const [symbolKey, setSymbolKey] = useState(0); // increment to force img reload

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
      const map: Record<string, string> = {};
      for (const f of template.fields) {
        map[`${f.section ?? ""}::${f.key}`] = f.value ?? "";
      }
      setFieldMap(map);
      setDirty(false);
    }
  }, [template]);

  const fieldVal = (section: string | null, key: string) =>
    fieldMap[`${section ?? ""}::${key}`] ?? "";

  const setFieldVal = (section: string | null, key: string, val: string) => {
    setFieldMap((prev) => ({ ...prev, [`${section ?? ""}::${key}`]: val }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!template && !isNew) return;

    if (isNew) {
      if (!newName.trim()) { alert("Bitte einen Namen eingeben."); return; }
      await createTemplate.mutateAsync({ name: newName.trim(), description: description || undefined });
      navigate("/");
      return;
    }

    const fields = (template?.fields ?? []).map((f) => ({
      section: f.section,
      key: f.key,
      value: fieldMap[`${f.section ?? ""}::${f.key}`] ?? f.value ?? "",
      field_order: f.field_order,
    }));

    await updateTemplate.mutateAsync({
      id: templateId!,
      data: { name, description: description || undefined, fields },
    });
    setDirty(false);
  };

  const handleSymbolUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !templateId) return;
    setSymbolUploading(true);
    try {
      await updateSymbol(templateId, file);
      setSymbolKey((k) => k + 1); // force img element to reload
      await refetch();
    } catch {
      alert("Fehler beim Hochladen des Icons.");
    } finally {
      setSymbolUploading(false);
      e.target.value = "";
    }
  };

  const devSec = template ? deviceSection(template.fields) : null;
  const signals = template ? signalSections(template.fields) : [];
  const inChannels = template ? buildList(template.fields, devSec, "In") : [];
  const outChannels = template ? buildList(template.fields, devSec, "Out") : [];
  const statusList = template ? buildStatusList(template.fields, devSec) : [];
  const hasSymbol = template?.fields.some((f) => f.key === "Symbol" && f.value);

  // ── New template form ──────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="min-h-screen bg-gray-50">
        <EditorHeader
          title="Neues Template"
          dirty={false}
          saving={createTemplate.isPending}
          onSave={handleSave}
          onBack={() => navigate("/")}
        />
        <main className="max-w-2xl mx-auto px-6 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <FormField label="Name *">
              <input
                className={inputCls}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Bronkhorst MiniCori Standard"
              />
            </FormField>
            <FormField label="Beschreibung">
              <textarea
                className={`${inputCls} resize-none`}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
        Lade Template...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
        Template nicht gefunden.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <EditorHeader
        title={name}
        dirty={dirty}
        saving={updateTemplate.isPending}
        onSave={handleSave}
        onBack={() => navigate("/")}
        exportUrl={getExportUrl(template.id)}
        exportName={name}
        lang={lang}
        onLangToggle={() => setLang((l) => (l === "de" ? "en" : "de"))}
      />

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0 max-w-5xl mx-auto">
          {(["overview", "signals", "raw"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "overview" ? "Übersicht" : t === "signals" ? `Signale (${signals.length})` : "Raw-Inhalt"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Basic info */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-start gap-4 mb-4">
                  {/* BMP Icon */}
                  <div className="shrink-0">
                    <div
                      className="w-16 h-16 border border-gray-200 rounded bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                      title="Klicken zum Ändern"
                      onClick={() => symbolInputRef.current?.click()}
                    >
                      {hasSymbol ? (
                        <img
                          key={symbolKey}
                          src={`${getSymbolUrl(template.id)}?v=${symbolKey}`}
                          alt="Template-Icon"
                          className="w-full h-full object-contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <span className="text-gray-300 text-xs text-center leading-tight px-1">Kein Icon</span>
                      )}
                    </div>
                    <button
                      onClick={() => symbolInputRef.current?.click()}
                      disabled={symbolUploading}
                      className="mt-1 w-16 text-xs text-center text-blue-600 hover:text-blue-700 disabled:opacity-50"
                    >
                      {symbolUploading ? "..." : "Ändern"}
                    </button>
                    <input
                      ref={symbolInputRef}
                      type="file"
                      accept=".bmp,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={handleSymbolUpload}
                    />
                  </div>

                  {/* Name + Description */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <FormField label="Name">
                      <input
                        className={inputCls}
                        value={name}
                        onChange={(e) => { setName(e.target.value); setDirty(true); }}
                      />
                    </FormField>
                    <FormField label={lang === "de" ? "Beschreibung (DE)" : "Beschreibung (EN)"}>
                      <textarea
                        className={`${inputCls} resize-none`}
                        rows={2}
                        value={lang === "de"
                          ? fieldVal(devSec, "Description")
                          : fieldVal(devSec, "Description_ENU")}
                        onChange={(e) =>
                          setFieldVal(devSec, lang === "de" ? "Description" : "Description_ENU", e.target.value)
                        }
                      />
                    </FormField>
                  </div>
                </div>

                <div className="space-y-2">
                  <FormField label="Klasse">
                    <input className={inputCls} value={fieldVal(devSec, "ClassName")} readOnly />
                  </FormField>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Gerätetyp">
                      <input className={inputCls} value={fieldVal(devSec, "DeviceType")}
                        onChange={(e) => setFieldVal(devSec, "DeviceType", e.target.value)} />
                    </FormField>
                    <FormField label="Protokoll">
                      <input className={inputCls} value={fieldVal(devSec, "Protocol")}
                        onChange={(e) => setFieldVal(devSec, "Protocol", e.target.value)} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="IP-Adresse">
                      <input className={inputCls} value={fieldVal(devSec, "mpIpAddr")}
                        onChange={(e) => setFieldVal(devSec, "mpIpAddr", e.target.value)} />
                    </FormField>
                    <FormField label="IP-Port">
                      <input className={inputCls} value={fieldVal(devSec, "mpIpPort")}
                        onChange={(e) => setFieldVal(devSec, "mpIpPort", e.target.value)} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField label="Baud">
                      <input className={inputCls} value={fieldVal(devSec, "mpSSBaud")}
                        onChange={(e) => setFieldVal(devSec, "mpSSBaud", e.target.value)} />
                    </FormField>
                    <FormField label="Parity">
                      <input className={inputCls} value={fieldVal(devSec, "mpSSParity")}
                        onChange={(e) => setFieldVal(devSec, "mpSSParity", e.target.value)} />
                    </FormField>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Channels + Status */}
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-3">Kanäle</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Eingänge ({inChannels.length})</p>
                    <div className="space-y-1">
                      {inChannels.length === 0
                        ? <span className="text-gray-400 text-sm">—</span>
                        : inChannels.map((ch) => {
                          const sec = signals.find((s) => s.endsWith(`.${ch}`));
                          return (
                            <span key={ch}
                              className="block text-sm px-2 py-1 bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-blue-100"
                              onClick={() => { if (sec) { setTab("signals"); setSelectedSignal(sec); } }}
                            >{ch}</span>
                          );
                        })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-2">Ausgänge ({outChannels.length})</p>
                    <div className="space-y-1">
                      {outChannels.length === 0
                        ? <span className="text-gray-400 text-sm">—</span>
                        : outChannels.map((ch) => {
                          const sec = signals.find((s) => s.endsWith(`.${ch}`));
                          return (
                            <span key={ch}
                              className="block text-sm px-2 py-1 bg-green-50 text-green-700 rounded cursor-pointer hover:bg-green-100"
                              onClick={() => { if (sec) { setTab("signals"); setSelectedSignal(sec); } }}
                            >{ch}</span>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>

              {statusList.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5">
                  <h2 className="font-semibold text-gray-800 mb-3">Status-Werte</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b">
                        <th className="text-left pb-1 font-medium">Wert</th>
                        <th className="text-left pb-1 font-medium">Text DE</th>
                        <th className="text-left pb-1 font-medium">Text EN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusList.map((s, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1 font-mono text-gray-700">{s.value}</td>
                          <td className="py-1 text-gray-700">{s.textDe}</td>
                          <td className="py-1 text-gray-500">{s.textEn}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Signals Tab ── */}
        {tab === "signals" && (
          <div className="flex gap-6">
            {/* Signal list */}
            <div className="w-48 shrink-0">
              <h2 className="text-xs font-medium text-gray-500 uppercase mb-2">
                Signale ({signals.length})
              </h2>
              <div className="space-y-1">
                {signals.map((sig) => (
                  <button
                    key={sig}
                    onClick={() => setSelectedSignal(sig)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      selectedSignal === sig
                        ? "bg-blue-600 text-white"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {signalDisplayName(sig)}
                  </button>
                ))}
                {signals.length === 0 && (
                  <p className="text-gray-400 text-sm">Keine Signale gefunden.</p>
                )}
              </div>
            </div>

            {/* Signal detail */}
            {selectedSignal && (
              <div className="flex-1 bg-white rounded-lg border border-gray-200 p-5 overflow-auto">
                <h2 className="font-semibold text-gray-800 mb-4">
                  Signal:{" "}
                  <span className="font-mono text-blue-700">{signalDisplayName(selectedSignal)}</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {template.fields
                    .filter((f) => f.section === selectedSignal)
                    .map((f) => (
                      <FormField key={f.key} label={f.key}>
                        <input
                          className={`${inputCls} ${f.key.startsWith("Namur.") || f.key.startsWith("mp") ? "font-mono text-xs" : ""}`}
                          value={fieldVal(selectedSignal, f.key)}
                          onChange={(e) => setFieldVal(selectedSignal, f.key, e.target.value)}
                        />
                      </FormField>
                    ))}
                </div>
              </div>
            )}

            {!selectedSignal && signals.length > 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Signal auswählen
              </div>
            )}
          </div>
        )}

        {/* ── Raw Tab ── */}
        {tab === "raw" && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-3">
              Originaler Datei-Inhalt (nur zur Ansicht — Änderungen über die Formular-Tabs vornehmen).
            </p>
            <pre className="text-xs font-mono bg-gray-50 rounded p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap border border-gray-200">
              {template.raw_content ?? "(kein Rohinhalt gespeichert)"}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function EditorHeader({
  title, dirty, saving, onSave, onBack, exportUrl, exportName, lang, onLangToggle,
}: {
  title: string;
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onBack: () => void;
  exportUrl?: string;
  exportName?: string;
  lang?: "de" | "en";
  onLangToggle?: () => void;
}) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
      <button onClick={onBack} className="p-1.5 text-gray-500 hover:text-gray-700 rounded">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">HZ</span>
        </div>
        <span className="font-semibold text-gray-900 truncate">{title}</span>
        {dirty && (
          <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Ungespeicherte Änderungen" />
        )}
      </div>
      <div className="flex items-center gap-2">
        {onLangToggle && (
          <button
            onClick={onLangToggle}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            title="Sprache umschalten"
          >
            {lang === "de" ? "DE" : "EN"}
          </button>
        )}
        {exportUrl && (
          <a
            href={exportUrl}
            download={`${exportName ?? "template"}.devt`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
          >
            Export .devt
          </a>
        )}
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Speichern..." : "Speichern"}
        </button>
      </div>
    </header>
  );
}
