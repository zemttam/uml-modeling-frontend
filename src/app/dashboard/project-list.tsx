'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  apiDeleteProject,
  apiListProjects,
  apiRenameProject,
  type Project,
} from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import Modal from './modal';
import './dashboard.css';

export default function ProjectList() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiListProjects().then((result) => {
      if (result.ok) {
        setProjects(result.projects ?? []);
      } else {
        setError(result.message ?? 'could not load projects');
      }
    });
  }, []);

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    setDeleting(true);
    const result = await apiDeleteProject(pendingDelete.id);
    if (result.ok) {
      const deletedId = pendingDelete.id;
      setPendingDelete(null);
      setProjects((current) =>
        current.filter((project) => project.id !== deletedId),
      );
    } else {
      setError(result.message ?? 'could not delete project');
    }
    setDeleting(false);
  }

  function startEdit(project: Project) {
    setPendingEdit(project);
    setEditName(project.name);
    setEditError('');
  }

  async function confirmEdit() {
    const trimmed = editName.trim();
    if (!pendingEdit) {
      return;
    }
    if (!trimmed) {
      setEditError(t('dashboard.nameRequired'));
      return;
    }
    setSaving(true);
    const result = await apiRenameProject(pendingEdit.id, trimmed);
    if (result.ok) {
      const editedId = pendingEdit.id;
      const newName = trimmed;
      setPendingEdit(null);
      setProjects((current) =>
        current.map((project) =>
          project.id === editedId ? { ...project, name: newName } : project,
        ),
      );
    } else {
      setEditError(result.message ?? t('dashboard.nameRequired'));
    }
    setSaving(false);
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (projects.length === 0) {
    return       <p className="text-slate-500">{t('dashboard.emptyProjects')}</p>;
  }

  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">
        {t('dashboard.createdProjects')}
      </h2>
      <ul className="flex w-full flex-col divide-y">
        {projects.map((project) => (
          <li key={project.id} className="flex items-stretch">
            <Link
              href={`/project/${project.id}`}
              className="flex-1 px-4 py-3 hover:bg-[var(--dashboard-hover)]"
            >
              {project.name}
            </Link>
            <button
              type="button"
              onClick={() => startEdit(project)}
              className="px-4 py-3 font-medium"
            >
              {t('dashboard.edit')}
            </button>
            <button
              type="button"
              onClick={() => setPendingDelete(project)}
              className="px-4 py-3 font-medium text-white"
              style={{ background: 'var(--dashboard-danger)' }}
            >
              {t('dashboard.delete')}
            </button>
          </li>
        ))}
      </ul>
      {pendingEdit && (
        <Modal onCancel={() => setPendingEdit(null)}>
          <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">
            {t('dashboard.editProject')}
          </h2>
          <input
            type="text"
            value={editName}
            onChange={(e) => {
              setEditName(e.target.value);
              setEditError('');
            }}
            placeholder={t('dashboard.projectNamePlaceholder')}
            className="rounded border px-3 py-2"
            style={{
              background: 'var(--dashboard-dialog-input-bg)',
              color: 'var(--dashboard-dialog-input-text)',
              borderColor: 'var(--dashboard-dialog-input-border)',
            }}
          />
          {editError && <p className="text-sm text-red-500">{editError}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingEdit(null)}
              className="rounded border px-4 py-2"
            >
              {t('dashboard.cancel')}
            </button>
            <button
              type="button"
              onClick={confirmEdit}
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {t('dashboard.ok')}
            </button>
            </div>
          </div>
        </Modal>
      )}
      {pendingDelete && (
        <Modal onCancel={() => setPendingDelete(null)}>
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.deleteProject')}</h2>
          <p className="mb-6">
            {t('dashboard.deleteConfirm', { name: pendingDelete.name })}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded border px-4 py-2"
            >
              {t('dashboard.cancel')}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded px-4 py-2 font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--dashboard-danger)' }}
            >
              {t('dashboard.delete')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
