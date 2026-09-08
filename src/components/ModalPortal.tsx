import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const openDialogs: HTMLElement[] = [];
let originalOverflow = '';

interface ModalPortalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  closeOnBackdrop?: boolean;
}

export function ModalPortal({
  open,
  onClose,
  children,
  className = '',
  ariaLabel = 'Ventana de diálogo',
  closeOnBackdrop = true,
}: ModalPortalProps) {
  const labelId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openDialogs.length === 0) originalOverflow = document.body.style.overflow;
    openDialogs.push(dialog);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), summary, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert], [aria-hidden="true"]'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        '[autofocus], button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      (firstFocusable ?? dialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const index = openDialogs.indexOf(dialog);
      if (index >= 0) openDialogs.splice(index, 1);
      if (openDialogs.length === 0) document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      const remainingDialog = openDialogs[openDialogs.length - 1];
      if (previouslyFocused?.isConnected && (!remainingDialog || remainingDialog.contains(previouslyFocused))) previouslyFocused.focus();
      else remainingDialog?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="wt-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`wt-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span id={labelId} className="sr-only">{ariaLabel}</span>
        {children}
      </section>
    </div>,
    document.body,
  );
}
