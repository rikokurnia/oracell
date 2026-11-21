import { hostedResponse } from "@/lib/hosted-response";
import { normalizePairInput } from "@/services/aggregator/dist/aggregator";

export const runtime = "nodejs";
export const maxDuration = 10;

export function GET(request: Request) {
  const rawPair = new URL(request.url).searchParams.get("pair");
  const pair = rawPair && normalizePairInput(rawPair);
  if (!pair) {
    return Response.json({ error: "Specify a supported pair, such as CKB_USDT" }, { status: 400 });
  }
  return hostedResponse((snapshot) => snapshot.feeds.find((feed) => feed.pair === pair));
}
