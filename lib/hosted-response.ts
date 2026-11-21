import { getHostedFeeds } from "./hosted-feeds";

export async function hostedResponse(
  select: (snapshot: Awaited<ReturnType<typeof getHostedFeeds>>) => unknown,
) {
  const key = process.env.ORACELL_PUBLISHER_PRIVATE_KEY?.trim();
  const headers = { "Cache-Control": "no-store" };
  if (!key) {
    return Response.json({ error: "Oracle publisher is not configured" }, { status: 503, headers });
  }
  try {
    const data = select(await getHostedFeeds(key));
    if (data === undefined) {
      return Response.json({ error: "The requested feed is temporarily unavailable" }, { status: 503, headers });
    }
    return Response.json(data, {
      headers: { ...headers, "Vercel-CDN-Cache-Control": "public, s-maxage=15" },
    });
  } catch (error) {
    console.warn("Hosted oracle snapshot unavailable:", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Oracle data temporarily unavailable" }, { status: 503, headers });
  }
}
