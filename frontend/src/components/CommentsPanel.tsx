import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getComments, createComment, deleteComment } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import type { Comment } from "../types";

interface Props {
  templateId: number;
}

export default function CommentsPanel({ templateId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [postError, setPostError] = useState("");

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", templateId],
    queryFn: () => getComments(templateId),
  });

  const addMutation = useMutation({
    mutationFn: () => createComment(templateId, body.trim()),
    onSuccess: () => {
      setBody("");
      setPostError("");
      queryClient.invalidateQueries({ queryKey: ["comments", templateId] });
    },
    onError: (err: any) => {
      setPostError(err?.response?.data?.detail ?? "Fehler beim Posten");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(templateId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", templateId] });
    },
  });

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

  const canDelete = (c: Comment) =>
    user?.id === c.author.id || user?.is_admin;

  return (
    <div className="mt-8 border-t border-gray-700 pt-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        Kommentare ({comments.length})
      </h3>

      {isLoading && <p className="text-gray-500 text-sm">Lade Kommentare…</p>}

      <div className="space-y-3 mb-4">
        {comments.map((c) => (
          <div key={c.id} className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-200">{c.author.display_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{formatDate(c.created_at)}</span>
                {canDelete(c) && (
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    disabled={deleteMutation.isPending}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                    title="Kommentar löschen"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-gray-500">Noch keine Kommentare.</p>
        )}
      </div>

      {/* New comment input */}
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Kommentar schreiben…"
          rows={3}
          maxLength={2000}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                     placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
        />
        {postError && (
          <p className="text-xs text-red-400">{postError}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{body.length}/2000</span>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!body.trim() || addMutation.isPending}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white text-sm rounded-lg transition-colors"
          >
            {addMutation.isPending ? "Wird gesendet…" : "Kommentar posten"}
          </button>
        </div>
      </div>
    </div>
  );
}
