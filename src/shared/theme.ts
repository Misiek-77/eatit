import { useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';

// Same key the inline script in index.html reads before first paint.
const KEY = 'color-scheme';

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function apply(theme: Theme) {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) meta.content = theme === 'system' ? 'light dark' : theme;
}

export function setTheme(theme: Theme) {
  apply(theme);
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

/** Keeps this tab in step when the theme is changed in another one. */
export function syncThemeAcrossTabs() {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) apply(getTheme());
  });
}

/** Whether the operating system currently prefers a dark scheme. */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return dark;
}
