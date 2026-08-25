import { auth } from "./firebase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Thin fetch wrapper: attaches the current Firebase ID token so every
// call is authenticated the same way apps/api's FirebaseAuthGuard expects.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status}`);
  }
  return response.json();
}
