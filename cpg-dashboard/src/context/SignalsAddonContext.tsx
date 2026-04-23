import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiUrl } from "../api";

type StatCanSummaryLite = {
  generatedAt: string;
  catalogEntryCount: number;
  liteListSyncedAt: string | null;
  curated: Array<{
    id: string;
    titleEn: string;
    frequencyDesc: string;
    latestPoints: Array<{ refPer: string; value: number }>;
  }>;
};

type PulseLite = {
  generatedAt: string;
  filter: { kept: number; rawCandidates: number };
  topTerms: Array<{ term: string; count: number }>;
  sentimentAnalysis?: {
    index0to100: number;
    label: string;
    meanScore: number;
    sampleSize: number;
    methodology: string;
  };
};

type SignalsAddonState = {
  statcan: StatCanSummaryLite | null;
  pulse: PulseLite | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SignalsAddonContext = createContext<SignalsAddonState | null>(null);

export function SignalsAddonProvider({ children }: { children: ReactNode }) {
  const [statcan, setStatcan] = useState<StatCanSummaryLite | null>(null);
  const [pulse, setPulse] = useState<PulseLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(apiUrl("/api/statcan/summary")),
        fetch(apiUrl("/api/reddit-canada-retail-pulse")),
      ]);
      const sJson = (await sRes.json()) as StatCanSummaryLite & { error?: string };
      const pJson = (await pRes.json()) as PulseLite & { error?: string };
      if (!sRes.ok || "error" in sJson) throw new Error("error" in sJson ? String(sJson.error) : "StatCan summary failed");
      if (!pRes.ok || "error" in pJson) throw new Error("error" in pJson ? String(pJson.error) : "Reddit pulse failed");
      setStatcan(sJson);
      setPulse(pJson);
    } catch (e) {
      setStatcan(null);
      setPulse(null);
      setError(e instanceof Error ? e.message : "Signals add-on failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ statcan, pulse, loading, error, refresh }),
    [statcan, pulse, loading, error, refresh]
  );

  return <SignalsAddonContext.Provider value={value}>{children}</SignalsAddonContext.Provider>;
}

export function useSignalsAddon(): SignalsAddonState {
  const ctx = useContext(SignalsAddonContext);
  if (!ctx) throw new Error("useSignalsAddon must be used within SignalsAddonProvider");
  return ctx;
}
