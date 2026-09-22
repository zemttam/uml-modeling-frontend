'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCreateProject } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import Modal from './modal';

export default function NewProjectButton() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError('');
      inputRef.current?.focus();
    }
  }, [open]);

  function handleCancel() {
    setOpen(false);
  }

  async function handleOk() {
    if (!name.trim()) {
      setError(t('dashboard.nameRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    const result = await apiCreateProject(name.trim());
    if (result.ok && result.id) {
      router.push(`/project/${result.id}`);
      router.refresh();
    } else {
      setSubmitting(false);
      setError(result.message ?? 'could not create project');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        {t('dashboard.newProject')}
      </button>
      {open && (
        <Modal onCancel={handleCancel}>
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.newProjectTitle')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleOk();
            }}
            className="flex flex-col gap-4"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder={t('dashboard.projectNamePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border px-3 py-2"
              style={{
                background: 'var(--dashboard-dialog-input-bg)',
                color: 'var(--dashboard-dialog-input-text)',
                borderColor: 'var(--dashboard-dialog-input-border)',
              }}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded border px-4 py-2"
              >
                {t('dashboard.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {t('dashboard.ok')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
