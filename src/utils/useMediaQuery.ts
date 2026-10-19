import { useEffect, useState } from 'react';

/** Tracks a CSS media query, e.g. '(min-width: 768px)'. */
export function useMediaQuery(queryText: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(queryText).matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(queryText);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [queryText]);

  return matches;
}
