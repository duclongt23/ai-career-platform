const MAX_SEARCH_RESULTS = 5;

function normalizeSearchResult(result) {
  const url = String(result?.url || "").trim();

  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    return null;
  }

  return {
    title: String(result.title || url).trim().slice(0, 180),
    url,
    content: String(result.content || "").trim().slice(0, 900),
  };
}

async function searchVietnamJobMarket({ careerTitle, question }) {
  if (!process.env.TAVILY_API_KEY) {
    return {
      results: [],
      status: "not_configured",
    };
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${careerTitle} ${question} thị trường việc làm Việt Nam`,
      topic: "general",
      country: "vietnam",
      search_depth: "basic",
      max_results: MAX_SEARCH_RESULTS,
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(12 * 1000),
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  const payload = await response.json();

  return {
    results: (payload.results || []).map(normalizeSearchResult).filter(Boolean),
    status: "completed",
  };
}

module.exports = { searchVietnamJobMarket };
