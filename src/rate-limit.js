const buckets = new Map();

export function checkRateLimit(req, { limit = 120, windowMs = 5 * 60 * 1000 } = {}) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(ip, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now > value.resetAt) buckets.delete(key);
    }
  }

  return { allowed: true, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}
