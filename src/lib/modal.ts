"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Shared modal-dialog accessibility behavior (issue #8).
 *
 * Extracted from the InfoPanel (issue #6) so the conflict dialog can reuse the
 * exact same, already-QA'd machinery. While the host component is mounted it:
 *
 *   - moves focus into the dialog (an explicit `initialFocusRef` when given,
 *     otherwise the first focusable element inside the panel),
 *   - traps Tab / Shift+Tab within the panel,
 *   - calls `onClose` on Escape (stopping propagation so nothing behind the
 *     dialog also reacts),
 *   - locks background scroll while open,
 *   - restores focus to the previously focused element on unmount.
 *
 * Mount the host component only while the dialog is open — the effect is
 * intentionally mount-scoped. The latest `onClose` is read through a ref so a
 * re-render with a new callback identity does not re-run the mount effect
 * (which would spuriously steal focus back to the initial element).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function useModalDialog(
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog.
    const initial =
      initialFocusRef?.current ??
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      null;
    initial?.focus();

    // Lock background scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables =
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Return focus to the element that opened the dialog (no-op if it has
      // since left the document).
      previouslyFocused?.focus();
    };
    // Mount-scoped by design — see the doc comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
