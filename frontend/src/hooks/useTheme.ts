import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'system';

export function useTheme(initialTheme: Theme = 'dark') {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('githelp_theme') as Theme;
    return saved || initialTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('githelp_theme', theme);
  }, [theme]);

  return { theme, setTheme };
}
