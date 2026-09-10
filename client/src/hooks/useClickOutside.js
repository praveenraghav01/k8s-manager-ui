import { useEffect } from 'react';

// Overlays that render outside the panel's DOM (confirm dialogs, context menus,
// toasts, the command palette, YAML/log tabs) must NOT close the panel when
// clicked — otherwise a delete-confirm or menu click would dismiss the drawer
// underneath it.
const IGNORE = [
  '.modal', '.modal-overlay',
  '.action-modal', '.action-modal-backdrop',
  '.context-menu', '.toast-stack', '.cmdk-overlay',
  '[role="dialog"]', '[role="menu"]',
].join(', ');

/**
 * Close a right-side panel when the user clicks/taps outside of it.
 *
 * @param {React.RefObject} ref     ref on the panel's root element
 * @param {() => void}      onClose called on an outside click
 * @param {boolean}         active  only listen while the panel is open
 */
export default function useClickOutside(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => {
      const el = ref.current;
      if (!el || el.contains(e.target)) return;
      if (e.target.closest && e.target.closest(IGNORE)) return;
      onClose();
    };
    // Defer attaching so the very click that opened the panel (which lands
    // outside it) doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handler);
    };
  }, [ref, onClose, active]);
}
