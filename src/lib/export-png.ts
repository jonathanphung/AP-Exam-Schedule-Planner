import { toBlob } from "html-to-image";
import type { Category } from "../data/schema";
import type { WeekCard, WeekCardRow } from "./week-cards";

/**
 * Per-week PNG schedule cards (issue #56) — the DOM + pixel layer.
 *
 * This REPLACES issue #51's `captureSchedulePng`, which screenshotted whatever
 * view was on screen. There is no "screenshot the current view" behavior any
 * more: we build a deliberately DESIGNED card node per testing week (see
 * `week-cards.ts` for which weeks emit and what their rows are) and rasterize
 * THAT node. One layout, N renders — a single design that can't drift into a
 * second implementation.
 *
 * Rasterization mechanism (builder decision, issue #56) — an off-screen DOM
 * node + `html-to-image`, NOT a hand-drawn `<canvas>`:
 * - We keep the existing `html-to-image` dependency (already shipped for #51),
 *   just REPURPOSED from the live view to a purpose-built node. `toBlob` clones
 *   the node, inlines its styles through an SVG `<foreignObject>`, and paints
 *   it to a canvas — so the card is authored in ordinary DOM/CSS (readable,
 *   tweakable) rather than hundreds of lines of imperative canvas drawing that
 *   silently rot on every design change.
 * - The card is built with fully INLINE styles (explicit hex, no Tailwind
 *   utility classes) so the export is deterministic and self-contained: it
 *   renders identically whether or not the app's stylesheet is present, and
 *   `html-to-image`'s style-inlining pass has a concrete value for every
 *   property. The palette below MIRRORS the app's tokens (the issue-#30 pastel
 *   category hues in `CalendarView`'s `CATEGORY_STYLES`, and the Tailwind slate
 *   neutrals used across the app) so a card reads as the same product, not a
 *   generic template.
 * - The node is attached OFF-SCREEN (fixed, far left) for the capture so the
 *   browser lays it out and resolves fonts, then removed — it never flashes on
 *   screen and never affects page layout.
 *
 * Fidelity + guarantees carried over from #51:
 * - `pixelRatio: 2` — crisp on HiDPI and when pasted into documents.
 * - Solid background per theme (never transparent) — passed explicitly so the
 *   PNG is never a broken-looking transparent image.
 * - Fully client-side, zero network: the app has a system-font stack and the
 *   card embeds no external images, so the style/font inlining fetches nothing.
 */

export type ExportTheme = "light" | "dark";

export interface WeekCardRenderOptions {
  /** Active theme — decides the card's palette + the solid PNG background. */
  theme: ExportTheme;
  /** Dataset cycle, e.g. "May 2026" (shown in the header). */
  cycle: string;
  /** Active schedule name, shown in the footer (e.g. "Schedule 1"). */
  scheduleName: string;
  /** Selected subjects with no dated exam — surfaced as a footnote, never dropped. */
  undatedNames: readonly string[];
  /** Credit line so a shared card is traceable back to the app. */
  footerUrl?: string;
}

const DEFAULT_FOOTER_URL = "apexamplanner.vercel.app";

/** Fixed card width — a comfortable share/paste width (px, pre-pixelRatio). */
const CARD_WIDTH = 680;

interface ThemeTokens {
  pageBg: string;
  cardBorder: string;
  heading: string;
  body: string;
  muted: string;
  rowBg: string;
  rowBorder: string;
  divider: string;
  /** Regular-week header accent (app primary blue). */
  regularAccent: string;
  regularHeaderBg: string;
  regularHeaderText: string;
  /** Late-testing header accent (warm amber — distinct from the pastels). */
  lateAccent: string;
  lateHeaderBg: string;
  lateHeaderText: string;
  /** "Moved to late testing" pill. */
  flagBg: string;
  flagText: string;
}

