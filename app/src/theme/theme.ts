/**
 * Tokens visuales de Physical.
 *
 * Paleta de tres zonas, cada una con un rol distinto:
 * - "app" (bg/surface/ink): la identidad propia de Physical, un azul-tinta profundo.
 * - "pulse" (hot/calm): el par de acentos que representa los dos modos del producto
 *   (modo ejercicio ↔ hot, modo estudio ↔ calm) — ver Planeacion_proyecto.md.
 * - "spotify" (black/green): reservado exclusivamente para contenido/CTAs de Spotify,
 *   siguiendo sus brand guidelines. Nunca se usa fuera del contexto de Spotify.
 */

export const colors = {
  bg: "#12182A",
  surface: "#1B2338",
  surfaceAlt: "#232C45",
  hairline: "#2C3654",

  ink: "#EDEFF5",
  inkMuted: "#8891A8",
  inkFaint: "#5B6580",

  pulseHot: "#FF6A4D",
  pulseHotDim: "#3A2A2E",
  pulseCalm: "#4DD9E8",
  pulseCalmDim: "#1F323A",

  spotifyBlack: "#000000",
  spotifyGreen: "#1DB954",
  spotifyGreenBright: "#1ED760",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Familias cargadas vía @expo-google-fonts/space-grotesk en App.tsx (useFonts). */
export const fonts = {
  display: "SpaceGrotesk_700Bold",
  displayMedium: "SpaceGrotesk_500Medium",
  displayRegular: "SpaceGrotesk_400Regular",
  // Texto de cuerpo/UI: se deja la fuente del sistema (undefined) a propósito,
  // para que la numeral display de Space Grotesk destaque como el único acento tipográfico.
  body: undefined,
} as const;

export type PulseZone = "hot" | "calm";

export const zoneColor = (zone: PulseZone) =>
  zone === "hot" ? colors.pulseHot : colors.pulseCalm;

export const zoneColorDim = (zone: PulseZone) =>
  zone === "hot" ? colors.pulseHotDim : colors.pulseCalmDim;
