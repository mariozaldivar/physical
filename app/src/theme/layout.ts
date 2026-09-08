import { useWindowDimensions } from "react-native";

/**
 * Adaptación a pantallas chicas.
 *
 * La composición de Home es proporcional a propósito (monitor 1 / now playing 3
 * / cola 1 — ver HomeScreen), y esa jerarquía se conserva mientras la pantalla
 * dé para ella. Cuando no da, cada bloque cae a la altura mínima en la que
 * sigue siendo legible y la pantalla se desplaza, en vez de comprimirse hasta
 * romperse: es la diferencia entre un layout que se adapta y uno que se
 * aplasta. Estos mínimos son la única fuente de esos números.
 */
export const MIN_BLOCK_HEIGHT = {
  monitor: 88,
  nowPlaying: 296,
  queue: 116,
} as const;

export interface ScreenSize {
  width: number;
  height: number;
  /** Pantallas bajas (≈5" y menos, o multiventana): 360×640 y similares. */
  compact: boolean;
  /** Pantallas angostas donde una fila de dos controles ya no cabe. */
  narrow: boolean;
}

export function useScreenSize(): ScreenSize {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    compact: height < 700,
    narrow: width < 360,
  };
}

/**
 * Tope a la escala de fuente del sistema para el texto que vive dentro de una
 * caja de alto fijo (numerales, etiquetas de botones). El texto de lectura no
 * lo lleva: ahí la escala del usuario debe respetarse completa.
 */
export const MAX_FONT_SCALE = 1.3;
