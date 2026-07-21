const horizontalTabKeys = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;

type HorizontalTabKey = (typeof horizontalTabKeys)[number];

export function getTabKeyboardTarget<T>(
  tabs: readonly T[],
  currentTab: T,
  key: string
): T | null {
  if (!isHorizontalTabKey(key) || tabs.length === 0) {
    return null;
  }

  if (key === "Home") {
    return tabs[0] ?? null;
  }

  if (key === "End") {
    return tabs[tabs.length - 1] ?? null;
  }

  const currentIndex = Math.max(tabs.indexOf(currentTab), 0);
  const offset = key === "ArrowRight" ? 1 : -1;
  const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;

  return tabs[nextIndex] ?? null;
}

function isHorizontalTabKey(key: string): key is HorizontalTabKey {
  return horizontalTabKeys.some((tabKey) => tabKey === key);
}
