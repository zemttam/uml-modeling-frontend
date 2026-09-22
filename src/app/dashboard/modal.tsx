'use client';

import { useEffect, type ReactNode } from 'react';
import './dashboard.css';

interface ModalProps {
  onCancel: () => void;
  children: ReactNode;
  // Optional dialog width override (e.g. wider AI Creator dialog);
  // defaults to the original `max-w-md`.
  maxWidth?: string;
  className?: string;
}

export default function Modal({
  onCancel,
  children,
  maxWidth,
  className,
}: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--dashboard-dialog-overlay)' }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className={`w-full rounded-lg border p-6 ${className ?? ''}`}
        style={{
          maxWidth: maxWidth ?? '28rem',
          background: 'var(--dashboard-dialog-bg)',
          color: 'var(--dashboard-dialog-text)',
          borderColor: 'var(--dashboard-dialog-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
