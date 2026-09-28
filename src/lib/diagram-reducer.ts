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
      // Association-class delete closure, iterated to a fixed point and
      // identical to the backend reducer: removing a relationship also
      // removes its tied association class; removing an element removes
      // relationships tied to it as an association class and relationships
      // referencing it as source/target, each taking its tied class along.
      const removedElements = new Set<string>([id]);
      const removedRelationships = new Set<string>();
      let changed = true;
      while (changed) {
        changed = false;
        for (const rel of doc.relationships) {
          if (removedRelationships.has(rel.id)) {
            continue;
          }
          const endpointGone =
            removedElements.has(rel.sourceId) ||
            removedElements.has(rel.targetId);
          const tiedClassGone =
            !!rel.associationClassId &&
            removedElements.has(rel.associationClassId);
          if (rel.id === id || endpointGone || tiedClassGone) {
            removedRelationships.add(rel.id);
            if (rel.associationClassId) {
              removedElements.add(rel.associationClassId);
            }
            changed = true;
          }
        }
      }
      return {
        ...doc,
        elements: doc.elements.filter((e) => !removedElements.has(e.id)),
        relationships: doc.relationships.filter(
          (r) => !removedRelationships.has(r.id),
        ),
      };
    }
    default:
      return doc;
  }
}
