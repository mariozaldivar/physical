/**
 * Cliente HTTP compartido para la Spotify Web API. Centraliza el manejo de
 * errores documentado en su OpenAPI spec y el rate-limiting (ver reglas de
 * integración con Spotify en CLAUDE.md): lee `error.message` del cuerpo, y
 * ante 429 respeta `Retry-After` con un solo reintento — nunca loop apretado.
 */

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

async function request<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 429 && !isRetry) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "1");
    await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    return request<T>(path, accessToken, init, true);
  }

  // Ej. GET /me/player/currently-playing cuando no hay nada sonando.
  if (response.status === 204) {
    return null as T;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = body?.error?.message ?? `Spotify respondió ${response.status}`;
    throw new SpotifyApiError(message, response.status, body);
  }

  // Algunos endpoints de /me/player documentan 204 pero en la práctica se ha
  // visto responder 200 con cuerpo vacío — sin este check, `response.json()`
  // revienta con un error crudo del motor JS ("unexpected character at line 1
  // column 1...") que no dice nada útil. Cuerpo vacío = igual que 204.
  const text = await response.text();
  if (!text) return null as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new SpotifyApiError(`Spotify respondió ${response.status} con un cuerpo inesperado (no-JSON) en ${path}`, response.status);
  }
}

export function spotifyGet<T>(path: string, accessToken: string): Promise<T> {
  return request<T>(path, accessToken);
}

/**
 * PUT/POST genérico para los endpoints de control de playback (todos devuelven
 * 204 sin cuerpo en éxito — `request` ya lo maneja). `body`, si se manda, va
 * como JSON en el request body (no confundir con query params, que van en `path`
 * junto con `buildQuery`).
 */
export function spotifyMutate<T = null>(
  method: "PUT" | "POST",
  path: string,
  accessToken: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, accessToken, {
    method,
    ...(body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
}

/** Arma un query string omitiendo valores undefined. */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
