import type { Express, Request, Response } from "express";
import { getStatCanSummary } from "./statcanService.js";

export function registerStatCanRoutes(app: Express): void {
  app.get("/api/statcan/summary", async (req: Request, res: Response) => {
    try {
      const forceCatalog = req.query.forceCatalog === "1" || req.query.forceCatalog === "true";
      const forceSeries = req.query.forceSeries === "1" || req.query.forceSeries === "true";
      const forceAutoDiscover = req.query.forceAuto === "1" || req.query.forceAuto === "true";
      const payload = await getStatCanSummary({ forceCatalog, forceSeries, forceAutoDiscover });
      res.json(payload);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });
}
