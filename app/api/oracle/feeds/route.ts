import { hostedResponse } from "@/lib/hosted-response";

export const runtime = "nodejs";
export const maxDuration = 10;

export function GET() {
  return hostedResponse((snapshot) => snapshot);
}
