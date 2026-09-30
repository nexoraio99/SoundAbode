import { useEffect } from 'react';

/**
 * CONTENT DETERRENT CONFIGURATION
 * Note: This provides a casual deterrent, NOT absolute protection.
 * Client-side JavaScript/CSS cannot prevent OS-level screenshots or DevTools inspection.
 */
export const contentGuardConfig = {
  enabled: true,
  blockShortcuts: true,
  blurOnHidden: true, // Blurs protected content when window/tab is inactive
  watermarkText: 'SoundAbode © Protected Content',
};

const isUnprotectedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [data-unprotected], a[href^="tel:"], a[href^="mailto:"], .unprotected'
    )
  );
};

const isProtectedTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const protectedEl = target.closest('[data-protected]');
  return Boolean(protectedEl && !isUnprotectedTarget(target));
};

export const useContentGuard = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Development bypass and URL flag (?guard=off)
    const isDev = Boolean(import.meta.env.DEV || import.meta.env.MODE !== 'production');
    const params = new URLSearchParams(window.location.search);
    if (!contentGuardConfig.enabled || (isDev && params.get('guard') === 'off')) return;

    // 2. Never block CMS admin panel or dashboard routes
    const isCmsAdmin =
      window.location.pathname.startsWith('/cms-admin') ||
      window.location.hash.startsWith('#cms-admin');
    if (isCmsAdmin) return;

    // 3. Scoped handlers: strictly prevent copying/context menu on [data-protected] elements
    const handleScopedAction = (e: MouseEvent | DragEvent | ClipboardEvent | Event) => {
      if (isProtectedTarget(e.target)) {
        e.preventDefault();
      }
    };

    // 4. Global light-touch shortcut controls (ignored inside editable form fields)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isUnprotectedTarget(e.target)) return;

      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText?.('').catch(() => {});
      }

      if (!contentGuardConfig.blockShortcuts) return;
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (isCmdOrCtrl && (key === 's' || key === 'p' || key === 'u')) {
        e.preventDefault();
      }
    };

    // 5. Inactivity & Window Blur Protection (Deter screenshot utility overlays)
    const handleInactivity = () => {
      if (!contentGuardConfig.blurOnHidden) return;
      const shouldBlur = document.hidden || !document.hasFocus();
      document.body.classList.toggle('sa-tab-hidden', shouldBlur);
    };

    const handleFocus = () => {
      document.body.classList.remove('sa-tab-hidden');
    };

    const scopedEvents = ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'];
    scopedEvents.forEach((event) => window.addEventListener(event, handleScopedAction, { capture: true }));
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('visibilitychange', handleInactivity);
    window.addEventListener('blur', handleInactivity);
    window.addEventListener('focus', handleFocus);

    return () => {
      scopedEvents.forEach((event) =>
        window.removeEventListener(event, handleScopedAction, { capture: true } as EventListenerOptions)
      );
      window.removeEventListener('keydown', handleKeyDown, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', handleInactivity);
      window.removeEventListener('blur', handleInactivity);
      window.removeEventListener('focus', handleFocus);
      document.body.classList.remove('sa-tab-hidden');
    };
  }, []);
};

export default useContentGuard;
