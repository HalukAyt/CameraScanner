/**
 * Unit tests for the signature / preview geometry.
 *
 * Run with:  npx tsc lib/documentGeometry.ts lib/documentGeometry.test.ts \
 *              --outDir <tmp> --module commonjs --target es2019 && node <tmp>/documentGeometry.test.js
 */
import {
  clampSignaturePosition,
  clampSignatureWidthRatio,
  clampZoomTranslate,
  computeBakeSize,
  fitContain,
  MAX_BAKE_EDGE,
  resolveSignatureResize,
  SIGNATURE_MIN_WIDTH_RATIO,
  signatureRectForPage,
} from "./documentGeometry";

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = "") => {
  if (condition) {
    passed += 1;
  } else {
    failures.push(`${name}${detail ? ` -> ${detail}` : ""}`);
  }
};

const near = (a: number, b: number, tolerance = 0.001) =>
  Math.abs(a - b) <= tolerance;

// --- fitContain ---------------------------------------------------------
{
  // A4 portrait page inside a wide-ish viewport: height is the binding limit.
  const a4 = 1 / 1.4142;
  const r = fitContain(a4, { width: 400, height: 500 });
  check(
    "fitContain fits inside the box",
    r.width <= 400 && r.height <= 500,
    JSON.stringify(r),
  );
  check(
    "fitContain keeps the aspect ratio",
    near(r.width / r.height, a4, 0.01),
    `${r.width}x${r.height}`,
  );
  check(
    "fitContain maximises the page",
    r.height >= 499 - 1,
    JSON.stringify(r),
  );

  // Landscape page inside a tall viewport: width is the binding limit.
  const landscape = 1.4142;
  const l = fitContain(landscape, { width: 400, height: 900 });
  check(
    "fitContain landscape uses full width",
    l.width === 400,
    JSON.stringify(l),
  );
  check(
    "fitContain landscape keeps aspect",
    near(l.width / l.height, landscape, 0.01),
    `${l.width}x${l.height}`,
  );

  check(
    "fitContain handles an unmeasured viewport",
    fitContain(a4, { width: 0, height: 0 }).width === 0,
  );
}

// --- clampSignatureWidthRatio -------------------------------------------
{
  check(
    "signature cannot shrink below the minimum",
    clampSignatureWidthRatio(0.0001) === SIGNATURE_MIN_WIDTH_RATIO,
  );
  check("signature cannot exceed the page", clampSignatureWidthRatio(5) === 1);
  check(
    "signature keeps a valid size",
    clampSignatureWidthRatio(0.25) === 0.25,
  );
  check(
    "minimum signature is much smaller than the old 0.5x floor",
    SIGNATURE_MIN_WIDTH_RATIO < 0.1,
  );
}

// --- signatureRectForPage ------------------------------------------------
{
  const page = { width: 600, height: 848 };
  const model = { nx: 0.5, ny: 0.64, nWidth: 0.3, aspect: 0.5 };
  const rect = signatureRectForPage(model, page);
  check(
    "rect width follows the page",
    near(rect.width, 180),
    JSON.stringify(rect),
  );
  check(
    "rect height follows the aspect",
    near(rect.height, 90),
    JSON.stringify(rect),
  );
  check("rect x maps from normalized", near(rect.x, 300), JSON.stringify(rect));

  // The same model on a differently sized preview must land on the same
  // RELATIVE spot - this is what makes fullscreen and export agree.
  const bigPage = { width: 1200, height: 1696 };
  const bigRect = signatureRectForPage(model, bigPage);
  check(
    "same model lands on the same relative spot at any preview size",
    near(bigRect.x / bigPage.width, rect.x / page.width) &&
      near(bigRect.y / bigPage.height, rect.y / page.height) &&
      near(bigRect.width / bigPage.width, rect.width / page.width),
    `${JSON.stringify(rect)} vs ${JSON.stringify(bigRect)}`,
  );

  // A model that would hang off the page gets pulled back inside.
  const overflowing = signatureRectForPage(
    { nx: 0.95, ny: 0.99, nWidth: 0.3, aspect: 0.5 },
    page,
  );
  check(
    "signature is pulled back inside the page",
    overflowing.x + overflowing.width <= page.width + 0.001 &&
      overflowing.y + overflowing.height <= page.height + 0.001,
    JSON.stringify(overflowing),
  );
}

