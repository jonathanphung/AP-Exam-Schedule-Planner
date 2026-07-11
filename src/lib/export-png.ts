import { toBlob } from "html-to-image";

/**
 * `.png` export (issue #51): rasterize the schedule *as currently viewed* —
 * the list when the list view is active, the calendar grid when the calendar
 * is — into a crisp, solid-background PNG, entirely client-side.
 *
 * Builder decision (issue #51), documented — DOM-to-image library over a
 * hand-drawn canvas:
 *
 * - `html-to-image` (v1.11, ~48 kB min / ~14 kB gzip, zero transitive deps)
 *   clones the live node, inlines each element's COMPUTED styles, and draws
 *   the clone through an SVG `<foreignObject>` onto a canvas. Whatever the
 *   user sees — active theme, resolved conflict badges, portfolio rows, the
 *   calendar's block layout — is what exports, with no second rendering
 *   implementation to drift out of sync with the React views. A hand-drawn
 *   canvas replica of BOTH views in BOTH themes would be several hundred
 *   lines of untestable drawing code that silently rots on every UI card.
 * - Bundle impact is confined to this dynamic path: the library ships in the
 *   client bundle once and does nothing until the user picks "Save as .png".
 * - Zero network holds: the app has no @font-face (system font stack) and no
 *   external images, so the style/font embedding pass never fetches anything.
 *
 * Fidelity knobs:
 * - `pixelRatio: 2` — the AC's ≥2× scale floor for crisp text on HiDPI and
 *   in documents the PNG gets pasted into (a 700px-wide list exports at
 *   1400px).
 * - Solid background: PNGs default to transparent, which reads as broken in
 *   most viewers. The background is sampled from the COMPUTED `<body>`
 *   background so it always matches the active theme exactly (`bg-white` /
 *   `dark:bg-slate-950`), with a literal fallback per theme class should the
 *   computed value ever come back transparent.
 */
export async function captureSchedulePng(node: HTMLElement): Promise<Blob> {
  const blob = await toBlob(node, {
    pixelRatio: 2,
    backgroundColor: resolveSolidBackground(),
  });
  if (!blob) {
    throw new Error("PNG rasterization produced no image data");
  }
  return blob;
}

/**
 * The page background of the ACTIVE theme as a solid CSS color. Reads the
 * computed `<body>` background (source of truth for both themes); falls back
 * to the literal light/dark page colors if it is somehow transparent.
 */
function resolveSolidBackground(): string {
  const computed = getComputedStyle(document.body).backgroundColor;
  const isTransparent =
    computed === "transparent" || computed === "rgba(0, 0, 0, 0)";
  if (!isTransparent && computed) return computed;
  return document.documentElement.classList.contains("dark")
    ? "#020618" // slate-950 (Tailwind v4 oklch ≈ this hex)
    : "#ffffff";
}
