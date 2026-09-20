import { useEffect, useRef } from 'react';

const dialogs = [];
const inertNodes = new Map();
const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previous = document.activeElement;
    dialogs.push(dialog);
    const blocked = [];
    // Block siblings at each ancestor, preserving nested-dialog inert ownership.
    for (let node = dialog.parentElement; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || ['SCRIPT', 'STYLE'].includes(sibling.tagName)) continue;
        const entry = inertNodes.get(sibling) || { count: 0, original: sibling.inert };
        entry.count += 1; inertNodes.set(sibling, entry); sibling.inert = true; blocked.push(sibling);
      }
    }
    const controls = () => [...dialog.querySelectorAll(focusable)].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
    const focusFirst = () => (controls()[0] || dialog).focus({ preventScroll: true });
    if (!dialog.contains(document.activeElement)) {
      const input = dialog.querySelector('input:not([type="checkbox"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
      (input || controls()[0] || dialog).focus({ preventScroll: true });
    }
    const keydown = (event) => {
      if (dialogs.at(-1) !== dialog) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const elements = controls();
        const index = elements.indexOf(document.activeElement);
        event.preventDefault();
        const next = event.shiftKey ? (index <= 0 ? elements.length - 1 : index - 1) : (index + 1) % elements.length;
        (elements[next] || dialog).focus();
      }
    };
    const focusin = (event) => { if (dialogs.at(-1) === dialog && !dialog.contains(event.target)) focusFirst(); };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      dialogs.splice(dialogs.indexOf(dialog), 1);
      blocked.forEach((node) => {
        const entry = inertNodes.get(node);
        if (--entry.count === 0) { node.inert = entry.original; inertNodes.delete(node); }
      });
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
