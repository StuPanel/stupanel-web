const SEVEN_DAYS = 7 * 24 * 60 * 60;

export function setAccessTokenCookie(token: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `access_token=${token}; path=/; max-age=${SEVEN_DAYS}; SameSite=Lax${secure}`;
}

export function clearAccessTokenCookie() {
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
}