const THEMES: Record<ExportTheme, ThemeTokens> = {
  light: {
    pageBg: "#ffffff",
    cardBorder: "#e2e8f0", // slate-200
    heading: "#0f172a", // slate-900
    body: "#334155", // slate-700
    muted: "#64748b", // slate-500
    rowBg: "#f8fafc", // slate-50
    rowBorder: "#e2e8f0",
    divider: "#e2e8f0",
    regularAccent: "#2563eb", // blue-600 (app primary)
    regularHeaderBg: "#eff6ff", // blue-50
    regularHeaderText: "#1e3a8a", // blue-900
    lateAccent: "#d97706", // amber-600
    lateHeaderBg: "#fffbeb", // amber-50
    lateHeaderText: "#92400e", // amber-800
    flagBg: "#fef3c7", // amber-100
    flagText: "#92400e", // amber-800
  },
  dark: {
    pageBg: "#020618", // slate-950
    cardBorder: "#1e293b", // slate-800
    heading: "#f1f5f9", // slate-100
    body: "#cbd5e1", // slate-300
    muted: "#94a3b8", // slate-400
    rowBg: "#0f172a", // slate-900
    rowBorder: "#1e293b",
    divider: "#1e293b",
    regularAccent: "#60a5fa", // blue-400
    regularHeaderBg: "#172554", // blue-950
    regularHeaderText: "#bfdbfe", // blue-200
    lateAccent: "#fb923c", // warm amber/orange-400
    lateHeaderBg: "#451a03", // amber-950
    lateHeaderText: "#fde68a", // amber-200
    flagBg: "#451a03",
    flagText: "#fde68a",
  },
};

/**
 * Category → { accent dot, soft chip fill, chip text }. MIRRORS the issue-#30
 * pastel palette in `CalendarView`'s `CATEGORY_STYLES` (the single design
 * source) so the export reads as the same product. Duplicated here as explicit
 * hex — not imported — because those live as Tailwind class strings inside a
 * client component, and this DOM library must not depend on it.
 */
const CATEGORY_PALETTE: Record<
  ExportTheme,
  Record<Category, { accent: string; fill: string; text: string }>
> = {
  light: {
    STEM: { accent: "#5E74C0", fill: "#C7CEEA", text: "#28345E" },
    Humanities: { accent: "#CBA53A", fill: "#F7DC8D", text: "#5C4708" },
    Languages: { accent: "#7EB84A", fill: "#C9E89B", text: "#38541A" },
    Arts: { accent: "#EF5D6A", fill: "#FF9AA2", text: "#7A1E28" },
    "Career Kickstart": { accent: "#9866C0", fill: "#CDB4DB", text: "#4A2C63" },
  },
  dark: {
    STEM: { accent: "#8296DC", fill: "#2A3458", text: "#DCE3F7" },
    Humanities: { accent: "#E3C766", fill: "#52420F", text: "#F6E6A8" },
    Languages: { accent: "#A0D172", fill: "#2B4A1C", text: "#DCEFBE" },
    Arts: { accent: "#F98A93", fill: "#52222A", text: "#FBC7CC" },
    "Career Kickstart": { accent: "#B98FD8", fill: "#402A58", text: "#E4CFF0" },
  },
};

const NEUTRAL_ACCENT: Record<ExportTheme, string> = {
  light: "#94a3b8", // slate-400
  dark: "#475569", // slate-600
};

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

type Style = Partial<CSSStyleDeclaration>;

/** Tiny DOM builder: element + inline style + optional text. */
function el(tag: string, style: Style, text?: string): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The right-hand "when" descriptor for a row (day · session · clock). */
function rowWhen(row: WeekCardRow): string {
  const parts: string[] = [`${row.weekday}, ${row.monthDay}`];
  if (row.kind === "portfolio") {
    parts.push("Portfolio deadline");
    return parts.join("  ·  ");
  }
  if (row.session) parts.push(`${row.session} session`);
  if (row.startClock) {
    parts.push(
      row.endClock
        ? `${row.startClock} – ${row.endClock}`
        : `${row.startClock} · length pending`,
    );
  } else if (row.lengthPending) {
    parts.push("length pending");
  }
  return parts.join("  ·  ");
}

