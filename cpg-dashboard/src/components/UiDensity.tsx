import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UiDensity = "executive" | "analyst";

const STORAGE_KEY = "cpg_ui_density";

type UiDensityContextValue = {
  density: UiDensity;
  setDensity: (d: UiDensity) => void;
  toggleDensity: () => void;
};

const UiDensityContext = createContext<UiDensityContextValue>({
  density: "executive",
  setDensity: () => {},
  toggleDensity: () => {},
});

function readStoredDensity(): UiDensity {
  if (typeof window === "undefined") return "executive";
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (v === "analyst" || v === "executive") return v;
  } catch {
    /* ignore */
  }
  return "executive";
}

function applyDensityClass(density: UiDensity) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = density;
}

export function UiDensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<UiDensity>(readStoredDensity);

  const setDensity = useCallback((d: UiDensity) => {
    setDensityState(d);
    applyDensityClass(d);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "executive" ? "analyst" : "executive");
  }, [density, setDensity]);

  useEffect(() => {
    applyDensityClass(density);
  }, [density]);

  const value = useMemo(() => ({ density, setDensity, toggleDensity }), [density, setDensity, toggleDensity]);

  return <UiDensityContext.Provider value={value}>{children}</UiDensityContext.Provider>;
}

export function useUiDensity(): UiDensityContextValue {
  return useContext(UiDensityContext);
}

