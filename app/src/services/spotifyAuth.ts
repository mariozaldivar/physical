import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import { secureStorage } from "./secureStorage";
import { spotifyGet } from "./spotifyApi";

const SESSION_STORAGE_KEY = "physical.spotifySession";
// En web el flujo es de navegación completa (ver loginWithSpotify), no popup:
// evita la severidad de Cross-Origin-Opener-Policy que rompe `window.opener`
// en el flujo de popup de expo-auth-session con proveedores como Spotify.
const WEB_PKCE_STORAGE_KEY = "physical.spotifyPkce";

// Scopes mínimos para las features ya construidas (ver reglas de scopes en
// CLAUDE.md): identidad + guardado de sesión, lectura de playlists/canciones
// guardadas (spotifyLibrary.ts), lectura de lo que se está reproduciendo
// (spotifyPlayback.ts), y control de playback + cola (spotifyPlaybackControl.ts /
// hooks/usePlaybackControl.ts) — los helpers ya están listos, aunque el
// disparador automático por BPM todavía no existe (ver services_audio_features
// e instructions_archive en general).
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "user-library-read",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
];

const DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

export class SpotifyAuthError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  scope: string;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
  };
}

function requireClientId(): string {
  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new SpotifyAuthError(
      "Falta EXPO_PUBLIC_SPOTIFY_CLIENT_ID. Configúralo en app/.env (ver .env.example).",
    );
  }
  return clientId;
}

/**
 * Redirect URI de la app. Regla del proyecto: siempre HTTPS, excepto
 * http://127.0.0.1 para desarrollo local (nunca localhost, nunca wildcards).
 * En web se deriva forzando el host a 127.0.0.1; en nativo requiere una URL
 * HTTPS registrada en el dashboard de Spotify (pendiente de un endpoint de
 * backend que complete el deep link de vuelta a la app — ver .env.example).
 */
function getRedirectUri(): string {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      throw new SpotifyAuthError("No hay `window` disponible para calcular el redirect URI web.");
    }
    const port = window.location.port ? `:${window.location.port}` : "";
    // Sin slash final: Spotify compara el redirect_uri char por char contra lo
    // registrado en el dashboard, así que debe coincidir exactamente.
    return `http://127.0.0.1${port}`;
  }

  const redirectUri = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI;
  if (!redirectUri) {
    throw new SpotifyAuthError(
      "Falta EXPO_PUBLIC_SPOTIFY_REDIRECT_URI (debe ser HTTPS, registrado en el dashboard de Spotify). " +
        "Ver app/.env.example.",
    );
  }
  return redirectUri;
}

interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email?: string;
}

function toSession(
  tokens: { accessToken: string; refreshToken: string; expiresIn?: number; scope?: string },
  profile: SpotifyProfile,
): SpotifySession {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (tokens.expiresIn ?? 3600) * 1000,
    scope: tokens.scope ?? SCOPES.join(" "),
    user: {
      id: profile.id,
      displayName: profile.display_name ?? null,
      email: profile.email ?? null,
    },
  };
}

/** Intercambia el code por tokens, trae el perfil y guarda la sesión. Común a web y nativo. */
async function finishLogin(code: string, redirectUri: string, codeVerifier: string): Promise<SpotifySession> {
  const clientId = requireClientId();

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    { clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier } },
    DISCOVERY,
  );

  if (!tokenResponse.refreshToken) {
    throw new SpotifyAuthError("Spotify no devolvió un refresh token.");
  }

  const profile = await spotifyGet<SpotifyProfile>("/me", tokenResponse.accessToken);
  const session = toSession(
    {
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      expiresIn: tokenResponse.expiresIn,
      scope: tokenResponse.scope,
    },
    profile,
  );

  await saveSession(session);
  return session;
}

/**
 * Inicia el flujo Authorization Code with PKCE.
 *
 * En nativo usa el navegador in-app estándar (`AuthRequest.promptAsync`) y
 * resuelve con la sesión ya guardada.
 *
 * En web navega la pestaña completa a Spotify en vez de abrir un popup:
 * el flujo de popup de expo-web-browser depende de `window.opener`, y varios
 * navegadores lo rompen por Cross-Origin-Opener-Policy en accounts.spotify.com,
 * dejando el login "colgado" sin error visible. La navegación completa es el
 * flujo que documenta el propio tutorial de PKCE de Spotify para browser apps.
 * Por eso esta función nunca resuelve en web — la página se recarga y
 * `completeWebLoginIfRedirected` retoma el flujo al volver.
 */
