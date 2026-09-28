'use client';

import {
  PALETTE_TOOLS,
  type PaletteTool,
} from '@/lib/diagram-types';
import { useLanguage, type TranslationKey } from '@/lib/i18n/language-context';
import './theme.css';

// Dictionary key per palette tool id (drag payloads stay language-neutral).
const TOOL_LABEL_KEYS: Record<PaletteTool, TranslationKey> = {
  class: 'palette.tool.class',
  association: 'palette.tool.association',
  generalization: 'palette.tool.generalization',
  composition: 'palette.tool.composition',
  aggregation: 'palette.tool.aggregation',
  realization: 'palette.tool.realization',
  associationClass: 'palette.tool.associationClass',
};

interface PaletteProps {
  activeTool: PaletteTool | null;
  onSelectTool: (tool: PaletteTool) => void;
  packageName: string;
  diagramName: string;
  onUpdateMeta: (meta: {
    packageName: string;
    diagramName: string;
  }) => void;
}

// Glyph per tool, echoing UML line notation: a square for the class box,
// arrows/diamonds for the relationship kinds.
const TOOL_GLYPHS: Record<PaletteTool, string> = {
  class: '▢',
  association: '→',
  generalization: '▷',
  composition: '◆',
  aggregation: '◇',
  realization: '⇢',
  associationClass: '▢◆',
};

// Left palette of class-diagram tools, shown as a two-column grid of icon
// tiles (glyph on top, tool name below). The Class tile uses HTML5
// drag-and-drop (drop on canvas = create a class at the drop position).
// Relationship tiles arm a connect mode: click source then target on the
// canvas.
export default function Palette({
  activeTool,
  onSelectTool,
  packageName,
  diagramName,
  onUpdateMeta,
}: PaletteProps) {
  const { t } = useLanguage();
  return (
    <aside className="flex w-44 shrink-0 flex-col gap-2 border-r border-[var(--project-border)] bg-[var(--project-surface)] p-2 text-[var(--project-text-primary)]">
      <p className="px-1 pb-1 text-xs font-semibold uppercase text-[var(--project-text-secondary)]">
        {t('palette.tools')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PALETTE_TOOLS.map((tool) => {
          const isActive = activeTool === tool;
          const tileClasses =
            'flex flex-col items-center gap-1 rounded border px-2 py-3 text-center ' +
            (isActive
              ? 'border-[var(--selection-color)] bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]'
              : 'border-[var(--project-border)] bg-[var(--project-surface)] hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]');
          if (tool === 'class') {
            return (
              <button
                key={tool}
                type="button"
                title={t('palette.classTooltip', { name: t(TOOL_LABEL_KEYS[tool]) })}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-uml-tool', tool);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onSelectTool(tool)}
                className={`${tileClasses} cursor-grab active:cursor-grabbing`}
              >
                <span aria-hidden className="text-2xl leading-none">
                  {TOOL_GLYPHS[tool]}
                </span>
                <span className="text-xs font-medium">
                  {t(TOOL_LABEL_KEYS[tool])}
                </span>
              </button>
            );
          }
          return (
            <button
              key={tool}
              type="button"
              title={t(TOOL_LABEL_KEYS[tool])}
              onClick={() => onSelectTool(tool)}
              className={tileClasses}
            >
              <span aria-hidden className="text-2xl leading-none">
                {TOOL_GLYPHS[tool]}
              </span>
              <span className="text-xs font-medium">
                {t(TOOL_LABEL_KEYS[tool])}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 px-1 text-xs text-[var(--project-text-muted)]">
        {activeTool && activeTool !== 'class'
          ? t('palette.hintConnect')
          : t('palette.hintClass')}
      </p>
      <div className="mt-3 flex flex-col gap-2 px-1">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--project-text-secondary)]">
            {t('palette.packageNameLabel')}
          </span>
          <input
            type="text"
            value={packageName}
            onChange={(e) => onUpdateMeta({ packageName: e.target.value, diagramName })}
            className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-2 py-1 text-sm text-[var(--project-text-primary)] focus:border-[var(--selection-color)] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--project-text-secondary)]">
            {t('palette.diagramNameLabel')}
          </span>
          <input
            type="text"
            value={diagramName}
            onChange={(e) => onUpdateMeta({ packageName, diagramName: e.target.value })}
            className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-2 py-1 text-sm text-[var(--project-text-primary)] focus:border-[var(--selection-color)] focus:outline-none"
          />
        </label>
      </div>
    </aside>
  );
}
