'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AuthGate from '@/components/auth-gate';
import { apiGetProject } from '@/lib/api';
import Editor from './editor';

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    (async () => {
      const project = await apiGetProject(id);
      if (cancelled) {
        return;
      }
      if (!project.ok || !project.id) {
        router.replace('/dashboard');
        return;
      }
      setProjectId(project.id);
      setProjectName(project.name ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <AuthGate>
      {projectId !== null ? (
        <Editor projectId={projectId} projectName={projectName} />
      ) : null}
    </AuthGate>
  );
}
