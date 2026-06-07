const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("access_token") ?? "";

  const res = await fetch(input, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });

  if (res.status !== 401) return res;

  try {
    const refreshRes = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!refreshRes.ok) throw new Error();
    const { accessToken } = await refreshRes.json();
    localStorage.setItem("access_token", accessToken);

    return fetch(input, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
    });
  } catch {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    window.location.href = "/login";
    return res;
  }
}
