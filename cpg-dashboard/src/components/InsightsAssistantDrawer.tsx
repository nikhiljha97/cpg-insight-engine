import { useCallback, useEffect, useState } from "react";
import NlqPanel from "./NlqPanel";
import { useWeatherContext } from "../pages/WeatherContext";
import {
  DEMAND_CATEGORY_LIST,
  isDemandCategory,
  type DemandCategory,
} from "../constants/demandCategories";
import type { InsightsPdfScope } from "../lib/insightsPdfBundle";

const ASSISTANT_INTRO = `**Welcome to the Insights Assistant.** Ask questions about your unified retail signals, macro strip, and Ontario retail context (requires **GROQ_API_KEY** on the API for live answers).

When you are ready for a **single PDF download** that consolidates Basket insights, Ontario retail, Macro, Promo, Price elasticity, Demographics, Pitch history, and GTA traffic — tell me which **food category** you want, or type **All** to merge every category.

You can also choose a category in the **Export PDF** section below and click **Generate**.`;

function parseScopeFromUserText(text: string): InsightsPdfScope | null {
  const t = text.trim();
  if (/^all$/i.test(t)) return "all";
  if (isDemandCategory(t)) return t;
  const hit = DEMAND_CATEGORY_LIST.find((c) => c.toLowerCase() === t.toLowerCase());
  return hit ?? null;
}

export default function InsightsAssistantDrawer() {
  const { selectedCity, threshold, hotThreshold, demandCategory } = useWeatherContext();
  const [open, setOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<InsightsPdfScope>(demandCategory);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfReadyName, setPdfReadyName] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!pdfBlob) {
      setDownloadUrl(null);
      return;
    }
    const u = URL.createObjectURL(pdfBlob);
    setDownloadUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdfBlob]);

  const onUserMessage = useCallback(
    (text: string) => {
      const parsed = parseScopeFromUserText(text);
      if (parsed) setPdfScope(parsed);
    },
    [setPdfScope]
  );

  const handleGeneratePdf = useCallback(async () => {
    setPdfError("");
    setPdfBlob(null);
    setPdfReadyName("");
    setPdfGenerating(true);
    try {
      const [{ gatherInsightsForPdf }, { buildInsightsPdfBlob, insightsPdfFilename }] = await Promise.all([
        import("../lib/insightsPdfBundle"),
        import("../lib/buildInsightsPdf"),
      ]);
      const gathered = await gatherInsightsForPdf({
        scope: pdfScope,
        city: selectedCity,
        threshold,
        hotThreshold,
      });
      const blob = buildInsightsPdfBlob(gathered);
      setPdfBlob(blob);
      setPdfReadyName(insightsPdfFilename(pdfScope));
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Could not build PDF");
    } finally {
      setPdfGenerating(false);
    }
  }, [hotThreshold, pdfScope, selectedCity, threshold]);

  return (
    <>
      <button
        type="button"
        className="insights-assistant-tab"
        aria-expanded={open}
        aria-controls="insights-assistant-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="insights-assistant-tab__title">Ask me anything</span>
        <span className="insights-assistant-tab__sub">Insights Assistant</span>
      </button>

      {open && (
        <div
          className="insights-assistant-backdrop"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="insights-assistant-panel"
        className={`insights-assistant-panel${open ? " insights-assistant-panel--open" : ""}`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Insights Assistant"
      >
        <div className="insights-assistant-panel__head">
          <div>
            <p className="insights-assistant-panel__eyebrow">CPG Insight Engine</p>
            <h2 className="insights-assistant-panel__title">Insights Assistant</h2>
            <p className="insights-assistant-panel__sub">
              Natural-language Q&amp;A plus a consolidated PDF export for the category you choose (or all categories).
            </p>
          </div>
          <button
            type="button"
            className="insights-assistant-panel__close"
            onClick={() => setOpen(false)}
            aria-label="Close Insights Assistant"
          >
            ×
          </button>
        </div>

        <div className="insights-assistant-panel__body">
          <NlqPanel
            variant="drawer"
            introAssistantMessage={ASSISTANT_INTRO}
            onUserMessage={onUserMessage}
          />

          <div className="insights-assistant-pdf">
            <p className="insights-assistant-pdf__title">Export PDF</p>
            <p className="insights-assistant-pdf__hint">
              Which food category should this runbook include? <strong>All</strong> pulls basket + Ontario retail for
              every category (larger file). Matches the dashboard city and weather thresholds.
            </p>
            <label className="insights-assistant-pdf__label" htmlFor="insights-pdf-scope">
              Category
            </label>
            <select
              id="insights-pdf-scope"
              className="insights-assistant-pdf__select"
              value={pdfScope}
              onChange={(e) => {
                const v = e.target.value;
                setPdfScope(v === "all" ? "all" : (v as DemandCategory));
              }}
            >
              <option value="all">All categories</option>
              {DEMAND_CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="insights-assistant-pdf__actions">
              <button
                type="button"
                className="insights-assistant-pdf__btn insights-assistant-pdf__btn--primary"
                disabled={pdfGenerating}
                onClick={() => void handleGeneratePdf()}
              >
                {pdfGenerating ? "Generating…" : "Generate PDF"}
              </button>
              {downloadUrl && pdfReadyName && (
                <a
                  className="insights-assistant-pdf__btn insights-assistant-pdf__btn--download"
                  href={downloadUrl}
                  download={pdfReadyName}
                >
                  Download PDF
                </a>
              )}
            </div>
            {pdfError && <p className="insights-assistant-pdf__err">{pdfError}</p>}
          </div>
        </div>
      </aside>
    </>
  );
}
