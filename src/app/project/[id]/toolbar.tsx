'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDownloadProjectXmi, apiDownloadProjectSpringBoot, apiImportXmiIntoProject } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import LanguageToggle from '@/components/language-toggle';
import Modal from '../../dashboard/modal';
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
  /** called with the new name after a successful replace-in-place import */
  onProjectRenamed?: (name: string) => void;
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
  onProjectRenamed,
}: ToolbarProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [fileOpen, setFileOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [springExporting, setSpringExporting] = useState(false);
  const [springExportError, setSpringExportError] = useState('');
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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

  function handleImportFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ''; // allow re-picking the same file later
    if (file) {
      setImportError('');
      setPendingImportFile(file);
    }
  }

  function handleCancelImport() {
    if (importing) return;
    setPendingImportFile(null);
    setImportError('');
  }

  async function handleConfirmImport() {
    if (!pendingImportFile) return;
    setImportError('');
    setImporting(true);
    try {
      const { name } = await apiImportXmiIntoProject(
        projectId,
        pendingImportFile,
      );
      // success: close the modal and adopt the imported name
      setPendingImportFile(null);
      onProjectRenamed?.(name);
    } catch (e) {
      // failure: keep the modal open and show the backend error verbatim
      setImportError((e as Error).message);
    } finally {
      setImporting(false);
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
        <input
          ref={importInputRef}
          type="file"
          accept=".xmi,.xml"
          onChange={handleImportFileChosen}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
          title={t('toolbar.importTitle')}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-3 py-1.5 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? t('toolbar.importing') : t('toolbar.import')}
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
      {pendingImportFile && (
        <Modal onCancel={handleCancelImport}>
          <h2 className="mb-4 text-lg font-semibold">
            {t('toolbar.importTitle')}
          </h2>
          <p className="mb-2 text-sm">{t('toolbar.importConfirm')}</p>
          <p className="mb-4 truncate text-xs opacity-70">
            {pendingImportFile.name}
          </p>
          {importError && <p className="mb-4 text-sm text-red-500">{importError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelImport}
              disabled={importing}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              {t('toolbar.importCancel')}
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? t('toolbar.importing') : t('toolbar.importOk')}
            </button>
          </div>
        </Modal>
      )}
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
