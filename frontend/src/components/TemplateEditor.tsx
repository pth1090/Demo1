import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTemplate, useUpdateTemplate, useCreateTemplate } from "../hooks/useTemplates";
import { getExportUrl, setTemplateVisibility, forkTemplate } from "../api/client";
import { bmpHexToPngDataUrl, imageFileToBmpHex } from "../utils/bmp";
import { useAuth } from "../hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import CommentsPanel from "./CommentsPanel";
import type { TemplateField } from "../types";

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction = "2" | "4" | "onoff";
type FilterType = "all" | "read" | "write" | "onoff";

interface NamurCmd {
  pos: string;
  recStr: string;
  recType: string;
  sendStr: string;
  sendType: string;
  size: string;
}

interface Pin {
  id: string;
  name: string;
  desc_de: string;
  desc_en: string;
  direction: Direction;
  unit: string;
  optional: string;
  saveHisto: string;
  loadLastValue: string;
  initValue: string;
  postdec: string;
  workAreaMin: string;
  workAreaMax: string;
  workAreaMaxNoCut: string;
  deltaX: string;
  deltaT: string;
  scaleMin: string;
  scaleMax: string;
  skaliert: string;
  filterArt: string;
  filterFactor: string;
  assignType: string;
  masterPin: string;
  className: string;
  devID: string;
  valueType: string;
  namur: NamurCmd[];
}

type SaveField = { section: string | null; key: string; value: string | null; field_order: number };

// ── Pure helpers ──────────────────────────────────────────────────────────────

function deviceSection(fields: TemplateField[]): string | null {
  return (
    fields.find((f) => f.section?.startsWith("{") && f.section.endsWith("}"))?.section ?? null
  );
}

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

function signalDisplayName(section: string): string {
  const dot = section.indexOf(".");
  return dot >= 0 ? section.slice(dot + 1) : section;
}

function getF(secFields: TemplateField[], key: string): string {
  return secFields.find((f) => f.key === key)?.value ?? "";
}

function extractPin(section: string, allFields: TemplateField[]): Pin {
  const sf = allFields.filter((f) => f.section === section);
  const g = (k: string) => getF(sf, k);
  const namurCount = Math.max(1, parseInt(g("Namur.Count") || "1", 10));
  const namur: NamurCmd[] = Array.from({ length: namurCount }, (_, i) => ({
    pos: g(`Namur.mpNXPos${i}`),
    recStr: g(`Namur.mpNXRecStr${i}`),
    recType: g(`Namur.mpNXRecType${i}`) || "0",
    sendStr: g(`Namur.mpNXSendStr${i}`),
    sendType: g(`Namur.mpNXSendType${i}`) || "0",
    size: g(`Namur.mpNXSize${i}`) || "0",
  }));
  const isOnOff = g("mpNXAssignType") === "5";
  const direction: Direction = isOnOff ? "onoff" : g("Direction") === "4" ? "4" : "2";
  return {
    id: `${section}-${Math.random().toString(36).slice(2)}`,
    name: signalDisplayName(section),
    desc_de: g("Description"),
    desc_en: g("Description_ENU"),
    direction,
    unit: g("Unit"),
    optional: g("Optional") || "1",
    saveHisto: g("SaveHisto") || "0",
    loadLastValue: g("LoadLastValue") || "0",
    initValue: g("InitValue"),
    postdec: g("Postdecimal") || "0",
    workAreaMin: g("WorkAreaMin") || "0",
    workAreaMax: g("WorkAreaMax") || "1000000",
    workAreaMaxNoCut: g("WorkAreaMaxNoCut"),
    deltaX: g("DeltaX") || "0",
    deltaT: g("DeltaT") || "60000",
    scaleMin: g("mpSkalierungMMin") || "0",
    scaleMax: g("mpSkalierungMMax") || "1",
    skaliert: g("mpSkaliert") || "0",
    filterArt: g("mpFilterArt") || "0",
    filterFactor: g("mpFilterFactor") || "0",
    assignType: g("mpNXAssignType") || "0",
    masterPin: g("mpNXMasterPin") || "",
    className: g("ClassName") || "TPool_NX_Class",
    devID: g("mpDevID") || "",
    valueType: g("ValueType") || "131072",
    namur,
  };
}

