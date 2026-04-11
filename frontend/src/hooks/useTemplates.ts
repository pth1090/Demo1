import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";
import type { Template } from "../types";

export const useTemplates = () =>
  useQuery({ queryKey: ["templates"], queryFn: api.getTemplates });

export const useTemplate = (id: number | null) =>
  useQuery({
    queryKey: ["templates", id],
    queryFn: () => api.getTemplate(id!),
    enabled: id !== null,
  });

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useUpdateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateTemplate>[1] }) =>
      api.updateTemplate(id, data),
    onSuccess: (tpl: Template) => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.setQueryData(["templates", tpl.id], tpl);
    },
  });
};

export const useDeleteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useImportTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.importTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
};
