// Frontend mirror of the backend diagram document model. Kept in sync with
// backend/src/diagrams/diagram.types.ts. Ops are applied client-side for
// instant feedback and re-applied idempotently on the server echo.

export type RelationshipKind =
  | 'association'
  | 'generalization'
  | 'composition'
  | 'aggregation';

export interface ClassAttribute {
  id: string;
  name: string;
  type: string;
}

export interface ClassOperation {
  id: string;
  name: string;
  returnType: string;
}

export interface ClassElement {
  id: string;
  kind: 'class';
  name: string;
  x: number;
  y: number;
  attributes: ClassAttribute[];
  operations: ClassOperation[];
}

export interface RelationshipElement {
  id: string;
  kind: RelationshipKind;
  name: string;
  sourceId: string;
  targetId: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
}

export interface DiagramDocument {
  packageName: string;
  diagramName: string;
  elements: ClassElement[];
  relationships: RelationshipElement[];
}

export function emptyDiagram(): DiagramDocument {
  return { packageName: '', diagramName: '', elements: [], relationships: [] };
}

export type DiagramOp =
  | { op: 'upsertElement'; element: ClassElement }
  | { op: 'upsertRelationship'; relationship: RelationshipElement }
  | { op: 'move'; id: string; x: number; y: number }
  | { op: 'delete'; id: string }
  | { op: 'updateMeta'; packageName?: string; diagramName?: string };

export const DIAGRAM_EVENT = {
  STATE: 'diagram:state',
  OP: 'diagram:op',
  PRESENCE_COUNT: 'presence:count',
  JOIN: 'join',
  SAVE_REQUEST: 'save:request',
  ELEMENT_LOCK: 'element:lock',
  ELEMENT_UNLOCK: 'element:unlock',
  ELEMENT_LOCKED: 'element:locked',
  ELEMENT_UNLOCKED: 'element:unlocked',
  ELEMENT_LOCK_DENIED: 'element:lock-denied',
} as const;

export const PALETTE_TOOLS = [
  'class',
  'association',
  'generalization',
  'composition',
  'aggregation',
] as const;
export type PaletteTool = (typeof PALETTE_TOOLS)[number];

export const TOOL_LABELS: Record<PaletteTool, string> = {
  class: 'Class',
  association: 'Associate',
  generalization: 'Generalize',
  composition: 'Compose',
  aggregation: 'Aggregate',
};

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function defaultClassElement(x: number, y: number): ClassElement {
  return {
    id: newId(),
    kind: 'class',
    name: 'NewClass',
    x,
    y,
    attributes: [],
    operations: [],
  };
}
