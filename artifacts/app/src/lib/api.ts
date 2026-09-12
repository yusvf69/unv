import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "uv_token";
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "https://your-api-url.com/api";

export function getApiBase(): string {
  return API_BASE;
}

async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setToken(token: string) {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

async function clearToken() {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export async function logoutClient() {
  await clearToken();
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      msg = (j as { error?: string }).error || msg;
    } catch {}
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if ((data as any).token) await setToken((data as any).token);
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T,>(path: string) => request<T>("DELETE", path),
};

// ----- Auth -----
export async function apiLogin(identifier: string, password: string) {
  const res = await fetch(`${API_BASE}/v2/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  if (data.token) await setToken(data.token);
  return data;
}

export async function apiCheckUser(email: string, phone: string) {
  const res = await fetch(`${API_BASE}/v2/auth/check-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, phone }),
  });
  return res.json();
}

export async function apiSendVerification(email: string, phone: string) {
  const res = await fetch(`${API_BASE}/v2/auth/send-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export async function apiVerifyCode(email: string, phone: string, code: string) {
  const res = await fetch(`${API_BASE}/v2/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, phone, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid code");
  return data;
}

export async function apiSignup(body: {
  name: string; username: string; email: string; phone: string;
  password: string; yearInCollege?: number; specialization?: string;
  groupName?: string; avatarUrl?: string;
}) {
  const res = await fetch(`${API_BASE}/v2/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Signup failed");
  if (data.token) await setToken(data.token);
  return data;
}

export async function apiForgotPassword(identifier: string) {
  const isEmail = identifier.includes("@");
  const body = isEmail ? { email: identifier } : { phone: identifier };
  const res = await fetch(`${API_BASE}/v2/auth/forgot-password`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
}

export async function apiVerifyResetCode(identifier: string, code: string) {
  const isEmail = identifier.includes("@");
  const body = isEmail ? { email: identifier, code } : { phone: identifier, code };
  const res = await fetch(`${API_BASE}/v2/auth/verify-reset-code`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid code");
  return data;
}

export async function apiResetPassword(identifier: string, code: string, newPassword: string) {
  const isEmail = identifier.includes("@");
  const body = isEmail
    ? { email: identifier, code, newPassword }
    : { phone: identifier, code, newPassword };
  const res = await fetch(`${API_BASE}/v2/auth/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  if (data.token) await setToken(data.token);
  return data;
}

// ----- Types (shared with web) -----
export interface MeV2 {
  id: number; name: string; email: string; phone: string | null;
  role: string; groupName: string | null; avatarUrl: string | null;
  department: string; year: number | null; yearInCollege: number | null;
  specialization: string | null; points: number; level: number;
  streak: number; title: string | null; emailVerified: boolean;
  phoneVerified: boolean; unreadCount: number; unreadDmCount: number;
  username: string | null; uniqueCode: string | null; adminPermissions: string | null;
}


