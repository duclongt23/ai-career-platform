const MIN_ACTIVITY_COUNT = 5;
const MAX_ACTIVITY_COUNT = 7;
const MAX_ACTIVITY_LENGTH = 300;
const MAX_CACHED_DAY_IN_LIFE_ENTRIES = 30;

function parseJsonObject(rawResponse) {
  const trimmedResponse = String(rawResponse || "").trim();

  try {
    return JSON.parse(trimmedResponse);
  } catch {
    const withoutCodeFence = trimmedResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const firstBraceIndex = withoutCodeFence.indexOf("{");
    const lastBraceIndex = withoutCodeFence.lastIndexOf("}");

    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      try {
        return JSON.parse(
          withoutCodeFence.slice(firstBraceIndex, lastBraceIndex + 1)
        );
      } catch {
        // Báo lỗi phía dưới thay vì tự đoán nội dung model trả về.
      }
    }

    throw new Error("DeepSeek returned invalid career day in life JSON");
  }
}

function parseCareerDayInLife(rawResponse) {
  const response = parseJsonObject(rawResponse);
  const activities = Array.isArray(response.activities)
    ? response.activities.map((activity) =>
        typeof activity === "string" ? activity.trim() : ""
      )
    : [];

  if (
    activities.length < MIN_ACTIVITY_COUNT ||
    activities.length > MAX_ACTIVITY_COUNT ||
    activities.some(
      (activity) => !activity || activity.length > MAX_ACTIVITY_LENGTH
    )
  ) {
    throw new Error("DeepSeek returned invalid career day in life activities");
  }

  return activities;
}

function findCachedCareerDayInLife(entries, { careerId, careerUpdatedAt }) {
  const normalizedCareerId = String(careerId);
  const normalizedCareerUpdatedAt = new Date(careerUpdatedAt).getTime();

  return [...(entries || [])].reverse().find(
    (entry) =>
      String(entry.careerId) === normalizedCareerId &&
      new Date(entry.careerUpdatedAt).getTime() === normalizedCareerUpdatedAt
  );
}

module.exports = {
  findCachedCareerDayInLife,
  MAX_CACHED_DAY_IN_LIFE_ENTRIES,
  parseCareerDayInLife,
};
