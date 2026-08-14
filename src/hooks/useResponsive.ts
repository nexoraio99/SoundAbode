import { useState, useEffect } from 'react';

/** useMediaQuery — native matchMedia, no external package required. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches); // sync on mount
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export const useResponsive = () => {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const isTablet = useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isWidescreen = useMediaQuery('(min-width: 1440px)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isMobileOrTablet = useMediaQuery('(max-width: 1023px)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWidescreen,
    isPortrait,
    isLandscape,
    isMobileOrTablet,
  };
};

export default useResponsive;
