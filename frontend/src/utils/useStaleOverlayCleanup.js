import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BACKDROP_SELECTORS = [
  ".modal-backdrop",
  ".MuiBackdrop-root",
  ".ReactModal__Overlay",
  ".ant-modal-mask",
  ".ant-drawer-mask",
  ".chakra-modal__overlay",
  ".mantine-Modal-overlay",
  "[data-radix-dialog-overlay]",
];

const ACTIVE_DIALOG_SELECTORS = [
  "dialog[open]",
  "[role='dialog'][aria-modal='true']",
  ".modal.show",
  ".MuiDialog-root",
  ".ReactModal__Content",
  ".ant-modal-wrap",
  ".chakra-modal__content-container",
  ".mantine-Modal-content",
  "[data-radix-dialog-content]",
];

function hasActiveDialog() {
  return ACTIVE_DIALOG_SELECTORS.some((selector) =>
    document.querySelector(selector)
  );
}

function cleanupStaleOverlays() {
  if (typeof document === "undefined" || hasActiveDialog()) {
    return;
  }

  document.body.classList.remove("modal-open", "ReactModal__Body--open");
  document.documentElement.classList.remove("ReactModal__Html--open");
  document.getElementById("root")?.removeAttribute("inert");

  if (document.body.style.overflow === "hidden") {
    document.body.style.overflow = "";
  }

  if (document.body.style.pointerEvents === "none") {
    document.body.style.pointerEvents = "";
  }

  if (document.body.style.paddingRight) {
    document.body.style.paddingRight = "";
  }

  BACKDROP_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (!element.closest(ACTIVE_DIALOG_SELECTORS.join(","))) {
        element.remove();
      }
    });
  });
}

export default function useStaleOverlayCleanup() {
  const location = useLocation();

  useEffect(() => {
    const timeoutId = window.setTimeout(cleanupStaleOverlays, 0);

    return () => window.clearTimeout(timeoutId);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let timeoutId = window.setTimeout(cleanupStaleOverlays, 0);
    const scheduleCleanup = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(cleanupStaleOverlays, 100);
    };
    const observer = new MutationObserver(scheduleCleanup);

    observer.observe(document.body, {
      attributeFilter: ["class", "style"],
      attributes: true,
      childList: true,
    });

    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, []);
}