// --- clampSignaturePosition ---------------------------------------------
{
  const page = { width: 600, height: 848 };
  const size = { width: 180, height: 90 };
  check(
    "drag is clamped to the right edge",
    clampSignaturePosition(9999, 10, size, page).x === 420,
  );
  check(
    "drag is clamped to the left edge",
    clampSignaturePosition(-50, 10, size, page).x === 0,
  );
  check(
    "drag is clamped to the bottom edge",
    clampSignaturePosition(10, 9999, size, page).y === 758,
  );
  check(
    "a signature larger than the page pins to the origin",
    clampSignaturePosition(50, 50, { width: 900, height: 900 }, page).x === 0,
  );
}

// --- resolveSignatureResize ---------------------------------------------
{
  const page = { width: 600, height: 848 };
  const aspect = 0.5;

  const grown = resolveSignatureResize(
    180,
    60,
    { x: 100, y: 100 },
    aspect,
    page,
  );
  check("resize grows the box", near(grown.width, 240), JSON.stringify(grown));
  check(
    "resize keeps the aspect ratio",
    near(grown.height / grown.width, aspect),
    JSON.stringify(grown),
  );

  const shrunk = resolveSignatureResize(
    180,
    -1000,
    { x: 10, y: 10 },
    aspect,
    page,
  );
  check(
    "resize cannot go below the minimum",
    near(shrunk.width, page.width * SIGNATURE_MIN_WIDTH_RATIO),
    JSON.stringify(shrunk),
  );
  check(
    "minimum signature is genuinely small on an A4 page",
    shrunk.width <= 25,
    `${shrunk.width}px of a 600px wide page`,
  );

  const clampedRight = resolveSignatureResize(
    180,
    10000,
    { x: 500, y: 100 },
    aspect,
    page,
  );
  check(
    "resize stops at the right page edge",
    clampedRight.width <= page.width - 500 + 0.001,
    JSON.stringify(clampedRight),
  );
  check(
    "resize keeps aspect when clamped horizontally",
    near(clampedRight.height / clampedRight.width, aspect),
    JSON.stringify(clampedRight),
  );

  const clampedBottom = resolveSignatureResize(
    180,
    10000,
    { x: 0, y: 800 },
    aspect,
    page,
  );
  check(
    "resize stops at the bottom page edge",
    clampedBottom.height <= page.height - 800 + 0.001,
    JSON.stringify(clampedBottom),
  );
  check(
    "resize keeps aspect when clamped vertically",
    near(clampedBottom.height / clampedBottom.width, aspect),
    JSON.stringify(clampedBottom),
  );
}

// --- computeBakeSize -----------------------------------------------------
{
  const small = computeBakeSize({ width: 1240, height: 1754 });
  check("small pages export at their own size", small?.width === 1240);

  const huge = computeBakeSize({ width: 4000, height: 3000 });
  check(
    "huge pages are capped on the longest edge",
    huge?.width === MAX_BAKE_EDGE,
    JSON.stringify(huge),
  );
  check(
    "capping preserves the page aspect ratio",
    !!huge && near(huge.width / huge.height, 4000 / 3000, 0.01),
    JSON.stringify(huge),
  );
  check("unknown page size falls back to null", computeBakeSize(null) === null);
}

// --- clampZoomTranslate --------------------------------------------------
{
  const viewport = { width: 400, height: 800 };
  check(
    "no panning while fit to screen",
    clampZoomTranslate(500, 500, 1, viewport).x === 0 &&
      clampZoomTranslate(500, 500, 1, viewport).y === 0,
  );
  const panned = clampZoomTranslate(9999, 9999, 3, viewport);
  check(
    "panning is bounded when zoomed",
    panned.x === 400 && panned.y === 800,
    JSON.stringify(panned),
  );
}

// --- report --------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  FAIL: ${f}`));
  process.exit(1);
}
console.log("All document geometry tests passed.\n");
