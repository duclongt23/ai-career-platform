const DRAFT_KEY_PREFIX = "discovery-draft";

const getUserDraftId = (user = {}) =>
  user.id || user._id || user.email || "guest";

export const getDiscoveryDraftKey = (draftName, user) =>
  `${DRAFT_KEY_PREFIX}:${draftName}:${getUserDraftId(user)}`;

export function readDiscoveryDraft(key) {
  try {
    const rawDraft = localStorage.getItem(key);
    return rawDraft ? JSON.parse(rawDraft) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function writeDiscoveryDraft(key, draft) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...draft,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // localStorage can be unavailable or full. The quiz still works in memory.
  }
}

export function clearDiscoveryDraft(key) {
  localStorage.removeItem(key);
}
