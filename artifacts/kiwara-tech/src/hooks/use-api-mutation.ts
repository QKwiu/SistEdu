import { useState } from "react";

/**
 * use-api-mutation — replaces ~15 repeated setSaving/setError/try/catch blocks.
 *
 * Usage:
 *   const { mutate: criarTurma, saving, error } = useApiMutation(
 *     (body: CriarTurmaBody) => apiPost("/school/turmas", body, token),
 *     { onSuccess: () => { setShow(false); loadTurmas(); } }
 *   );
 */
export function useApiMutation<TBody = void, TResult = unknown>(
  mutationFn: (body: TBody) => Promise<TResult>,
  options?: {
    onSuccess?: (data: TResult) => void;
    onError?: (err: Error) => void;
  }
) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function mutate(body: TBody): Promise<TResult | undefined> {
    setError("");
    setSaving(true);
    try {
      const data = await mutationFn(body);
      options?.onSuccess?.(data);
      return data;
    } catch (e: any) {
      const msg: string = e?.message ?? "Erro inesperado";
      setError(msg);
      options?.onError?.(e instanceof Error ? e : new Error(msg));
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  function clearError() {
    setError("");
  }

  return { mutate, saving, error, clearError };
}
