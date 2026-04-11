import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates, useDeleteTemplate, useImportTemplate } from "../hooks/useTemplates";

export default function TemplateList() {
  const navigate = useNavigate();
  const { data: templates, isLoading, isError } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const importTemplate = useImportTemplate();
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = (templates ?? []).filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const tpl = await importTemplate.mutateAsync(file);
      navigate(`/templates/${tpl.id}`);
    } catch {
      alert("Fehler beim Importieren der Datei.");
    }
    e.target.value = "";
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Template "${name}" wirklich löschen?`)) return;
    await deleteTemplate.mutateAsync(id);
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">HZ</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">HiTec-Zang Template Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/settings/schema")}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Schema-Konfiguration"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Templates suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <input ref={fileRef} type="file" accept=".devt" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importTemplate.isPending}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importTemplate.isPending ? "Importiere..." : ".devt importieren"}
          </button>
          <button
            onClick={() => navigate("/templates/new")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Template
          </button>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="text-center py-16 text-gray-500">Lade Templates...</div>
        )}
        {isError && (
          <div className="text-center py-16 text-red-500">Fehler beim Laden der Templates.</div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 text-5xl mb-4">📄</div>
            <p className="text-gray-500 text-lg">
              {search ? "Keine Templates gefunden." : "Noch keine Templates vorhanden."}
            </p>
            {!search && (
              <p className="text-gray-400 mt-1">
                Importieren Sie eine .devt-Datei oder erstellen Sie ein neues Template.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(`/templates/${tpl.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{tpl.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className="text-xs text-gray-400">{formatDate(tpl.updated_at)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(tpl.id, tpl.name); }}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                    title="Löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
