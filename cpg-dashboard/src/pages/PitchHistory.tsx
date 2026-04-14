import { apiUrl } from "../api";
import { useEffect, useState } from "react";

type PitchHistoryRow = {
  id: number;
  city: string;
  created_at: string;
  trigger_status: string;
  avg_temp: number;
  wet_days: number;
  pitch_text: string;
};

export default function PitchHistory() {
  const [items, setItems] = useState<PitchHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const response = await fetch(apiUrl("/api/pitch-history"));
      const data = (await response.json()) as PitchHistoryRow[];
      setItems(data);
      setLoading(false);
    }
    void loadHistory();
  }, []);

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Saved Outputs</p>
          <h2>Pitch History</h2>
        </div>
      </header>

      <div className="history-list">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="card skeleton history-skeleton" />)
          : items.map((item) => (
              <article key={item.id} className="card history-card">
                <div className="section-title-row">
                  <div>
                    <h3>{item.city}</h3>
                    <p className="history-meta">
                      {new Date(item.created_at).toLocaleString()} · {item.trigger_status} · {item.avg_temp}°C ·{" "}
                      {item.wet_days} wet days
                    </p>
                  </div>
                  <button className="ghost-button" onClick={() => copyText(item.pitch_text)}>
                    Copy
                  </button>
                </div>
                <pre>{item.pitch_text}</pre>
              </article>
            ))}

        {!loading && items.length === 0 ? (
          <div className="card">
            <p>No saved pitches yet. Generate one from the dashboard page.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
