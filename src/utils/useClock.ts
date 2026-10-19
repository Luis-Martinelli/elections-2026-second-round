import { useEffect, useState } from 'react';

// Formats as 'dd/mm/yyyy - HH:mm:ss' (format stored in check-in/ronda records)
export function formatDateTime(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} - ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Ticking clock kept local to the component that displays it, so the whole
 * App tree is not re-rendered every second.
 */
export function useClock(): string {
  const [dateTime, setDateTime] = useState(() => formatDateTime());

  useEffect(() => {
    const interval = setInterval(() => setDateTime(formatDateTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return dateTime;
}
