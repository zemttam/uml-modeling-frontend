'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDownloadProjectXmi, apiDownloadProjectSpringBoot } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import LanguageToggle from '@/components/language-toggle';
import './theme.css';

interface ToolbarProps {
  projectId: string;
  projectName: string;
  presence: number;
  connected: boolean;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Top toolbar: File dropdown (New/Open/Save), AI placeholder, Export, Undo,
// Redo, and a live "User count" label bound to presence.
export default function Toolbar({
  projectId,
  projectName,
  presence,
  connected,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [fileOpen, setFileOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [springExporting, setSpringExporting] = useState(false);
  const [springExportError, setSpringExportError] = useState('');
  const fileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (fileRef.current && !fileRef.current.contains(e.target as Node)) {
        setFileOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleExport() {
    setExportError('');
    setExporting(true);
    try {
      await apiDownloadProjectXmi(projectId, projectName);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleSpringExport() {
    setSpringExportError('');
    setSpringExporting(true);
    try {
      await apiDownloadProjectSpringBoot(projectId, projectName);
    } catch (e) {
      setSpringExportError((e as Error).message);
    } finally {
      setSpringExporting(false);
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-[var(--project-border)] bg-[var(--project-surface)] text-[var(--project-text-primary)] px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="relative" ref={fileRef}>
          <button
            type="button"
            onClick={() => setFileOpen((v) => !v)}
            className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
          >
            {t('toolbar.file')} ▾
          </button>
          {fileOpen && (
            <div className="absolute left-0 z-10 mt-1 w-40 rounded border border-[var(--project-border)] bg-[var(--project-surface)] py-1 shadow-lg text-[var(--project-text-primary)]">
              <button
                type="button"
                onClick={() => {
                  setFileOpen(false);
                  router.push('/dashboard');
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
              >
                {t('toolbar.fileMenuNew')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileOpen(false);
                  router.push('/dashboard');
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
              >
                {t('toolbar.fileMenuOpen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFileOpen(false);
                  onSave();
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
              >
                {t('toolbar.fileMenuSave')}
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleSpringExport}
          disabled={springExporting}
          title={t('toolbar.exportSpringTitle')}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {springExporting ? t('toolbar.exportSpringBusy') : t('toolbar.exportSpring')}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)] disabled:opacity-50"
        >
          {exporting ? t('toolbar.exporting') : t('toolbar.export')}
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('toolbar.undoTitle')}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('toolbar.undo')}
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title={t('toolbar.redoTitle')}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('toolbar.redo')}
        </button>
        {exportError && (
          <span className="text-xs text-red-500">{exportError}</span>
        )}
        {springExportError && (
          <span className="text-xs text-red-500">{springExportError}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--project-text-secondary)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
        >
          {t('toolbar.dashboard')}
        </button>
        <span
          className={
            'inline-block h-2 w-2 rounded-full ' +
            (connected ? 'bg-green-500' : 'bg-slate-400')
          }
          title={connected ? t('toolbar.connected') : t('toolbar.disconnected')}
        />
        {t('toolbar.userCount', { n: presence })}
        <LanguageToggle />
      </div>
    </header>
  );
}
