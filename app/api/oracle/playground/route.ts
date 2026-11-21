import { PHASE_ONE_PUBLISHER_PUBKEY } from "@/lib/publisher";
import { normalizePairInput } from "@/services/aggregator/dist/aggregator";
import {
  DEFAULT_AGGREGATOR_URL,
  OracellClient,
  decodeOracleWitness,
  injectOracleProof,
} from "@/packages/sdk/dist-hosted/index";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(request: Request) {
  const pair = normalizePairInput(
    new URL(request.url).searchParams.get("pair") ?? "",
  );
  if (!pair)
    return Response.json(
      { error: "Choose a supported market" },
      { status: 400 },
    );

  const client = new OracellClient({
    fetchImpl: (input, init) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(7_000) }),
  });
  const started = performance.now();
  try {
    const quote = await client.getLatestPrice(pair);
    const fetchMs = performance.now() - started;
    const sdkStart = performance.now();
    if (!client.verifyFeed(quote, PHASE_ONE_PUBLISHER_PUBKEY))
      throw new Error("Invalid quote signature");
    const tx = injectOracleProof({ witnesses: ["0x"], headerDeps: [] }, quote);
    const witness = tx.witnesses[1];
    const decoded = decodeOracleWitness(witness);
    return Response.json({
      aggregator: DEFAULT_AGGREGATOR_URL,
      pair: decoded.payload.pair,
      priceScaled: decoded.payload.priceScaled,
      decimals: decoded.payload.decimals,
      anchorHeight: decoded.payload.blockNumber,
      headerDeps: tx.headerDeps,
      witness,
      witnessBytes: (witness.length - 2) / 2,
      signatureValid: true,
      fetchMs: Math.round(fetchMs),
      sdkMs: Math.round((performance.now() - sdkStart) * 100) / 100,
    });
  } catch {
    return Response.json(
      {
        error:
          "The hosted quote or SDK verification failed. Try again shortly.",
      },
      { status: 503 },
    );
  }
}
