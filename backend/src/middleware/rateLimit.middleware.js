function createRateLimiter({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
  keyGenerator = (req) => req.ip,
} = {}) {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const bucket = hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      hits.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message });
    }

    return next();
  };
}

const globalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many authentication attempts. Please try again later.",
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}`,
});

const careerExploreChatRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many career chat requests. Please try again later.",
  keyGenerator: (req) => `${req.user?._id || req.ip}:career-explore-chat`,
});

module.exports = {
  authRateLimit,
  careerExploreChatRateLimit,
  createRateLimiter,
  globalRateLimit,
};
