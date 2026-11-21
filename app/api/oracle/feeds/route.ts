import { getHostedFeeds } from "@/lib/hosted-feeds";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET() {
  const key = process.env.ORACELL_PUBLISHER_PRIVATE_KEY?.trim();
  if (!key) {
    return Response.json({ error: "Oracle publisher is not configured" }, { status: 503 });
  }
  try {
    const snapshot = await getHostedFeeds(key);
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "public, s-maxage=15",
      },
    });
  } catch (error) {
    console.warn("Hosted oracle snapshot unavailable:", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Oracle data temporarily unavailable" }, { status: 503 });
  }
}
