import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;

// --- Method allowlist ---
const ALLOWED_METHODS = new Set([
  "getBalance",
  "getAccountInfo",
  "getTokenAccountsByOwner",
  "getParsedTokenAccountsByOwner",
  "getLatestBlockhash",
  "getEpochInfo",
  "getSlot",
  "getBlockHeight",
  "sendTransaction",
  "simulateTransaction",
  "getTransaction",
  "getSignatureStatuses",
  "confirmTransaction",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getTokenAccountBalance",
  "getFeeForMessage",
  "getMinimumBalanceForRentExemption",
  "getRecentPrioritizationFees",
]);

// --- Rate limiting: 100 req/min per IP ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodically clean up stale entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // Origin validation — only allow same-origin requests
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (origin && host && !origin.includes(host)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!HELIUS_RPC_URL) {
    return NextResponse.json(
      { error: "RPC endpoint not configured" },
      { status: 500 }
    );
  }

  // Rate limit check
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate JSON-RPC shape (single or batched)
  const items = Array.isArray(body) ? body : [body];
  for (const item of items) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("method" in item) ||
      !("jsonrpc" in item)
    ) {
      return NextResponse.json(
        { error: "Invalid JSON-RPC request" },
        { status: 400 }
      );
    }

    // Method allowlist check
    if (!ALLOWED_METHODS.has((item as { method: string }).method)) {
      return NextResponse.json(
        { error: `Method not allowed: ${(item as { method: string }).method}` },
        { status: 403 }
      );
    }
  }

  try {
    const resp = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    console.error("RPC proxy error:", err);
    return NextResponse.json(
      { error: "RPC request failed" },
      { status: 502 }
    );
  }
}
