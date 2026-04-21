import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { isDemandCategory, type DemandCategory } from "../constants/demandCategories";

const DEMAND_CATEGORY_STORAGE_KEY = "cpg_demand_category";

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

export interface WeatherContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  avgTemp: number;
  setAvgTemp: (temp: number) => void;
  threshold: number;
  setThreshold: (t: number) => void;
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
  demandCategory: "Canned Soup",
  setDemandCategory: () => {},
});

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState("Mississauga");
  const [avgTemp, setAvgTemp] = useState(12);
  const [threshold, setThreshold] = useState(12);
  const [demandCategory, setDemandCategoryState] = useState<DemandCategory>(readStoredDemandCategory);

  const setDemandCategory = useCallback((c: DemandCategory) => {
    setDemandCategoryState(c);
    try {
      window.sessionStorage.setItem(DEMAND_CATEGORY_STORAGE_KEY, c);
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
