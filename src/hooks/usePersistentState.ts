import { useEffect, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";

export function usePersistentState<T>(key: string, sanitize: (v: unknown) => T) {
  const [value, setValue] = useState<T>(() => sanitize(loadJSON(key)));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveJSON(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
