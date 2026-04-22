import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import {
  DEFAULT_COLD_THRESHOLD_C,
  DEFAULT_DEMAND_CATEGORY,
  DEFAULT_HOT_THRESHOLD_C,
  DEFAULT_SELECTED_CITY,
  HOT_THRESHOLD_MAX_C,
  HOT_THRESHOLD_MIN_C,
} from "../constants/appDefaults";
import { isDemandCategory, type DemandCategory } from "../constants/demandCategories";

const DEMAND_CATEGORY_STORAGE_KEY = "cpg_demand_category";
const HOT_THRESHOLD_STORAGE_KEY = "cpg_hot_threshold";

function readStoredDemandCategory(): DemandCategory {
  if (typeof window === "undefined") return DEFAULT_DEMAND_CATEGORY;
  try {
    const v = window.sessionStorage.getItem(DEMAND_CATEGORY_STORAGE_KEY);
    if (v && isDemandCategory(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_DEMAND_CATEGORY;
}

function readStoredHotThreshold(): number {
  if (typeof window === "undefined") return DEFAULT_HOT_THRESHOLD_C;
  try {
    const v = window.sessionStorage.getItem(HOT_THRESHOLD_STORAGE_KEY);
    if (v == null) return DEFAULT_HOT_THRESHOLD_C;
    const n = Number(v);
    if (Number.isFinite(n) && n >= HOT_THRESHOLD_MIN_C && n <= HOT_THRESHOLD_MAX_C) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_HOT_THRESHOLD_C;
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
  selectedCity: DEFAULT_SELECTED_CITY,
  setSelectedCity: () => {},
  avgTemp: DEFAULT_COLD_THRESHOLD_C,
  setAvgTemp: () => {},
  threshold: DEFAULT_COLD_THRESHOLD_C,
  setThreshold: () => {},
  hotThreshold: DEFAULT_HOT_THRESHOLD_C,
  setHotThreshold: () => {},
  wetDays: 0,
  setWetDays: () => {},
  coldPromoActive: false,
  setColdPromoActive: () => {},
  hotPromoActive: false,
  setHotPromoActive: () => {},
  demandCategory: DEFAULT_DEMAND_CATEGORY,
  setDemandCategory: () => {},
});

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState(DEFAULT_SELECTED_CITY);
  const [avgTemp, setAvgTemp] = useState(DEFAULT_COLD_THRESHOLD_C);
  const [threshold, setThreshold] = useState(DEFAULT_COLD_THRESHOLD_C);
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
