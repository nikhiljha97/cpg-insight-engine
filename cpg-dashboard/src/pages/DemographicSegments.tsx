import { useEffect, useState } from "react";
import { apiUrl } from "../api";

export default function DemographicSegments() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/signals/demographics"));
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load demographic signals");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Signals</p>
          <h2>Demographic Segments</h2>
        </div>
      </header>

      {error ? <div className="callout error">{error}</div> : null}

      <div className="card">
        <div className="section-title-row">
          <h3>Unified bundle — demographics</h3>
          <span className="mono">GET /api/signals/demographics</span>
        </div>
        {loading ? <div className="skeleton pitch-skeleton" /> : <pre className="json-panel">{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </section>
  );
}
