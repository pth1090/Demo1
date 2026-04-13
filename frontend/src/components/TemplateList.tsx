import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTemplates, useDeleteTemplate, useImportTemplate } from "../hooks/useTemplates";
import { useAuth } from "../hooks/useAuth";
import { forkTemplate } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";

export default function TemplateList() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: templates, isLoading, isError } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const importTemplate = useImportTemplate();
  const [search, setSearch] = useState("");
  const [forkingId, setForkingId] = useState<number | null>(null);
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

  const handleFork = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setForkingId(id);
    try {
      const forked = await forkTemplate(id);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      navigate(`/templates/${forked.id}`);
    } catch {
      alert("Fehler beim Kopieren des Templates.");
    } finally {
      setForkingId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  const isOwner = (ownerId: number) => user?.id === ownerId || user?.is_admin;

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
        <div className="flex items-center gap-3">
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
          {/* User info + logout */}
          <div className="flex items-center gap-2 border-l border-gray-200 pl-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-gray-700">{user?.display_name}</div>
              {user?.is_admin && (
                <div className="text-xs text-purple-600 font-medium">Admin</div>
              )}
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Abmelden"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
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
        </div>

        {/* Content */}
        {isLoading && <div className="text-center py-16 text-gray-500">Lade Templates...</div>}
        {isError && <div className="text-center py-16 text-red-500">Fehler beim Laden der Templates.</div>}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-gray-400 text-5xl mb-4">📄</div>
            <p className="text-gray-500 text-lg">
              {search ? "Keine Templates gefunden." : "Noch keine Templates vorhanden."}
            </p>
            {!search && (
              <p className="text-gray-400 mt-1">
                Importieren Sie eine .devt-Datei.
              </p>
            )}
          </div>
        )}

        <div className="grid gap-3">
          {filtered.map((tpl) => {
            const owner = isOwner(tpl.owner_id);
            const isMine = user?.id === tpl.owner_id;
            return (
              <div
                key={tpl.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate(`/templates/${tpl.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{tpl.name}</h3>
                      {/* Visibility badge */}
                      {tpl.is_public ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                          Öffentlich
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                          Privat
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p className="text-sm text-gray-500 mt-0.5 truncate">{tpl.description}</p>
                    )}
                    {/* Owner info for non-own public templates */}
                    {!isMine && (
                      <p className="text-xs text-gray-400 mt-1">von {tpl.owner.display_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-400">{formatDate(tpl.updated_at)}</span>

                    {/* Fork button for public templates not owned by me */}
                    {tpl.is_public && !isMine && (
                      <button
                        onClick={(e) => handleFork(e, tpl.id)}
                        disabled={forkingId === tpl.id}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded"
                        title="Als Kopie übernehmen"
                      >
                        {forkingId === tpl.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Delete button — only for owner or admin */}
                    {owner && (
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
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
