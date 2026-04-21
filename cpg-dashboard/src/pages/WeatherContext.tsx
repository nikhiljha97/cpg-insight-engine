import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { isDemandCategory, type DemandCategory } from "../constants/demandCategories";

const DEMAND_CATEGORY_STORAGE_KEY = "cpg_demand_category";
const HOT_THRESHOLD_STORAGE_KEY = "cpg_hot_threshold";

function readStoredDemandCategory(): DemandCategory {
  if (typeof window === "undefined") return "Canned Soup";
  try {
    const v = window.sessionStorage.getItem(DEMAND_CATEGORY_STORAGE_KEY);
    if (v && isDemandCategory(v)) return v;
  } catch {
    /* ignore */
  }
  return "Canned Soup";
}

function readStoredHotThreshold(): number {
  if (typeof window === "undefined") return 26;
  try {
    const v = window.sessionStorage.getItem(HOT_THRESHOLD_STORAGE_KEY);
    if (v == null) return 26;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 18 && n <= 40) return n;
  } catch {
    /* ignore */
  }
  return 26;
}

export interface WeatherContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  avgTemp: number;
  setAvgTemp: (temp: number) => void;
  /** Cold comfort cut-off (°C) — next 3-day avg below this with ≥1 wet-code day ⇒ cold promo */
  threshold: number;
  setThreshold: (t: number) => void;
  /** Hot summer cut-off (°C) — next 3-day avg above this with zero wet-code days ⇒ hot promo */
  hotThreshold: number;
  setHotThreshold: (t: number) => void;
  wetDays: number;
  setWetDays: (n: number) => void;
  coldPromoActive: boolean;
  setColdPromoActive: (v: boolean) => void;
  hotPromoActive: boolean;
  setHotPromoActive: (v: boolean) => void;
  demandCategory: DemandCategory;
  setDemandCategory: (c: DemandCategory) => void;
}

const WeatherContext = createContext<WeatherContextValue>({
  selectedCity: "Mississauga",
  setSelectedCity: () => {},
  avgTemp: 12,
  setAvgTemp: () => {},
  threshold: 12,
  setThreshold: () => {},
  hotThreshold: 26,
  setHotThreshold: () => {},
  wetDays: 0,
  setWetDays: () => {},
  coldPromoActive: false,
  setColdPromoActive: () => {},
  hotPromoActive: false,
  setHotPromoActive: () => {},
  demandCategory: "Canned Soup",
  setDemandCategory: () => {},
});

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState("Mississauga");
  const [avgTemp, setAvgTemp] = useState(12);
  const [threshold, setThreshold] = useState(12);
  const [hotThreshold, setHotThresholdState] = useState(readStoredHotThreshold);
  const [wetDays, setWetDays] = useState(0);
  const [coldPromoActive, setColdPromoActive] = useState(false);
  const [hotPromoActive, setHotPromoActive] = useState(false);
  const [demandCategory, setDemandCategoryState] = useState<DemandCategory>(readStoredDemandCategory);

  const setDemandCategory = useCallback((c: DemandCategory) => {
    setDemandCategoryState(c);
    try {
      window.sessionStorage.setItem(DEMAND_CATEGORY_STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const setHotThreshold = useCallback((t: number) => {
    setHotThresholdState(t);
    try {
      window.sessionStorage.setItem(HOT_THRESHOLD_STORAGE_KEY, String(t));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <WeatherContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        avgTemp,
        setAvgTemp,
        threshold,
        setThreshold,
        hotThreshold,
        setHotThreshold,
        wetDays,
        setWetDays,
        coldPromoActive,
        setColdPromoActive,
        hotPromoActive,
        setHotPromoActive,
        demandCategory,
        setDemandCategory,
      }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeatherContext() {
  return useContext(WeatherContext);
}
