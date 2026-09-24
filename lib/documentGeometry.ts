/**
 * Pure geometry helpers for the document preview and the signature overlay.
 *
 * These are deliberately free of React Native imports so they can be unit
 * tested on their own - the signature placement maths is the part that has to
 * be exactly right for exports to match what the user saw on screen.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Smallest signature is 4% of the page width - fits tiny signature boxes. */
export const SIGNATURE_MIN_WIDTH_RATIO = 0.04;
export const SIGNATURE_MAX_WIDTH_RATIO = 1;
export const SIGNATURE_DEFAULT_WIDTH_RATIO = 0.3;
/** Fallback when a signature image's intrinsic size cannot be read. */
export const SIGNATURE_FALLBACK_ASPECT = 0.5;
/** A4 portrait, used until the real page size is known. */
export const FALLBACK_PAGE_ASPECT = 1 / 1.4142;
/** Cap on the baked page's longest edge - A4 at ~300dpi, keeps memory sane. */
export const MAX_BAKE_EDGE = 2400;

export const clampSignatureWidthRatio = (value: number) =>
  Math.max(
    SIGNATURE_MIN_WIDTH_RATIO,
    Math.min(SIGNATURE_MAX_WIDTH_RATIO, value),
  );

/** Largest box with `aspect` (width / height) that fits inside `box`. */
export const fitContain = (aspect: number, box: Size): Size => {
  if (!box.width || !box.height || !aspect || aspect <= 0) {
    return { width: 0, height: 0 };
  }
  let width = box.width;
  let height = width / aspect;
  if (height > box.height) {
    height = box.height;
    width = height * aspect;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
};

/**
 * Converts a signature's normalized model into pixel geometry on a page of
 * `page` size, keeping the whole signature inside the page.
 */
export const signatureRectForPage = (
  model: { nx: number; ny: number; nWidth: number; aspect: number },
  page: Size,
): Rect => {
  if (!page.width || !page.height) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const width = clampSignatureWidthRatio(model.nWidth) * page.width;
  const height = width * (model.aspect || SIGNATURE_FALLBACK_ASPECT);
  const x = Math.max(0, Math.min(page.width - width, model.nx * page.width));
  const y = Math.max(0, Math.min(page.height - height, model.ny * page.height));
  return { x, y, width, height };
};

/** Keeps a dragged signature fully inside the page. */
export const clampSignaturePosition = (
  x: number,
  y: number,
  size: Size,
  page: Size,
): { x: number; y: number } => ({
  x: Math.max(0, Math.min(Math.max(0, page.width - size.width), x)),
  y: Math.max(0, Math.min(Math.max(0, page.height - size.height), y)),
});

/**
 * Resolves a resize drag into a new signature box that keeps the signature's
 * aspect ratio, respects the minimum size and stays inside the page.
 */
export const resolveSignatureResize = (
  startWidth: number,
  deltaWidth: number,
  origin: { x: number; y: number },
  aspect: number,
  page: Size,
): Size => {
  const safeAspect = aspect || SIGNATURE_FALLBACK_ASPECT;
  const minWidth = page.width * SIGNATURE_MIN_WIDTH_RATIO;
  let width = Math.max(minWidth, startWidth + deltaWidth);
  width = Math.min(width, Math.max(minWidth, page.width - origin.x));
  let height = width * safeAspect;
  if (origin.y + height > page.height) {
    height = Math.max(minWidth * safeAspect, page.height - origin.y);
    width = height / safeAspect;
  }
  return { width, height };
};

/**
 * Output size for the baked page: the page's own pixel size, capped so a very
 * large scan cannot blow up memory. Aspect ratio is always preserved.
 */
export const computeBakeSize = (pageSize: Size | null): Size | null => {
  if (!pageSize || !pageSize.width || !pageSize.height) return null;
  const longestEdge = Math.max(pageSize.width, pageSize.height);
  const scale = longestEdge > MAX_BAKE_EDGE ? MAX_BAKE_EDGE / longestEdge : 1;
  return {
    width: Math.round(pageSize.width * scale),
    height: Math.round(pageSize.height * scale),
  };
};

/** Viewport translation bounds while the page is zoomed in. */
export const clampZoomTranslate = (
  x: number,
  y: number,
  scale: number,
  viewport: Size,
): { x: number; y: number } => {
  if (!viewport.width || !viewport.height) return { x: 0, y: 0 };
  const maxX = (viewport.width * (scale - 1)) / 2;
  const maxY = (viewport.height * (scale - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y)),
  };
};
