'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ClassElement,
  type DiagramOp,
  type RelationshipElement,
} from './diagram-types';

const MAX_STACK = 100;
const COALESCE_WINDOW_MS = 500;

// Snapshot of the diagram state before a local action, taken by the caller
// (editor.tsx) from the current diagram. Used to build the inverse ops so a
// single undo reverts the action.
export type PrevSnapshot =
  | { kind: 'element'; element: ClassElement | null }
  | { kind: 'relationship'; relationship: RelationshipElement | null }
  | { kind: 'position'; x: number; y: number }
  | {
      kind: 'delete';
      element: ClassElement | null;
      relationship: RelationshipElement | null;
      cascaded: RelationshipElement[];
    }
  | { kind: 'meta'; packageName: string; diagramName: string };

interface HistoryEntry {
  /** ops emitted through sendOp to revert the action */
  inverse: DiagramOp[];
  /** ops emitted through sendOp to re-apply the action (redo) */
  forward: DiagramOp[];
  /** coalescing key: same target element/relationship + same field(s) */
  key: string | null;
  time: number;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Which top-level fields changed between the previous and next element, used
// for the coalescing key so a typing burst in one field is one undo entry.
function changedElementFields(
  prev: ClassElement | null,
  next: ClassElement,
): string {
  if (!prev) {
    const fields: string[] = [];
    if (next.name) fields.push('name');
    if (next.attributes.length > 0) fields.push('attributes');
    if (next.operations.length > 0) fields.push('operations');
    return fields.join('|') || 'new';
  }
  const fields: string[] = [];
  if (prev.name !== next.name) fields.push('name');
  if (!sameJson(prev.attributes, next.attributes)) fields.push('attributes');
  if (!sameJson(prev.operations, next.operations)) fields.push('operations');
  return fields.join('|');
}

function changedRelationshipFields(
  prev: RelationshipElement | null,
  next: RelationshipElement,
): string {
  if (!prev) {
    const fields: string[] = [];
    if (next.name) fields.push('name');
    if (next.sourceId) fields.push('endpoints');
    if (next.sourceMultiplicity) fields.push('sourceMultiplicity');
    if (next.targetMultiplicity) fields.push('targetMultiplicity');
    return fields.join('|') || 'new';
  }
  const fields: string[] = [];
  if (prev.name !== next.name) fields.push('name');
  if (prev.sourceId !== next.sourceId || prev.targetId !== next.targetId) {
    fields.push('endpoints');
  }
  if (prev.sourceMultiplicity !== next.sourceMultiplicity) {
    fields.push('sourceMultiplicity');
  }
  if (prev.targetMultiplicity !== next.targetMultiplicity) {
    fields.push('targetMultiplicity');
  }
  return fields.join('|');
}

function buildEntry(op: DiagramOp, prev: PrevSnapshot): HistoryEntry {
  const time = Date.now();
  switch (op.op) {
    case 'upsertElement': {
      const el = prev.kind === 'element' ? prev.element : null;
      const inverse: DiagramOp[] = el
        ? [{ op: 'upsertElement', element: el }]
        : [{ op: 'delete', id: op.element.id }];
      return {
        inverse,
        forward: [op],
        key: `el:${op.element.id}:${changedElementFields(el, op.element)}`,
        time,
      };
    }
    case 'upsertRelationship': {
      const rel = prev.kind === 'relationship' ? prev.relationship : null;
      const inverse: DiagramOp[] = rel
        ? [{ op: 'upsertRelationship', relationship: rel }]
        : [{ op: 'delete', id: op.relationship.id }];
      return {
        inverse,
        forward: [op],
        key: `rel:${op.relationship.id}:${changedRelationshipFields(
          rel,
          op.relationship,
        )}`,
        time,
      };
    }
    case 'move': {
      const p = prev.kind === 'position' ? prev : { x: 0, y: 0 };
      return {
        inverse: [{ op: 'move', id: op.id, x: p.x, y: p.y }],
        forward: [op],
        key: null,
        time,
      };
    }
    case 'updateMeta': {
      const p =
        prev.kind === 'meta' ? prev : { packageName: '', diagramName: '' };
      const inverse: DiagramOp[] = [
        {
          op: 'updateMeta',
          packageName: p.packageName,
          diagramName: p.diagramName,
        },
      ];
      const fields: string[] = [];
      if (op.packageName !== undefined && op.packageName !== p.packageName) {
        fields.push('packageName');
      }
      if (op.diagramName !== undefined && op.diagramName !== p.diagramName) {
        fields.push('diagramName');
      }
      return {
        inverse,
        forward: [op],
        key: `meta:${fields.join('|')}`,
        time,
      };
    }
    case 'delete': {
      // Inverse restores the deleted item and, for a class, every
      // relationship the reducer cascade removed with it.
      const inverse: DiagramOp[] = [];
      if (prev.kind === 'delete') {
        if (prev.element) inverse.push({ op: 'upsertElement', element: prev.element });
        if (prev.relationship) {
          inverse.push({
            op: 'upsertRelationship',
            relationship: prev.relationship,
          });
        }
        for (const rel of prev.cascaded) {
          inverse.push({ op: 'upsertRelationship', relationship: rel });
        }
      }
      return { inverse, forward: [op], key: null, time };
    }
    default:
      return { inverse: [], forward: [], key: null, time };
  }
}

export interface DiagramHistory {
  commit: (op: DiagramOp, prev: PrevSnapshot) => void;
  beginMove: (id: string, x: number, y: number) => void;
  endMove: (x: number, y: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// Local-only undo/redo layered on the existing op pipeline: new local actions
// and inverse/forward replays all go through the injected sendOp (optimistic
// apply + socket emit), so undos sync to the server and other users like any
// edit. Remote ops bypass this hook entirely and never touch the stacks.
export function useDiagramHistory(
  sendOp: (op: DiagramOp) => void,
): DiagramHistory {
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const pendingMove = useRef<{ id: string; x: number; y: number } | null>(null);
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const sendOpRef = useRef(sendOp);
  sendOpRef.current = sendOp;

  const syncCounts = useCallback(() => {
    setCounts({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  }, []);

  const pushEntry = useCallback(
    (entry: HistoryEntry) => {
      const stack = undoStack.current;
      const top = stack[stack.length - 1];
      if (
        entry.key &&
        top &&
        top.key === entry.key &&
        entry.time - top.time < COALESCE_WINDOW_MS
      ) {
        // Coalesce: keep the earliest before-snapshot (inverse) so one undo
        // reverts the whole burst; the latest op becomes the redo target.
        stack[stack.length - 1] = { ...top, forward: entry.forward, time: entry.time };
      } else {
        stack.push(entry);
        if (stack.length > MAX_STACK) stack.shift();
      }
      redoStack.current = [];
      syncCounts();
    },
    [syncCounts],
  );

  const commit = useCallback(
    (op: DiagramOp, prev: PrevSnapshot) => {
      pushEntry(buildEntry(op, prev));
      sendOpRef.current(op);
    },
    [pushEntry],
  );

  const beginMove = useCallback((id: string, x: number, y: number) => {
    // Record the pre-drag position; intermediate/live move ops stream through
    // sendOp as usual, and endMove commits exactly one history entry.
    pendingMove.current = { id, x, y };
  }, []);

  const endMove = useCallback(
    (finalX: number, finalY: number) => {
      const p = pendingMove.current;
      pendingMove.current = null;
      if (!p) return;
      if (p.x === finalX && p.y === finalY) return;
      pushEntry({
        inverse: [{ op: 'move', id: p.id, x: p.x, y: p.y }],
        forward: [{ op: 'move', id: p.id, x: finalX, y: finalY }],
        key: null,
        time: Date.now(),
      });
    },
    [pushEntry],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    entry.inverse.forEach((op) => sendOpRef.current(op));
    redoStack.current.push(entry);
    syncCounts();
  }, [syncCounts]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    entry.forward.forEach((op) => sendOpRef.current(op));
    undoStack.current.push(entry);
    syncCounts();
  }, [syncCounts]);

  // Global shortcuts: Ctrl+Z undo; Ctrl+Y and Ctrl+Shift+Z redo. Skipped when
  // focus is in a text input/textarea/contenteditable so the browser's native
  // text undo/redo applies there.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return {
    commit,
    beginMove,
    endMove,
    undo,
    redo,
    canUndo: counts.undo > 0,
    canRedo: counts.redo > 0,
  };
}
