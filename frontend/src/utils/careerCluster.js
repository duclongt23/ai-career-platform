export function normalizeCareerClusters(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[;\n]/)
        .map((item) => item.trim());
  const seen = new Set();

  return values
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }

      seen.add(item);
      return true;
    });
}

export function formatCareerClusters(value, fallback = "") {
  const clusters = normalizeCareerClusters(value);

  return clusters.length ? clusters.join(", ") : fallback;
}
