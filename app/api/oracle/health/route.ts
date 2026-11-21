import { hostedResponse } from "@/lib/hosted-response";

export const runtime = "nodejs";
export const maxDuration = 10;

export function GET() {
  return hostedResponse(({ publisherPubkey, ckbTip, updatedAtMs, feeds }) => ({
    status: "ok",
    publisherPubkey,
    ckbTip,
    lastUpdatedMs: updatedAtMs,
    pairCount: feeds.length,
    activePairs: feeds.map((feed) => feed.pair),
  }));
}
