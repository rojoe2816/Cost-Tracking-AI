import { createHash, randomUUID } from "node:crypto";

const MAX_PUBLIC_JSON_BYTES = 64 * 1024;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function getPublicRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();

  if (supplied && REQUEST_ID_PATTERN.test(supplied)) {
    return supplied;
  }

  return `slate_req_${randomUUID()}`;
}

export function publicJson(
  value: unknown,
  init: { status: number; requestId: string; headers?: HeadersInit },
): Response {
  return Response.json(value, {
    status: init.status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": init.requestId,
      ...init.headers,
    },
  });
}

export async function readPublicJsonBody(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; code: string; message: string }
> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > MAX_PUBLIC_JSON_BYTES) {
    return {
      ok: false,
      code: "REQUEST_TOO_LARGE",
      message: "Request body exceeds the 64 KB limit.",
    };
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > MAX_PUBLIC_JSON_BYTES) {
    return {
      ok: false,
      code: "REQUEST_TOO_LARGE",
      message: "Request body exceeds the 64 KB limit.",
    };
  }

  try {
    return { ok: true, value: JSON.parse(rawBody) as unknown };
  } catch {
    return {
      ok: false,
      code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    };
  }
}

export function checkPublicRateLimit(input: {
  request: Request;
  route: string;
  maxRequests?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const maxRequests = input.maxRequests ?? 60;
  const windowMs = input.windowMs ?? 60_000;
  const identity =
    input.request.headers.get("authorization") ??
    input.request.headers.get("x-forwarded-for") ??
    "anonymous";
  const safeIdentity = createHash("sha256").update(identity).digest("hex");
  const key = `${input.route}:${safeIdentity}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= maxRequests) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function resetPublicRateLimitsForTests(): void {
  rateLimitBuckets.clear();
}
