'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiAiGenerate, apiAiImage, apiAiTranscribe } from '@/lib/api';
import { useLanguage } from '@/lib/i18n/language-context';
import Modal from './modal';

type DialogState =
  | 'idle'
  | 'generating'
  | 'transcribing'
  | 'readingImage'
  | 'recording';

export default function AiCreatorButton() {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [state, setState] = useState<DialogState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const busy =
    state === 'generating' || state === 'transcribing' || state === 'readingImage';

  useEffect(() => {
    if (open) {
      setPrompt('');
      setError('');
      setState('idle');
      textareaRef.current?.focus();
    } else {
      // Abandon any in-flight recording when the dialog closes.
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
        recorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      recorderRef.current = null;
      setState('idle');
    }
  }, [open]);

  function handleCancel() {
    setOpen(false);
  }

  async function handleGenerate() {
    const text = prompt.trim();
    if (!text) {
      setError('describe the diagram first');
      return;
    }
    setError('');
    setState('generating');
    const result = await apiAiGenerate(text);
    if (result.ok && result.id) {
      router.push(`/project/${result.id}`);
      router.refresh();
    } else {
      setState('idle');
      setError(result.message ?? 'could not generate the diagram');
    }
  }

  async function toggleRecord() {
    if (state === 'recording') {
      recorderRef.current?.stop();
      return;
    }
    if (busy) {
      return;
    }
    setError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t('dashboard.aiMicDenied'));
      return;
    }
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : '';
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      if (blob.size === 0) {
        setState('idle');
        setError(t('dashboard.aiNoAudio'));
        return;
      }
      setState('transcribing');
      const result = await apiAiTranscribe(blob);
      if (result.ok && typeof result.text === 'string') {
        setPrompt(result.text);
        setState('idle');
        textareaRef.current?.focus();
      } else {
        setState('idle');
        setError(result.message ?? 'could not transcribe the recording');
      }
    };
    recorder.start();
    setState('recording');
  }

  async function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || busy || state === 'recording') {
      return;
    }
    setError('');
    setState('readingImage');
    const result = await apiAiImage(file);
    if (result.ok && typeof result.dsl === 'string') {
      setPrompt(result.dsl);
      setState('idle');
      textareaRef.current?.focus();
    } else {
      setState('idle');
      setError(result.message ?? 'could not read the image');
    }
  }

  const statusLabel: Record<DialogState, string> = {
    idle: '',
    generating: t('dashboard.aiStatusGenerating'),
    transcribing: t('dashboard.aiStatusTranscribing'),
    readingImage: t('dashboard.aiStatusReadingImage'),
    recording: t('dashboard.aiStatusRecording'),
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border px-4 py-2"
      >
        {t('dashboard.aiCreator')}
      </button>
      {open && (
        <Modal onCancel={handleCancel} maxWidth="40rem">
          <h2 className="mb-4 text-lg font-semibold">{t('dashboard.aiCreatorTitle')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="flex flex-col gap-4"
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setError('');
              }}
              rows={8}
              placeholder={t('dashboard.aiPromptPlaceholder')}
              disabled={busy || state === 'recording'}
              className="w-full resize-none rounded border px-3 py-2"
              style={{
                background: 'var(--dashboard-dialog-input-bg)',
                color: 'var(--dashboard-dialog-input-text)',
                borderColor: 'var(--dashboard-dialog-input-border)',
              }}
            />
            {statusLabel[state] && (
              <p className="text-sm opacity-75">{statusLabel[state]}</p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || state === 'recording'}
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('dashboard.ok')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="rounded border px-4 py-2"
                >
                  {t('dashboard.cancel')}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleRecord}
                  disabled={busy}
                  className="rounded border px-4 py-2"
                >
                  {state === 'recording' ? t('dashboard.aiStop') : t('dashboard.aiRecord')}
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={busy || state === 'recording'}
                  className="rounded border px-4 py-2"
                >
                  {t('dashboard.aiOpenImage')}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImagePicked}
                  className="hidden"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
