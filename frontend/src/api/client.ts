export const BASE_URL      = import.meta.env.VITE_API_BASE_URL    ?? "/api"
export const WS_URL        = import.meta.env.VITE_WS_URL          ?? "ws://localhost:3001/data"
export const ALERTS_WS_URL = import.meta.env.VITE_ALERTS_WS_URL   ?? "ws://localhost:3001/alerts"

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}
