import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/client";

export const useSchemaConfigs = () =>
  useQuery({ queryKey: ["schema-configs"], queryFn: api.getSchemaConfigs });

export const useCreateSchemaConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSchemaConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schema-configs"] }),
  });
};

export const useUpdateSchemaConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateSchemaConfig>[1] }) =>
      api.updateSchemaConfig(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schema-configs"] }),
  });
};

export const useDeleteSchemaConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSchemaConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schema-configs"] }),
  });
};

export const useApplySchemaConfig = () =>
  useMutation({ mutationFn: api.applySchemaConfig });