function pinToFields(pin: Pin, devSec: string): SaveField[] {
  const sec = `${devSec}.${pin.name}`;
  const fields: SaveField[] = [];
  let o = 0;
  const a = (key: string, value: string | null) =>
    fields.push({ section: sec, key, value, field_order: o++ });

  a("ClassName", pin.className);
  a("mpBaseDevId", "");
  a("mpDevID", pin.devID);
  a("mpFilterArt", pin.filterArt);
  a("mpFilterFactor", pin.filterFactor);
  a("mpNXAssignType", pin.direction === "onoff" ? "5" : pin.assignType);
  a("mpNXMasterPin", pin.masterPin);
  a("mpScaleRef", "");
  const scaled = parseFloat(pin.scaleMax) !== 1 || parseFloat(pin.scaleMin) !== 0;
  a("mpSkaliert", scaled ? "1" : "0");
  a("mpSkalierungMMax", pin.scaleMax);
  a("mpSkalierungMMin", pin.scaleMin);
  a("mpSkalierungPMax", "1");
  a("mpSkalierungPMin", "0");
  a("Namur.Count", String(pin.namur.length));
  pin.namur.forEach((n, i) => {
    a(`Namur.mpNXPos${i}`, n.pos);
    a(`Namur.mpNXRecStr${i}`, n.recStr);
    a(`Namur.mpNXRecType${i}`, n.recType);
    a(`Namur.mpNXSendStr${i}`, n.sendStr);
    a(`Namur.mpNXSendType${i}`, n.sendType);
    a(`Namur.mpNXSize${i}`, n.size);
  });
  a("Description", pin.desc_de);
  a("Description_ENU", pin.desc_en);
  a("Optional", pin.optional);
  if (pin.saveHisto === "1") a("SaveHisto", "1");
  a("Protocol", "1");
  a("ValueType", pin.valueType);
  a("Direction", pin.direction === "onoff" ? "4" : pin.direction);
  if (pin.unit) a("Unit", pin.unit);
  a("WorkAreaMin", pin.workAreaMin);
  a("WorkAreaMax", pin.workAreaMax);
  if (pin.workAreaMaxNoCut) a("WorkAreaMaxNoCut", pin.workAreaMaxNoCut);
  a("DeltaX", pin.deltaX);
  a("DeltaT", pin.deltaT);
  if (pin.postdec && pin.postdec !== "0") a("Postdecimal", pin.postdec);
  if (pin.initValue) a("InitValue", pin.initValue);
  if (pin.loadLastValue === "1") a("LoadLastValue", "1");
  return fields;
}

