'use client';

import { useState } from 'react';
import {
  type ClassAttribute,
  type ClassElement,
  type ClassOperation,
  type RelationshipElement,
  newId,
} from '@/lib/diagram-types';
import { useLanguage } from '@/lib/i18n/language-context';
import {
  ATTRIBUTE_TYPE_OPTIONS,
  MULTIPLICITY_OPTIONS,
} from '@/lib/diagram-options';
import './theme.css';

// Native fixed-option dropdown: notation options untranslated, plus a
// translated "None" option (empty value clears the field), plus the stored
// value as one extra option when it is outside the fixed list so it is
// neither hidden nor discarded.
function OptionSelect({
  value,
  options,
  noneLabel,
  onChange,
  className,
}: {
  value: string;
  options: readonly string[];
  noneLabel: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const extra =
    value !== '' && !options.includes(value) ? (
      <option value={value}>{value}</option>
    ) : null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      <option value="">{noneLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {extra}
    </select>
  );
}

function attributeHasContent(a: ClassAttribute): boolean {
  return a.name.trim().length > 0 || a.type.trim().length > 0;
}

function operationHasContent(o: ClassOperation): boolean {
  return o.name.trim().length > 0 || o.returnType.trim().length > 0;
}

// Emits the class update with blank attribute/operation rows excluded: a row
// is persisted only once at least one of its fields has content after
// trimming. Blank rows still visible in the form are local drafts only.
function emitClassUpdate(
  el: ClassElement,
  onUpdateClass: (el: ClassElement) => void,
): void {
  onUpdateClass({
    ...el,
    attributes: el.attributes.filter(attributeHasContent),
    operations: el.operations.filter(operationHasContent),
  });
}

// Class form with local blank-row drafts: rows appended via "+" (or the
// default empty row) live only in the form until content is typed into one
// of their fields, at which point they join the emitted element.
function ClassForm({
  el,
  onUpdateClass,
  onDelete,
}: {
  el: ClassElement;
  onUpdateClass: (el: ClassElement) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [blankAttributes, setBlankAttributes] = useState<ClassAttribute[]>([
    { id: newId(), name: '', type: '' },
  ]);
  const [blankOperations, setBlankOperations] = useState<ClassOperation[]>([
    { id: newId(), name: '', returnType: '' },
  ]);

  const emit = (next: ClassElement) => emitClassUpdate(next, onUpdateClass);

  const setName = (name: string) => emit({ ...el, name });
  const updateAttribute = (id: string, patch: Partial<ClassAttribute>) =>
    emit({
      ...el,
      attributes: el.attributes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  const removeAttribute = (id: string) =>
    emit({ ...el, attributes: el.attributes.filter((a) => a.id !== id) });
  const addAttribute = () =>
    setBlankAttributes((prev) => [
      ...prev,
      { id: newId(), name: '', type: '' },
    ]);
  const updateBlankAttribute = (draft: ClassAttribute, patch: Partial<ClassAttribute>) => {
    const next = { ...draft, ...patch };
    if (attributeHasContent(next)) {
      // first content typed: the row joins the element
      emit({ ...el, attributes: [...el.attributes, next] });
      setBlankAttributes((prev) => prev.filter((a) => a.id !== draft.id));
    } else {
      setBlankAttributes((prev) =>
        prev.map((a) => (a.id === draft.id ? next : a)),
      );
    }
  };

  const updateOperation = (id: string, patch: Partial<ClassOperation>) =>
    emit({
      ...el,
      operations: el.operations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  const removeOperation = (id: string) =>
    emit({ ...el, operations: el.operations.filter((o) => o.id !== id) });
  const addOperation = () =>
    setBlankOperations((prev) => [
      ...prev,
      { id: newId(), name: '', returnType: '' },
    ]);
  const updateBlankOperation = (draft: ClassOperation, patch: Partial<ClassOperation>) => {
    const next = { ...draft, ...patch };
    if (operationHasContent(next)) {
      emit({ ...el, operations: [...el.operations, next] });
      setBlankOperations((prev) => prev.filter((o) => o.id !== draft.id));
    } else {
      setBlankOperations((prev) =>
        prev.map((o) => (o.id === draft.id ? next : o)),
      );
    }
  };

  const attributeInput = (
    row: ClassAttribute,
    onChange: (patch: Partial<ClassAttribute>) => void,
    onRemove: () => void,
  ) => (
    <div key={row.id} className="flex items-center gap-1">
      <input
        type="text"
        placeholder={t('properties.namePlaceholder')}
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-24 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-1 py-0.5 text-xs"
      />
      <OptionSelect
        value={row.type}
        options={ATTRIBUTE_TYPE_OPTIONS}
        noneLabel={t('properties.none')}
        onChange={(type) => onChange({ type })}
        className="w-20 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-1 py-0.5 text-xs"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-red-600 hover:opacity-80"
      >
        ✕
      </button>
    </div>
  );

  const operationInput = (
    row: ClassOperation,
    onChange: (patch: Partial<ClassOperation>) => void,
    onRemove: () => void,
  ) => (
    <div key={row.id} className="flex items-center gap-1">
      <input
        type="text"
        placeholder={t('properties.namePlaceholder')}
        value={row.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="w-24 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-1 py-0.5 text-xs"
      />
      <input
        type="text"
        placeholder={t('properties.returnTypePlaceholder')}
        value={row.returnType}
        onChange={(e) => onChange({ returnType: e.target.value })}
        className="w-20 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-1 py-0.5 text-xs"
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-xs text-red-600 hover:opacity-80"
      >
        ✕
      </button>
    </div>
  );

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-auto border-l border-[var(--project-border)] bg-[var(--project-surface)] p-3 text-sm text-[var(--project-text-primary)]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--project-text-primary)]">{t('properties.classHeading')}</h2>
        <button
          type="button"
          onClick={() => onDelete(el.id)}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {t('properties.delete')}
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--project-text-secondary)]">{t('properties.name')}</span>
        <input
          type="text"
          value={el.name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-2 py-1"
        />
      </label>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--project-text-secondary)]">
            {t('properties.attributes')}
          </span>
          <button
            type="button"
            onClick={addAttribute}
            className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] hover:bg-[var(--project-surface-hover)] px-2 py-0.5 text-xs text-[var(--project-text-primary)]"
          >
            {t('properties.addAttribute')}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {[...el.attributes, ...blankAttributes].map((a) => {
            // Single child array: a blank row graduating into the element is
            // merely reordered by key, so React reuses the DOM node and the
            // input keeps keyboard focus.
            const isBlank = blankAttributes.some((b) => b.id === a.id);
            return attributeInput(
              a,
              (patch) =>
                isBlank
                  ? updateBlankAttribute(a, patch)
                  : updateAttribute(a.id, patch),
              () =>
                isBlank
                  ? setBlankAttributes((prev) =>
                      prev.filter((x) => x.id !== a.id),
                    )
                  : removeAttribute(a.id),
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--project-text-secondary)]">
            {t('properties.operations')}
          </span>
          <button
            type="button"
            onClick={addOperation}
            className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] hover:bg-[var(--project-surface-hover)] px-2 py-0.5 text-xs text-[var(--project-text-primary)]"
          >
            {t('properties.addOperation')}
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {[...el.operations, ...blankOperations].map((o) => {
            const isBlank = blankOperations.some((b) => b.id === o.id);
            return operationInput(
              o,
              (patch) =>
                isBlank
                  ? updateBlankOperation(o, patch)
                  : updateOperation(o.id, patch),
              () =>
                isBlank
                  ? setBlankOperations((prev) =>
                      prev.filter((x) => x.id !== o.id),
                    )
                  : removeOperation(o.id),
            );
          })}
        </div>
      </div>
    </aside>
  );
}

interface SidebarProps {
  selectedClass: ClassElement | null;
  selectedRelationship: RelationshipElement | null;
  onUpdateClass: (el: ClassElement) => void;
  onUpdateRelationship: (rel: RelationshipElement) => void;
  onDelete: (id: string) => void;
}

// Right properties sidebar: class form (name, attributes table, operations
// table) and a minimal relationship form (kind read-only, name, source/target
// multiplicities).
export default function PropertiesSidebar({
  selectedClass,
  selectedRelationship,
  onUpdateClass,
  onUpdateRelationship,
  onDelete,
}: SidebarProps) {
  const { t } = useLanguage();
  if (!selectedClass && !selectedRelationship) {
    return (
      <aside className="flex w-72 shrink-0 flex-col gap-2 border-l border-[var(--project-border)] bg-[var(--project-surface)] p-3 text-sm text-[var(--project-text-muted)]">
        {t('properties.selectElement')}
      </aside>
    );
  }

  if (selectedClass) {
    return (
      <ClassForm
        el={selectedClass}
        onUpdateClass={onUpdateClass}
        onDelete={onDelete}
      />
    );
  }

  // relationship form
  const rel = selectedRelationship!;
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-auto border-l border-[var(--project-border)] bg-[var(--project-surface)] p-3 text-sm text-[var(--project-text-primary)]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--project-text-primary)]">{t('properties.relationshipHeading')}</h2>
        <button
          type="button"
          onClick={() => onDelete(rel.id)}
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          {t('properties.delete')}
        </button>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--project-text-secondary)]">{t('properties.kind')}</span>
        <input
          type="text"
          value={rel.kind}
          readOnly
          className="rounded border border-[var(--input-border)] bg-[var(--project-surface-hover)] px-2 py-1 text-[var(--project-text-secondary)]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--project-text-secondary)]">{t('properties.name')}</span>
        <input
          type="text"
          value={rel.name}
          onChange={(e) => onUpdateRelationship({ ...rel, name: e.target.value })}
          className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--project-text-secondary)]">{t('properties.sourceMultiplicity')}</span>
        <OptionSelect
          value={rel.sourceMultiplicity}
          options={MULTIPLICITY_OPTIONS}
          noneLabel={t('properties.none')}
          onChange={(sourceMultiplicity) =>
            onUpdateRelationship({ ...rel, sourceMultiplicity })
          }
          className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--project-text-secondary)]">{t('properties.targetMultiplicity')}</span>
        <OptionSelect
          value={rel.targetMultiplicity}
          options={MULTIPLICITY_OPTIONS}
          noneLabel={t('properties.none')}
          onChange={(targetMultiplicity) =>
            onUpdateRelationship({ ...rel, targetMultiplicity })
          }
          className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--input-text)] px-2 py-1"
        />
      </label>
      {rel.kind !== 'generalization' && (
        <button
          type="button"
          onClick={() =>
            onUpdateRelationship({
              ...rel,
              sourceId: rel.targetId,
              targetId: rel.sourceId,
              sourceMultiplicity: rel.targetMultiplicity,
              targetMultiplicity: rel.sourceMultiplicity,
            })
          }
          className="rounded border border-[var(--project-border)] bg-[var(--project-surface)] px-2 py-1 text-sm hover:bg-[var(--project-surface-hover)] text-[var(--project-text-primary)]"
        >
          {t('properties.switchDirection')}
        </button>
      )}
    </aside>
  );
}
