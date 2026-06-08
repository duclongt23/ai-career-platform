export const AUTH_SESSION_EXPIRED_EVENT = "auth-session-expired";

export function getStoredUser() {
  const rawUser = localStorage.getItem("user");

  if (!rawUser) {
    return {};
  }

  try {
    const user = JSON.parse(rawUser);

    return user && typeof user === "object" ? user : {};
  } catch {
    localStorage.removeItem("user");
    return {};
  }
}

export function clearStoredAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}
