import { auth } from "./firebase";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Errors from the API arrive as JSON with a `message` (and sometimes a
// `problems` array from the publish check). Throwing a plain Error would
// lose all of that and leave the UI showing "Failed to fetch", so the
// status and body travel with the error.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly problems?: string[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // Multipart uploads pass FormData directly — the browser has to set its
  // own Content-Type with the boundary, so this path must not add one.
  formData?: FormData;
  // Server Components call the public endpoints with no user at all;
  // passing null skips the Firebase lookup entirely.
  token?: string | null;
  cache?: RequestCache;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers();
  const token =
    options.token === undefined
      ? await auth.currentUser?.getIdToken()
      : options.token;

  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    throw await toApiError(response, path);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function toApiError(response: Response, path: string): Promise<ApiError> {
  let message = `Запит ${path} не вдався (${response.status})`;
  let problems: string[] | undefined;

  try {
    const payload = (await response.json()) as {
      message?: string | string[];
      problems?: string[];
    };

    if (Array.isArray(payload.message)) {
      // class-validator returns one string per failed rule.
      message = payload.message.join("; ");
    } else if (payload.message) {
      message = payload.message;
    }

    problems = payload.problems;
  } catch {
    // A non-JSON error body (proxy timeout, HTML error page) leaves the
    // default message in place rather than throwing a second error here.
  }

  return new ApiError(response.status, message, problems);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", formData }),
};

// The API returns media links as paths (`/media/<id>/download`) because it
// does not know which host it is reachable at. Everything that renders one
// goes through here.
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_URL}${path}`;
}