function newPin(devSec: string): Pin {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    name: "NEW",
    desc_de: "Neuer Datenpunkt",
    desc_en: "New data point",
    direction: "2",
    unit: "",
    optional: "1",
    saveHisto: "1",
    loadLastValue: "0",
    initValue: "",
    postdec: "2",
    workAreaMin: "0",
    workAreaMax: "1000000",
    workAreaMaxNoCut: "",
    deltaX: "0",
    deltaT: "60000",
    scaleMin: "0",
    scaleMax: "1",
    skaliert: "0",
    filterArt: "0",
    filterFactor: "0",
    assignType: "0",
    masterPin: "",
    className: "TPool_NX_Class",
    devID: "{9D6CBDD3-C36D-4395-A191-B65EC0897D6D}",
    valueType: "131072",
    namur: [{ pos: "11", recStr: "%X", recType: "2", sendStr: "", sendType: "0", size: "0" }],
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isNew = id === "new";
  const templateId = isNew ? null : parseInt(id ?? "0", 10);

  const { data: template, isLoading } = useTemplate(templateId);
  const updateTemplate = useUpdateTemplate();
  const createTemplate = useCreateTemplate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [templateName, setTemplateName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [visibilityPending, setVisibilityPending] = useState(false);
  const [forkPending, setForkPending] = useState(false);
  const [devSec, setDevSec] = useState<string | null>(null);
  const [devFieldMap, setDevFieldMap] = useState<Record<string, string>>({});
  const [pins, setPins] = useState<Pin[]>([]);
  const [symbolHex, setSymbolHex] = useState<string | null>(null);
  const [iconDataUrl, setIconDataUrl] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState(""); // for "new template" form
  const iconInputRef = useRef<HTMLInputElement>(null);

  // ── Load template into state ───────────────────────────────────────────────
  useEffect(() => {
    if (!template) return;
    setTemplateName(template.name);
    setDirty(false);

    const ds = deviceSection(template.fields);
    setDevSec(ds);

    const dfm: Record<string, string> = {};
    for (const f of template.fields.filter((f) => f.section === ds)) {
      dfm[f.key] = f.value ?? "";
    }
    setDevFieldMap(dfm);

    const sym = dfm["Symbol"] ?? null;
    setSymbolHex(sym);
    setIconDataUrl(sym ? bmpHexToPngDataUrl(sym) : null);

    setPins(signalSections(template.fields).map((sec) => extractPin(sec, template.fields)));
    setIsPublic(template.is_public);
  }, [template]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const mark = () => setDirty(true);

  const setDev = (key: string, value: string) => {
    setDevFieldMap((prev) => ({ ...prev, [key]: value }));
    mark();
  };

  const setPin = (pinId: string, patch: Partial<Pin>) =>
    setPins((prev) => prev.map((p) => (p.id === pinId ? { ...p, ...patch } : p)));

  const setNamur = (pinId: string, idx: number, patch: Partial<NamurCmd>) =>
    setPins((prev) =>
      prev.map((p) =>
        p.id === pinId
          ? { ...p, namur: p.namur.map((n, i) => (i === idx ? { ...n, ...patch } : n)) }
          : p
      )
    );

  const toggleExpand = (pinId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(pinId) ? next.delete(pinId) : next.add(pinId);
      return next;
    });

  // ── Derived stats ──────────────────────────────────────────────────────────
  const inPins = useMemo(() => pins.filter((p) => p.direction === "4" || p.direction === "onoff"), [pins]);
  const outPins = useMemo(() => pins.filter((p) => p.direction === "2"), [pins]);

  const filteredPins = useMemo(() => {
    const q = search.toLowerCase();
    return pins.filter((p) => {
      if (filter === "read" && p.direction !== "2") return false;
      if (filter === "write" && p.direction !== "4") return false;
      if (filter === "onoff" && p.direction !== "onoff") return false;
      return !q || p.name.toLowerCase().includes(q) || p.desc_de.toLowerCase().includes(q);
    });
  }, [pins, filter, search]);

  // ── Icon upload ────────────────────────────────────────────────────────────
  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const hex = await imageFileToBmpHex(file);
      setSymbolHex(hex);
      setIconDataUrl(bmpHexToPngDataUrl(hex));
      mark();
    } catch {
      alert("Bild konnte nicht verarbeitet werden.");
    }
    e.target.value = "";
  };

  // ── Access helpers ─────────────────────────────────────────────────────────
  const isOwner = !template || user?.id === template.owner_id || user?.is_admin === true;
  const readOnly = !isNew && !isOwner;

  // ── Visibility toggle ──────────────────────────────────────────────────────
  const handleVisibilityToggle = async () => {
    if (!template || !isOwner) return;
    setVisibilityPending(true);
    try {
      const updated = await setTemplateVisibility(template.id, !isPublic);
      setIsPublic(updated.is_public);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    } catch {
      alert("Sichtbarkeit konnte nicht geändert werden.");
    } finally {
      setVisibilityPending(false);
    }
  };

  // ── Fork ───────────────────────────────────────────────────────────────────
  const handleFork = async () => {
    if (!template) return;
    setForkPending(true);
    try {
      const forked = await forkTemplate(template.id);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      navigate(`/templates/${forked.id}`);
    } catch {
      alert("Fehler beim Kopieren des Templates.");
    } finally {
      setForkPending(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isNew) {
      if (!newName.trim()) { alert("Bitte einen Namen eingeben."); return; }
      await createTemplate.mutateAsync({ name: newName.trim() });
      navigate("/");
      return;
    }
    if (!template || !devSec) return;

    let order = 0;
    const out: SaveField[] = [];
    const push = (s: string | null, k: string, v: string | null) =>
      out.push({ section: s, key: k, value: v, field_order: order++ });

    // 1. Header [HiTec-Zang] (original .devt section name, must not be renamed)
    for (const f of template.fields.filter((f) => f.section === "HiTec-Zang")) {
      push(f.section, f.key, f.value);
    }

    // 2. Device section — original order, updated values, auto-keys rebuilt at end
    const AUTO = new Set(["InputMin","InputMax","InputStep","OutputMin","OutputMax","OutputStep",
      "In.ListCount","Out.ListCount",
      ...Array.from({ length: 30 }, (_, i) => `In.List${i}`),
      ...Array.from({ length: 30 }, (_, i) => `Out.List${i}`),
    ]);
    for (const f of template.fields.filter((f) => f.section === devSec)) {
      if (AUTO.has(f.key)) continue;
      const val = f.key === "Symbol" ? (symbolHex ?? f.value) : (devFieldMap[f.key] ?? f.value);
      push(devSec, f.key, val);
    }
    // Rebuild In/Out lists
    push(devSec, "InputMin", String(inPins.length));
    push(devSec, "InputMax", String(inPins.length));
    push(devSec, "InputStep", "1");
    push(devSec, "OutputMin", String(outPins.length));
    push(devSec, "OutputMax", String(outPins.length));
    push(devSec, "OutputStep", "1");
    push(devSec, "In.ListCount", String(inPins.length));
    inPins.forEach((p, i) => push(devSec, `In.List${i}`, p.name));
    push(devSec, "Out.ListCount", String(outPins.length));
    outPins.forEach((p, i) => push(devSec, `Out.List${i}`, p.name));

    // 3. Pin sections
    for (const pin of pins) {
      for (const f of pinToFields(pin, devSec)) out.push({ ...f, field_order: order++ });
    }

    // 4. DeviceList
    for (const f of template.fields.filter((f) => f.section === "DeviceList")) {
      push(f.section, f.key, f.value);
    }

    await updateTemplate.mutateAsync({ id: template.id, data: { name: templateName, fields: out } });
    setDirty(false);
  };

  // ── Add / delete pin ───────────────────────────────────────────────────────
  const handleAddPin = () => {
    const pin = newPin(devSec ?? "");
    setPins((prev) => [...prev, pin]);
    setExpanded((prev) => new Set([...prev, pin.id]));
    mark();
    setTimeout(() => {
      document.getElementById(`pin-${pin.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleDeletePin = (pinId: string) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId));
    mark();
  };

  // ── Render: new template ───────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="min-h-screen bg-[#f5f5f3]">
        <TopBar title="Neues Template" dirty={false} saving={createTemplate.isPending}
          onSave={handleSave} onBack={() => navigate("/")} />
        <div className="max-w-xl mx-auto px-4 py-8">
          <div className="card">
            <Field label="Name *">
              <input className={inp} value={newName}
                onChange={(e) => setNewName(e.target.value)} placeholder="z.B. Bronkhorst MiniCori" />
            </Field>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <Center>Lade Template…</Center>;
  if (!template) return <Center className="text-red-500">Template nicht gefunden.</Center>;

  const baud = devFieldMap["mpSSBaud"] ?? "";
  const readCount = outPins.length;
  const writeCount = inPins.filter(p => p.direction === "4").length;
  const onoffCount = pins.filter(p => p.direction === "onoff").length;

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f3]">
      <TopBar
        title={template.name}
        dirty={dirty}
        saving={updateTemplate.isPending}
        readOnly={readOnly}
        isPublic={isPublic}
        visibilityPending={visibilityPending}
        onVisibilityToggle={isOwner ? handleVisibilityToggle : undefined}
        onSave={handleSave}
        onBack={() => navigate("/")}
        exportUrl={getExportUrl(template.id)}
        exportName={templateName}
        iconUrl={iconDataUrl}
      />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── Fork banner for read-only public templates ── */}
        {readOnly && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-800">Schreibgeschützt</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Dieser Treiber gehört <strong>{template.owner.display_name}</strong>.
                Erstelle eine Kopie in deinem privaten Bereich, um ihn zu bearbeiten.
              </p>
            </div>
            <button
              onClick={handleFork}
              disabled={forkPending}
              className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50
                         text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {forkPending ? "Wird kopiert…" : "Als Kopie übernehmen"}
            </button>
          </div>
        )}

        {/* ── Card 1: Gerät & Icon ── */}
        <fieldset disabled={readOnly} className="card [&:disabled_input]:bg-gray-50 [&:disabled_input]:text-gray-600 [&:disabled_input]:cursor-default [&:disabled_select]:bg-gray-50 [&:disabled_select]:cursor-default">
          <SectionLabel>Gerät & Icon</SectionLabel>

          {/* Icon box */}
          <div className="flex items-start gap-4 p-3 bg-[#f8f8f6] rounded-lg mb-4">
            <div>
              <div
                className={`w-[69px] h-[69px] border border-dashed border-gray-300 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden transition-colors ${readOnly ? "cursor-default" : "cursor-pointer hover:border-blue-400"}`}
                onClick={() => !readOnly && iconInputRef.current?.click()}
                title={readOnly ? "" : "Klicken zum Ändern"}
              >
                {iconDataUrl
                  ? <img src={iconDataUrl} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} alt="Icon" />
                  : <span className="text-[10px] text-gray-400 text-center px-1">Kein Icon</span>}
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-1">23 × 23 px</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Geräte-Icon</p>
              {!readOnly && (
                <>
                  <button className="btn-s" onClick={() => iconInputRef.current?.click()}>
                    Icon ersetzen
                  </button>
                  <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                </>
              )}
              <p className="text-[11px] text-gray-400 mt-2 max-w-[180px]">
                PNG, JPG oder BMP — wird auf 23×23 px skaliert.
              </p>
            </div>
          </div>

          {/* Name / Description */}
          <div className="g2">
            <Field label="Name (DE)">
              <input className={inp} value={devFieldMap["Name"] ?? ""}
                onChange={(e) => { setDev("Name", e.target.value); setTemplateName(e.target.value); }} />
            </Field>
            <Field label="Name (EN)">
              <input className={inp} value={devFieldMap["Name_ENU"] ?? ""}
                onChange={(e) => setDev("Name_ENU", e.target.value)} />
            </Field>
          </div>
          <div className="g2 mb-0">
            <Field label="Beschreibung (DE)">
              <input className={inp} value={devFieldMap["Description"] ?? ""}
                onChange={(e) => setDev("Description", e.target.value)} />
            </Field>
            <Field label="Description (EN)">
              <input className={inp} value={devFieldMap["Description_ENU"] ?? ""}
                onChange={(e) => setDev("Description_ENU", e.target.value)} />
            </Field>
          </div>

          <Sep />
          <SectionLabel>Kommunikation</SectionLabel>

          <div className="g4">
            <Field label="Baudrate">
              <input className={inp} value={devFieldMap["mpSSBaud"] ?? ""}
                onChange={(e) => setDev("mpSSBaud", e.target.value)} />
            </Field>
            <Field label="Datenbits">
              <input className={inp} value={devFieldMap["mpSSBits"] ?? ""}
                onChange={(e) => setDev("mpSSBits", e.target.value)} />
            </Field>
            <Field label="Parität">
              <input className={inp} value={devFieldMap["mpSSParity"] ?? ""}
                onChange={(e) => setDev("mpSSParity", e.target.value)} />
            </Field>
            <Field label="Stopbits">
              <input className={inp} value={devFieldMap["mpSSStopBits"] ?? ""}
                onChange={(e) => setDev("mpSSStopBits", e.target.value)} />
            </Field>
          </div>
          <div className="g4">
            <Field label="Handshake">
              <input className={inp} value={devFieldMap["mpSSHandshake"] ?? ""}
                onChange={(e) => setDev("mpSSHandshake", e.target.value)} />
            </Field>
            <Field label="Timeout (s)">
              <input className={inp} value={devFieldMap["mpSSTimeout"] ?? ""}
                onChange={(e) => setDev("mpSSTimeout", e.target.value)} />
            </Field>
            <Field label="Abtastintervall (s)">
              <input className={inp} value={devFieldMap["mpAbtastIntervall"] ?? ""}
                onChange={(e) => setDev("mpAbtastIntervall", e.target.value)} />
            </Field>
            <Field label="Sendepause (s)">
              <input className={inp} value={devFieldMap["mpSSSendPause"] ?? ""}
                onChange={(e) => setDev("mpSSSendPause", e.target.value)} />
            </Field>
          </div>
          <div className="g2">
            <Field label="Ende-Kennung Empfang">
              <input className={`${inp} font-mono text-xs`} value={devFieldMap["mpSSEndeKennungReceive"] ?? ""}
                onChange={(e) => setDev("mpSSEndeKennungReceive", e.target.value)} />
            </Field>
            <Field label="Ende-Kennung Senden">
              <input className={`${inp} font-mono text-xs`} value={devFieldMap["mpSSEndeKennungSend"] ?? ""}
                onChange={(e) => setDev("mpSSEndeKennungSend", e.target.value)} />
            </Field>
          </div>
          <div className="g2 mb-0">
            <Field label="IP-Adresse">
              <input className={inp} value={devFieldMap["mpIpAddr"] ?? ""}
                onChange={(e) => setDev("mpIpAddr", e.target.value)} />
            </Field>
            <Field label="Port">
              <input className={inp} value={devFieldMap["mpIpPort"] ?? ""}
                onChange={(e) => setDev("mpIpPort", e.target.value)} />
            </Field>
          </div>
        </fieldset>

        {/* ── Card 2: Datenpunkte ── */}
        <fieldset disabled={readOnly} className="card [&:disabled_input]:bg-gray-50 [&:disabled_input]:text-gray-600 [&:disabled_select]:bg-gray-50">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SectionLabel className="mb-0">Datenpunkte</SectionLabel>
            <input
              className="px-2.5 py-1 border border-gray-200 rounded-full text-xs outline-none focus:border-blue-400 w-36"
              placeholder="Suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {(["all","read","write","onoff"] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 border rounded-full text-xs transition-colors ${
                  filter === f ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}>
                {f === "all" ? `Alle (${pins.length})` : f === "read" ? `Lesen (${readCount})` : f === "write" ? `Schreiben (${writeCount})` : `Ein/Aus (${onoffCount})`}
              </button>
            ))}
            {!readOnly && (
              <button onClick={handleAddPin}
                className="ml-auto px-3 py-1 border border-gray-300 rounded-lg text-xs bg-white hover:bg-gray-50">
                + Pin hinzufügen
              </button>
            )}
          </div>

          {/* Pin list */}
          {filteredPins.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Keine Datenpunkte gefunden.</p>
          )}
          <div className="space-y-2">
            {filteredPins.map((pin) => (
              <PinCard
                key={pin.id}
                pin={pin}
                open={expanded.has(pin.id)}
                readOnly={readOnly}
                onToggle={() => toggleExpand(pin.id)}
                onChange={(patch) => { setPin(pin.id, patch); mark(); }}
                onNamur={(i, patch) => { setNamur(pin.id, i, patch); mark(); }}
                onDelete={() => handleDeletePin(pin.id)}
              />
            ))}
          </div>
        </fieldset>

        {/* Stats footer */}
        <p className="text-xs text-gray-400 text-center pb-2">
          {pins.length} Datenpunkte · {readCount} Lesen · {writeCount} Schreiben · {onoffCount} Ein/Aus
          {baud ? ` · ${baud} Baud` : ""}
        </p>

        {/* ── Kommentare ── */}
        <div className="card bg-gray-900 text-white">
          <CommentsPanel templateId={template.id} />
        </div>

        <div className="pb-8" />
      </div>
    </div>
  );
}

// ── PinCard ───────────────────────────────────────────────────────────────────

function PinCard({ pin, open, readOnly, onToggle, onChange, onNamur, onDelete }: {
  pin: Pin;
  open: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Pin>) => void;
  onNamur: (i: number, patch: Partial<NamurCmd>) => void;
  onDelete: () => void;
}) {
  const dirLabel = pin.direction === "onoff" ? "Ein/Aus" : pin.direction === "4" ? "Schreiben" : "Lesen";
  const dirColor =
    pin.direction === "onoff" ? "bg-orange-50 text-orange-700" :
    pin.direction === "4" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700";
  const send0 = pin.namur[0]?.sendStr ?? "";

  return (
    <div id={`pin-${pin.id}`} className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-[#f8f8f6] cursor-pointer select-none"
        onClick={onToggle}>
        <span className="text-sm font-medium bg-gray-900 text-white px-2.5 py-0.5 rounded-full shrink-0">
          {pin.name}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${dirColor}`}>
          {dirLabel}
        </span>
        <span className="text-sm text-gray-600 truncate">{pin.desc_de}</span>
        {pin.unit && <span className="text-xs text-gray-400 shrink-0">[{pin.unit}]</span>}
        {send0 && (
          <span className="text-xs font-mono text-gray-400 shrink-0 hidden sm:block">
            {send0.length > 28 ? send0.slice(0, 28) + "…" : send0}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400 shrink-0">{open ? "▲" : "▼"}</span>
      </div>

      {/* Body */}
      {open && (
        <div className="p-4 border-t border-gray-100 space-y-3">
          <div className="g2">
            <Field label="Name (Pin-ID)">
              <input className={inp} value={pin.name}
                onChange={(e) => onChange({ name: e.target.value })} />
            </Field>
            <Field label="Richtung">
              <select className={inp} value={pin.direction}
                onChange={(e) => onChange({ direction: e.target.value as Direction })}>
                <option value="2">← Lesen</option>
                <option value="4">→ Schreiben</option>
                <option value="onoff">Ein/Aus</option>
              </select>
            </Field>
          </div>
          <div className="g2">
            <Field label="Beschreibung (DE)">
              <input className={inp} value={pin.desc_de}
                onChange={(e) => onChange({ desc_de: e.target.value })} />
            </Field>
            <Field label="Description (EN)">
              <input className={inp} value={pin.desc_en}
                onChange={(e) => onChange({ desc_en: e.target.value })} />
            </Field>
          </div>
          <div className="g4">
            <Field label="Einheit">
              <input className={inp} value={pin.unit}
                onChange={(e) => onChange({ unit: e.target.value })} />
            </Field>
            <Field label="Nachkomma">
              <input className={inp} type="number" min="0" max="6" value={pin.postdec}
                onChange={(e) => onChange({ postdec: e.target.value })} />
            </Field>
            <Field label="Arbeitsbereich Min">
              <input className={inp} value={pin.workAreaMin}
                onChange={(e) => onChange({ workAreaMin: e.target.value })} />
            </Field>
            <Field label="Arbeitsbereich Max">
              <input className={inp} value={pin.workAreaMax}
                onChange={(e) => onChange({ workAreaMax: e.target.value })} />
            </Field>
          </div>

          <Sep />

          {/* Namur commands */}
          {pin.direction === "onoff" ? (
            <div className="g2">
              <Field label="Befehl AUS (0)">
                <input className={`${inp} font-mono text-xs`} value={pin.namur[0]?.sendStr ?? ""}
                  onChange={(e) => onNamur(0, { sendStr: e.target.value })} />
              </Field>
              <Field label="Befehl EIN (1)">
                <input className={`${inp} font-mono text-xs`} value={pin.namur[1]?.sendStr ?? ""}
                  onChange={(e) => onNamur(1, { sendStr: e.target.value })} />
              </Field>
            </div>
          ) : (
            <>
              <div className="g2">
                <Field label="Sende-String (Befehl)">
                  <input className={`${inp} font-mono text-xs`} value={pin.namur[0]?.sendStr ?? ""}
                    onChange={(e) => onNamur(0, { sendStr: e.target.value })} />
                </Field>
                <Field label="Empfangs-Pattern (RecStr)">
                  <input className={`${inp} font-mono text-xs`} value={pin.namur[0]?.recStr ?? ""}
                    onChange={(e) => onNamur(0, { recStr: e.target.value })} />
                </Field>
              </div>
              <div className="g4">
                <Field label="RecType">
                  <select className={inp} value={pin.namur[0]?.recType ?? "0"}
                    onChange={(e) => onNamur(0, { recType: e.target.value })}>
                    <option value="0">0 – kein Parse</option>
                    <option value="1">1 – Int/Float</option>
                    <option value="2">2 – Hex</option>
                  </select>
                </Field>
                <Field label="Position (RecPos)">
                  <input className={`${inp} font-mono text-xs`} value={pin.namur[0]?.pos ?? "0"}
                    onChange={(e) => onNamur(0, { pos: e.target.value })} />
                </Field>
                <Field label="Skalierung Min">
                  <input className={inp} value={pin.scaleMin}
                    onChange={(e) => onChange({ scaleMin: e.target.value })} />
                </Field>
                <Field label="Skalierung Max">
                  <input className={inp} value={pin.scaleMax}
                    onChange={(e) => onChange({ scaleMax: e.target.value })} />
                </Field>
              </div>
            </>
          )}

          <Sep />

          <div className="g4">
            <Field label="Optional">
              <select className={inp} value={pin.optional}
                onChange={(e) => onChange({ optional: e.target.value })}>
                <option value="1">Ja</option>
                <option value="0">Nein</option>
              </select>
            </Field>
            <Field label="Verlauf speichern">
              <select className={inp} value={pin.saveHisto}
                onChange={(e) => onChange({ saveHisto: e.target.value })}>
                <option value="1">Ja</option>
                <option value="0">Nein</option>
              </select>
            </Field>
            <Field label="DeltaX">
              <input className={inp} value={pin.deltaX}
                onChange={(e) => onChange({ deltaX: e.target.value })} />
            </Field>
            <Field label="DeltaT (ms)">
              <input className={inp} value={pin.deltaT}
                onChange={(e) => onChange({ deltaT: e.target.value })} />
            </Field>
          </div>

          {!readOnly && (
            <div className="flex justify-end pt-1">
              <button
                onClick={onDelete}
                className="px-3 py-1 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50">
                Pin löschen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Top bar ────────────────────────────────────────────────────────────────────

function TopBar({
  title, dirty, saving, readOnly, isPublic, visibilityPending,
  onSave, onBack, onVisibilityToggle, exportUrl, exportName, iconUrl,
}: {
  title: string; dirty: boolean; saving: boolean;
  readOnly?: boolean; isPublic?: boolean; visibilityPending?: boolean;
  onSave: () => void; onBack: () => void;
  onVisibilityToggle?: () => void;
  exportUrl?: string; exportName?: string; iconUrl?: string | null;
}) {
  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
      <button onClick={onBack} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      {iconUrl
        ? <img src={iconUrl} className="w-9 h-9 rounded border border-gray-100" style={{ imageRendering: "pixelated" }} alt="" />
        : <div className="w-9 h-9 rounded bg-gray-900 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-medium">HZ</span>
          </div>
      }
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate text-sm leading-tight">{title}</p>
      </div>
      {dirty && <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" title="Ungespeicherte Änderungen" />}
      <div className="flex items-center gap-2">
        {exportUrl && (
          <a href={exportUrl} download={`${exportName ?? "template"}.devt`}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
            Export .devt
          </a>
        )}
        {/* Visibility toggle — owner only */}
        {onVisibilityToggle && (
          <button
            onClick={onVisibilityToggle}
            disabled={visibilityPending}
            title={isPublic ? "Auf privat setzen" : "Öffentlich teilen"}
            className={`px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
              isPublic
                ? "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {isPublic ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
                Öffentlich
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Privat
              </>
            )}
          </button>
        )}
        {!readOnly && (
          <button onClick={onSave} disabled={saving}
            className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">
            {saving ? "Speichern…" : "Speichern"}
          </button>
        )}
      </div>
    </header>
  );
}

// ── Tiny shared components ────────────────────────────────────────────────────

const inp = "w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white";
const inpRO = "w-full px-2.5 py-1.5 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-600 cursor-default";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3 ${className ?? ""}`}>
      {children}
    </p>
  );
}

function Sep() {
  return <div className="border-t border-gray-100 my-1" />;
}

function Center({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-h-screen flex items-center justify-center text-gray-400 ${className ?? ""}`}>
      {children}
    </div>
  );
}
