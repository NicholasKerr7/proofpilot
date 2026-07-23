/** Scrolls route transitions to the page origin while honoring reduced motion. */
export function scrollToPageTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ behavior: getScrollBehavior(), top: 0 });
  });
}

/** Resolves the effective scroll behavior from OS and in-app preferences. */
function getScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
    ? "auto"
    : "smooth";
}
