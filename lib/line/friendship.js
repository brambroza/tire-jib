const LINE_FRIENDSHIP_STATUS_URL = "https://api.line.me/friendship/v1/status";

export async function fetchLineFriendshipStatus(accessToken) {
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("missing_line_access_token");
  }

  const response = await fetch(LINE_FRIENDSHIP_STATUS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`line_friendship_status_error:${response.status}`);
  }

  return Boolean(payload?.friendFlag);
}
