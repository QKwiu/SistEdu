import { useState, useMemo } from "react";

/**
 * use-search — replaces ~10 repeated search/filter state + .filter().includes() blocks.
 *
 * Usage:
 *   const { search, setSearch, filtered } = useSearch(alunos, ["nome", "numero_processo"]);
 */
export function useSearch<T extends Record<string, unknown>>(
  data: T[],
  keys: (keyof T)[]
) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      keys.some((k) => String(item[k] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, keys]);

  return { search, setSearch, filtered };
}
