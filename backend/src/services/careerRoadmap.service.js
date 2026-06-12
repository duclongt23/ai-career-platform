const MIN_PHASE_COUNT = 5;
const MAX_PHASE_COUNT = 6;
const MIN_ACTION_COUNT = 2;
const MAX_ACTION_COUNT = 3;
const MAX_SUMMARY_LENGTH = 180;
const MAX_TITLE_LENGTH = 48;
const MAX_TIMEFRAME_LENGTH = 32;
const MAX_FOCUS_LENGTH = 120;
const MAX_ACTION_LENGTH = 90;
const MAX_CHECKPOINT_LENGTH = 110;
const MAX_CACHED_CAREER_ROADMAP_ENTRIES = 30;

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
        // Surface a consistent validation error below.
      }
    }

    throw new Error("DeepSeek returned invalid career roadmap JSON");
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isLengthValid(value, maxLength) {
  return value.length > 0 && value.length <= maxLength;
}

function normalizePhaseId(value, index) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return normalized || `phase-${index + 1}`;
}

function parseCareerRoadmap(rawResponse) {
  const response = parseJsonObject(rawResponse);
  const summary = normalizeString(response.summary);
  const rawPhases = Array.isArray(response.phases) ? response.phases : [];

  if (
    !isLengthValid(summary, MAX_SUMMARY_LENGTH) ||
    rawPhases.length < MIN_PHASE_COUNT ||
    rawPhases.length > MAX_PHASE_COUNT
  ) {
    throw new Error("DeepSeek returned invalid career roadmap");
  }

  const phases = rawPhases.map((phase, index) => {
    const title = normalizeString(phase?.title);
    const timeframe = normalizeString(phase?.timeframe);
    const focus = normalizeString(phase?.focus);
    const checkpoint = normalizeString(phase?.checkpoint);
    const actions = Array.isArray(phase?.actions)
      ? phase.actions.map(normalizeString).filter(Boolean)
      : [];

    if (
      !isLengthValid(title, MAX_TITLE_LENGTH) ||
      !isLengthValid(timeframe, MAX_TIMEFRAME_LENGTH) ||
      !isLengthValid(focus, MAX_FOCUS_LENGTH) ||
      !isLengthValid(checkpoint, MAX_CHECKPOINT_LENGTH) ||
      actions.length < MIN_ACTION_COUNT ||
      actions.length > MAX_ACTION_COUNT ||
      actions.some((action) => !isLengthValid(action, MAX_ACTION_LENGTH))
    ) {
      throw new Error("DeepSeek returned invalid career roadmap phase");
    }

    return {
      id: normalizePhaseId(phase?.id, index),
      title,
      timeframe,
      focus,
      actions,
      checkpoint,
    };
  });

  return { summary, phases };
}

function findCachedCareerRoadmap(entries, { careerId, careerUpdatedAt }) {
  const normalizedCareerId = String(careerId);
  const normalizedCareerUpdatedAt = new Date(careerUpdatedAt).getTime();

  return [...(entries || [])].reverse().find(
    (entry) =>
      String(entry.careerId) === normalizedCareerId &&
      new Date(entry.careerUpdatedAt).getTime() === normalizedCareerUpdatedAt
  );
}

module.exports = {
  findCachedCareerRoadmap,
  MAX_CACHED_CAREER_ROADMAP_ENTRIES,
  parseCareerRoadmap,
};
