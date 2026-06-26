/** Shared zoom math for tactical (CSS-scale) and overworld (SVG pan+scale) maps. */

export const TACTICAL_ZOOM_MIN = 0.6;
export const TACTICAL_ZOOM_MAX = 1.6;
export const TACTICAL_ZOOM_STEP = 0.2;

export const OVERWORLD_ZOOM_MIN = 0.5;
export const OVERWORLD_ZOOM_MAX = 2.5;
export const OVERWORLD_ZOOM_STEP = 0.15;

/** Clamp + round a zoom factor to avoid floating-point drift across steps. */
export function clampZoom(z: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, z)) * 100) / 100;
}

/** Keep the content point under the cursor fixed when CSS-scale zoom changes. */
export function scrollForZoom(params: {
  scrollLeft: number;
  scrollTop: number;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number };
  oldZoom: number;
  newZoom: number;
}): { scrollLeft: number; scrollTop: number } {
  const { scrollLeft, scrollTop, clientX, clientY, rect, oldZoom, newZoom } =
    params;
  if (oldZoom === newZoom) return { scrollLeft, scrollTop };

  const offsetX = clientX - rect.left + scrollLeft;
  const offsetY = clientY - rect.top + scrollTop;
  const ratio = newZoom / oldZoom;
  return {
    scrollLeft: offsetX * ratio - (clientX - rect.left),
    scrollTop: offsetY * ratio - (clientY - rect.top),
  };
}

/** Keep the SVG content point under the cursor fixed when pan+scale zoom changes. */
export function panForSvgZoom(params: {
  panX: number;
  panY: number;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number };
  oldZoom: number;
  newZoom: number;
}): { panX: number; panY: number } {
  const { panX, panY, clientX, clientY, rect, oldZoom, newZoom } = params;
  if (oldZoom === newZoom) return { panX, panY };

  const gridX = (clientX - rect.left - panX) / oldZoom;
  const gridY = (clientY - rect.top - panY) / oldZoom;
  return {
    panX: clientX - rect.left - gridX * newZoom,
    panY: clientY - rect.top - gridY * newZoom,
  };
}
