import { DiagramDocument, DiagramOp } from './diagram-types';

function upsertList<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    const next = list.slice();
    next[idx] = item;
    return next;
  }
  return [...list, item];
}

// Pure, immutable op application for React state. Returns a new document so
// React detects the change; the same op applied again (server echo) is
// idempotent, so local optimistic apply + echo re-apply converge safely.
export function applyOp(
  doc: DiagramDocument,
  op: DiagramOp,
): DiagramDocument {
  switch (op.op) {
    case 'upsertElement':
      return { ...doc, elements: upsertList(doc.elements, op.element) };
    case 'upsertRelationship':
      return {
        ...doc,
        relationships: upsertList(doc.relationships, op.relationship),
      };
    case 'move':
      return {
        ...doc,
        elements: doc.elements.map((e) =>
          e.id === op.id ? { ...e, x: op.x, y: op.y } : e,
        ),
      };
    case 'updateMeta': {
      // Partial update: only the fields provided on the op are applied.
      // Both fields are always sent together from the palette.
      const next = { ...doc };
      if (op.packageName !== undefined) {
        next.packageName = op.packageName;
      }
      if (op.diagramName !== undefined) {
        next.diagramName = op.diagramName;
      }
      return next;
    }
    case 'delete': {
      const id = op.id;
      return {
        ...doc,
        elements: doc.elements.filter((e) => e.id !== id),
        relationships: doc.relationships.filter(
          (r) => r.id !== id && r.sourceId !== id && r.targetId !== id,
        ),
      };
    }
    default:
      return doc;
  }
}
