type Bucket = { startedAt: number; count: number };

const buckets = new Map<string, Bucket>();

/** Process-local guardrail; production should mirror this at the edge/gateway. */
export function allowNativeChatAction(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function clearNativeChatRateLimits() {
  buckets.clear();
}
