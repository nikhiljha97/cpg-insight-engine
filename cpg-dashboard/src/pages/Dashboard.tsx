import { apiUrl } from "../api";
import { useEffect, useMemo, useState } from "react";

type City = {
  name: string;
  lat: number;
  lon: number;
};

type ForecastDay = {
  date: string;
  tempMax: number;
  tempMin: number;
  tempAvg: number;
  precipitationMm: number;
  weatherCode: number;
  weatherLabel: string;
  inTriggerWindow: boolean;
  emoji: string;
};

type Trigger = {
  triggered: boolean;
  avgTemp: number;
  wetDays: number;
  threshold: number;
  windowDates: string[];
};

type WeatherResponse = {
  city: City;
  forecast: ForecastDay[];
  trigger: Trigger;
};

export default function Dashboard() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState("Mississauga");
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pitch, setPitch] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCities() {
      const response = await fetch(apiUrl("/api/cities"));
      const data = (await response.json()) as City[];
      setCities(data);
    }
    void loadCities();
  }, []);

  useEffect(() => {
    async function loadWeather() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(apiUrl(`/api/weather?city=${encodeURIComponent(selectedCity)}`);
        const data = (await response.json()) as WeatherResponse | { error: string };
        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to load weather");
        }
        setWeather(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown weather error");
      } finally {
        setLoading(false);
      }
    }
    void loadWeather();
  }, [selectedCity]);

  const kpis = useMemo(() => {
    if (!weather) return [];
    return [
      { label: "Trigger Status", value: weather.trigger.triggered ? "Triggered" : "Monitoring" },
      { label: "3-Day Avg Temp", value: `${weather.trigger.avgTemp}°C` },
      { label: "Location", value: weather.city.name },
      { label: "Wet Days", value: `${weather.trigger.wetDays}` }
    ];
  }, [weather]);

  async function generatePitch() {
    if (!weather) return;
    setPitchLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/generate-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: weather.city.name, weatherData: weather })
      });
      const data = (await response.json()) as { pitch?: string; error?: string; prompt?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Pitch generation failed");
      }
      setPitch(data.pitch ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown pitch error");
    } finally {
      setPitchLoading(false);
    }
  }

  async function copyPitch() {
    await navigator.clipboard.writeText(pitch);
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Weather Trigger Dashboard</p>
          <h2>Canadian City Monitoring</h2>
        </div>
        <div className="toolbar">
          <label className="field">
            <span>City</span>
            <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
              {cities.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" onClick={generatePitch} disabled={!weather || pitchLoading}>
            {pitchLoading ? "Generating..." : "Generate Pitch"}
          </button>
        </div>
      </header>

      {error ? <div className="callout error">{error}</div> : null}

      <div className="kpi-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="card skeleton" />)
          : kpis.map((kpi) => (
              <div key={kpi.label} className="card kpi-card">
                <span>{kpi.label}</span>
                <strong>{kpi.value}</strong>
              </div>
            ))}
      </div>

      <div className="card">
        <div className="section-title-row">
          <h3>7-Day Forecast</h3>
          {weather ? <span className="mono">Threshold {weather.trigger.threshold}°C</span> : null}
        </div>
        <div className="forecast-strip">
          {loading
            ? Array.from({ length: 7 }).map((_, index) => <div key={index} className="forecast-card skeleton" />)
            : weather?.forecast.map((day) => (
                <div key={day.date} className="forecast-card">
                  <div className="forecast-top">
                    <span>{new Date(day.date).toLocaleDateString("en-CA", { weekday: "short" })}</span>
                    {day.inTriggerWindow ? <span className="badge">WINDOW</span> : null}
                  </div>
                  <div className="forecast-emoji">{day.emoji}</div>
                  <strong>{day.tempMax}°</strong>
                  <span>{day.tempMin}° min</span>
                  <span>{day.weatherLabel}</span>
                  <span>{day.precipitationMm} mm precip</span>
                </div>
              ))}
        </div>
      </div>

      <div className="card pitch-card">
        <div className="section-title-row">
          <h3>Generated Pitch</h3>
          <button className="ghost-button" onClick={copyPitch} disabled={!pitch}>
            Copy
          </button>
        </div>
        <div className="pitch-output">
          {pitchLoading ? (
            <div className="skeleton pitch-skeleton" />
          ) : pitch ? (
            <pre>{pitch}</pre>
          ) : (
            <p>No pitch generated yet. Choose a city and run the weather trigger.</p>
          )}
        </div>
      </div>
    </section>
  );
}
