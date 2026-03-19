const ENV_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function resolveApiUrl(): string {
  if (typeof window === "undefined") return ENV_API_URL || "http://localhost:3001";
  if (!ENV_API_URL) return window.location.origin;

  const host = window.location.hostname;
  const appIsLocal = host === "localhost" || host === "127.0.0.1";
  const apiIsLocal = /localhost|127\.0\.0\.1/.test(ENV_API_URL);

  // Telegram clients can't reach localhost on your dev machine
  if (apiIsLocal && !appIsLocal) return window.location.origin;
  return ENV_API_URL;
}

const API_URL = resolveApiUrl();

class ApiClient {
  private token: string | null = null;

  setToken(t: string | null) { this.token = t; }
  getToken() { return this.token; }

  private headers(): HeadersInit {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async err(res: Response) {
    try {
      const body = await res.json();
      return new Error(body.message || body.error || res.statusText);
    } catch {
      return new Error(res.statusText);
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, { headers: this.headers() });
    if (!res.ok) throw await this.err(res);
    return res.json();
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await this.err(res);
    return res.json();
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.err(res);
    return res.json();
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await this.err(res);
    return res.json();
  }

  async del(path: string): Promise<void> {
    const res = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!res.ok) throw await this.err(res);
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const h: HeadersInit = {};
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: h,
      body: formData,
    });
    if (!res.ok) throw await this.err(res);
    return res.json();
  }

  streamUrl(path: string): string { return `${API_URL}${path}`; }
}

export const api = new ApiClient();
