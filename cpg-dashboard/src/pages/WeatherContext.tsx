import { createContext, useContext, useState, ReactNode } from "react";

export interface WeatherContextValue {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  avgTemp: number;
  setAvgTemp: (temp: number) => void;
  threshold: number;
  setThreshold: (t: number) => void;
}

const WeatherContext = createContext<WeatherContextValue>({
  selectedCity: "Mississauga",
  setSelectedCity: () => {},
  avgTemp: 12,
  setAvgTemp: () => {},
  threshold: 12,
  setThreshold: () => {},
});

export function WeatherProvider({ children }: { children: ReactNode }) {
  const [selectedCity, setSelectedCity] = useState("Mississauga");
  const [avgTemp, setAvgTemp] = useState(12);
  const [threshold, setThreshold] = useState(12);

  return (
    <WeatherContext.Provider
      value={{ selectedCity, setSelectedCity, avgTemp, setAvgTemp, threshold, setThreshold }}
    >
      {children}
    </WeatherContext.Provider>
  );
}

export function useWeatherContext() {
  return useContext(WeatherContext);
}