export async function loginWithSpotify(): Promise<SpotifySession> {
  const clientId = requireClientId();
  const redirectUri = getRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    usePKCE: true,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
  });

  if (Platform.OS === "web") {
    const authUrl = await request.makeAuthUrlAsync(DISCOVERY);
    if (typeof window === "undefined" || !request.codeVerifier) {
      throw new SpotifyAuthError("No se pudo preparar el inicio de sesión con Spotify.");
    }
    window.sessionStorage.setItem(
      WEB_PKCE_STORAGE_KEY,
      JSON.stringify({ codeVerifier: request.codeVerifier, state: request.state }),
    );
    window.location.assign(authUrl);
    return new Promise<SpotifySession>(() => {}); // la navegación interrumpe la ejecución antes de llegar aquí
  }

  const result = await request.promptAsync(DISCOVERY);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new SpotifyAuthError("El usuario canceló el inicio de sesión con Spotify.");
  }
  if (result.type !== "success" || !result.params.code) {
    const description =
      result.type === "error"
        ? (result.error?.description ?? result.params.error_description)
        : undefined;
    throw new SpotifyAuthError(description ?? "No se recibió un código de autorización de Spotify.");
  }

  return finishLogin(result.params.code, redirectUri, request.codeVerifier ?? "");
}

/**
 * Llamar al montar la pantalla de login en web: si la URL trae `?code=...`
 * de vuelta de Spotify, completa el intercambio y guarda la sesión.
 * Devuelve `null` si no hay un login en curso (carga normal de la página).
 */
export async function completeWebLoginIfRedirected(): Promise<SpotifySession | null> {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(WEB_PKCE_STORAGE_KEY);
  const params = new URLSearchParams(window.location.search);
  const hasAuthParams = params.has("code") || params.has("error");
  if (!raw || !hasAuthParams) return null;

  window.sessionStorage.removeItem(WEB_PKCE_STORAGE_KEY);
  // Limpia la URL para que un refresh no reintente el intercambio con un code ya usado.
  window.history.replaceState({}, "", window.location.pathname);

  const { codeVerifier, state } = JSON.parse(raw) as { codeVerifier: string; state: string };
  const error = params.get("error");
  const code = params.get("code");

  if (error) {
    throw new SpotifyAuthError(params.get("error_description") ?? "Spotify devolvió un error de autorización.");
  }
  if (params.get("state") !== state || !code) {
    throw new SpotifyAuthError("La respuesta de Spotify no coincide con la solicitud original.");
  }

  return finishLogin(code, getRedirectUri(), codeVerifier);
}

/** Intercambia el refresh token por un access token nuevo (sin client secret, flujo PKCE). */
async function refreshSession(session: SpotifySession): Promise<SpotifySession> {
  const clientId = requireClientId();

  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId, refreshToken: session.refreshToken },
      DISCOVERY,
    );

    const next = toSession(
      {
        accessToken: refreshed.accessToken,
        // Spotify puede o no rotar el refresh token; si no manda uno nuevo, se conserva el actual.
        refreshToken: refreshed.refreshToken ?? session.refreshToken,
        expiresIn: refreshed.expiresIn,
        scope: refreshed.scope,
      },
      { id: session.user.id, display_name: session.user.displayName, email: session.user.email ?? undefined },
    );

    await saveSession(next);
    return next;
  } catch (error) {
    // El refresh token expiró o fue revocado: hay que reenviar al usuario a autorizar de nuevo.
    await clearSession();
    throw new SpotifyAuthError("La sesión de Spotify expiró. Vuelve a iniciar sesión.", error);
  }
}

async function saveSession(session: SpotifySession): Promise<void> {
  await secureStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

/** Carga la sesión guardada, renovándola automáticamente si está por expirar. */
export async function getSession(): Promise<SpotifySession | null> {
  const raw = await secureStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  const session = JSON.parse(raw) as SpotifySession;
  const isExpiringSoon = session.expiresAt - Date.now() < 60_000;
  if (!isExpiringSoon) return session;

  try {
    return await refreshSession(session);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await secureStorage.deleteItem(SESSION_STORAGE_KEY);
}