/** One row: color accent bar + subject (with category chip) + when + flags. */
function renderRow(
  row: WeekCardRow,
  tokens: ThemeTokens,
  theme: ExportTheme,
): HTMLElement {
  const cat = row.category ? CATEGORY_PALETTE[theme][row.category] : null;
  const accent = cat?.accent ?? NEUTRAL_ACCENT[theme];

  const wrapper = el("div", {
    display: "flex",
    alignItems: "stretch",
    gap: "14px",
    padding: "12px 16px",
    background: tokens.rowBg,
    border: `1px solid ${tokens.rowBorder}`,
    borderLeft: `4px solid ${accent}`,
    borderRadius: "10px",
  });

  // Left: subject name + optional category chip + moved-to-late flag.
  const left = el("div", {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: "1 1 auto",
    minWidth: "0",
  });

  const nameRow = el("div", {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  });
  const dot = el("span", {
    width: "10px",
    height: "10px",
    borderRadius: "9999px",
    background: accent,
    flex: "0 0 auto",
  });
  const name = el(
    "span",
    {
      fontSize: "16px",
      fontWeight: "600",
      color: tokens.heading,
      lineHeight: "1.2",
    },
    row.subjectName,
  );
  nameRow.append(dot, name);
  if (cat && row.category) {
    nameRow.append(
      el(
        "span",
        {
          fontSize: "11px",
          fontWeight: "600",
          color: cat.text,
          background: cat.fill,
          padding: "2px 8px",
          borderRadius: "9999px",
          whiteSpace: "nowrap",
        },
        row.category,
      ),
    );
  }
  left.append(nameRow);

  if (row.movedToLate) {
    left.append(
      el(
        "span",
        {
          alignSelf: "flex-start",
          fontSize: "11px",
          fontWeight: "600",
          color: tokens.flagText,
          background: tokens.flagBg,
          padding: "2px 8px",
          borderRadius: "6px",
        },
        "Moved to late testing",
      ),
    );
  }
  if (row.note) {
    left.append(
      el(
        "span",
        { fontSize: "12px", color: tokens.muted, lineHeight: "1.35" },
        row.note,
      ),
    );
  }

  // Right: the day / session / clock descriptor.
  const when = el(
    "div",
    {
      flex: "0 0 auto",
      textAlign: "right",
      fontSize: "13px",
      fontWeight: "500",
      color: tokens.body,
      lineHeight: "1.4",
      whiteSpace: "nowrap",
    },
    rowWhen(row),
  );

  wrapper.append(left, when);
  return wrapper;
}

/**
 * Build the designed card DOM node for one week. Pure DOM (not attached) — the
 * caller attaches it off-screen for rasterization.
 */
