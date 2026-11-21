"use client";

import { useEffect, useState } from "react";
import {
  FEEDS_ENDPOINT,
  POLL_INTERVAL_MS,
  parseFeedsResponse,
  canConnectToAggregator,
  type SignedFeed,
} from "@/lib/markets";

type FeedState = {
  feeds: SignedFeed[];
  status: "connecting" | "connected" | "offline";
  now: number;
};
export function useMarketFeeds() {
  const [state, setState] = useState<FeedState>({
    feeds: [],
    status: "connecting",
    now: 0,
  });
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 11_000);
      try {
        if (!canConnectToAggregator(window.location))
          throw new Error("Aggregator not configured for this origin");
        const response = await fetch(FEEDS_ENDPOINT, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Aggregator HTTP ${response.status}`);
        const feeds = parseFeedsResponse(await response.json());
        if (!disposed)
          setState({ feeds, status: "connected", now: Date.now() });
      } catch {
        if (!disposed)
          setState((previous) => ({
            ...previous,
            status: "offline",
            now: Date.now(),
          }));
      } finally {
        clearTimeout(timeout);
        if (!disposed) timer = setTimeout(refresh, POLL_INTERVAL_MS);
      }
    }
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, []);
  return state;
}