export function renderWeekCardNode(
  card: WeekCard,
  options: WeekCardRenderOptions,
): HTMLElement {
  const tokens = THEMES[options.theme];
  const accent = card.late ? tokens.lateAccent : tokens.regularAccent;
  const headerBg = card.late ? tokens.lateHeaderBg : tokens.regularHeaderBg;
  const headerText = card.late
    ? tokens.lateHeaderText
    : tokens.regularHeaderText;

  const root = el("div", {
    boxSizing: "border-box",
    width: `${CARD_WIDTH}px`,
    background: tokens.pageBg,
    padding: "28px",
    fontFamily: FONT_STACK,
    color: tokens.body,
  });

  const cardBox = el("div", {
    boxSizing: "border-box",
    border: `1px solid ${tokens.cardBorder}`,
    borderTop: `5px solid ${accent}`,
    borderRadius: "16px",
    overflow: "hidden",
  });

  // ── Header ────────────────────────────────────────────────────────────────
  const header = el("div", {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    padding: "20px 24px",
    background: headerBg,
  });

  const headerLeft = el("div", {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  });
  const identity = el("div", {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });
  identity.append(
    el(
      "span",
      { fontSize: "22px", fontWeight: "700", color: tokens.heading },
      card.label,
    ),
  );
  if (card.late) {
    identity.append(
      el(
        "span",
        {
          fontSize: "11px",
          fontWeight: "700",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: headerText,
          border: `1px solid ${accent}`,
          padding: "2px 8px",
          borderRadius: "9999px",
        },
        "Late window",
      ),
    );
  }
  headerLeft.append(identity);
  headerLeft.append(
    el(
      "span",
      { fontSize: "15px", fontWeight: "600", color: headerText },
      card.rangeLabel,
    ),
  );
  headerLeft.append(
    el(
      "span",
      { fontSize: "13px", color: tokens.muted },
      `${options.cycle} AP Exams`,
    ),
  );

  const examCount = card.rows.filter((r) => r.kind === "exam").length;
  const countText =
    examCount > 0
      ? `${examCount} exam${examCount === 1 ? "" : "s"}`
      : `${card.rows.length} item${card.rows.length === 1 ? "" : "s"}`;
  const headerRight = el(
    "div",
    {
      flex: "0 0 auto",
      alignSelf: "center",
      textAlign: "right",
      fontSize: "13px",
      fontWeight: "600",
      color: headerText,
    },
    countText,
  );

  header.append(headerLeft, headerRight);
  cardBox.append(header);

  // ── Body: rows ─────────────────────────────────────────────────────────────
  const body = el("div", {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "20px 24px",
    background: tokens.pageBg,
  });
  for (const row of card.rows) {
    body.append(renderRow(row, tokens, options.theme));
  }

  // Undated footnote — a selection is never silently dropped.
  if (options.undatedNames.length > 0) {
    body.append(
      el(
        "div",
        {
          marginTop: "6px",
          paddingTop: "12px",
          borderTop: `1px dashed ${tokens.divider}`,
          fontSize: "12px",
          color: tokens.muted,
          lineHeight: "1.4",
        },
        `Also selected (no ${options.cycle} date): ${options.undatedNames.join(", ")}`,
      ),
    );
  }
  cardBox.append(body);

  // ── Footer: credit + schedule name ─────────────────────────────────────────
  const footer = el("div", {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 24px",
    borderTop: `1px solid ${tokens.divider}`,
    background: tokens.pageBg,
    fontSize: "12px",
    color: tokens.muted,
  });
  footer.append(
    el("span", { fontWeight: "600", color: tokens.body }, options.scheduleName),
  );
  footer.append(el("span", {}, options.footerUrl ?? DEFAULT_FOOTER_URL));
  cardBox.append(footer);

  root.append(cardBox);
  return root;
}

/**
 * Rasterize one week card to a solid-background PNG blob at `pixelRatio: 2`.
 * Attaches the node off-screen for layout, captures, then removes it.
 */
export async function captureWeekCardPng(
  card: WeekCard,
  options: WeekCardRenderOptions,
): Promise<Blob> {
  const node = renderWeekCardNode(card, options);
  // Positioning goes on a WRAPPER, never the captured node: html-to-image
  // clones the node's own inline styles into its SVG <foreignObject>, so a
  // `position: fixed; left: -100000px` on the node itself would push the whole
  // card off the capture canvas and rasterize a blank image. The wrapper holds
  // it off-screen while the un-positioned card renders at the origin.
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-100000px";
  holder.style.top = "0";
  holder.style.pointerEvents = "none";
  holder.appendChild(node);
  document.body.appendChild(holder);
  try {
    const blob = await toBlob(node, {
      pixelRatio: 2,
      backgroundColor: THEMES[options.theme].pageBg,
    });
    if (!blob) {
      throw new Error("PNG rasterization produced no image data");
    }
    return blob;
  } finally {
    holder.remove();
  }
}
