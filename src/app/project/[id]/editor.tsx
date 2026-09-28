'use client';

import { useRef, useState } from 'react';
import { useProjectSocket } from '@/lib/use-project-socket';
import { useDiagramHistory } from '@/lib/use-diagram-history';
import {
  type ClassElement,
  type DiagramOp,
  type PaletteTool,
  type RelationshipElement,
  defaultClassElement,
  newId,
} from '@/lib/diagram-types';
import Toolbar from './toolbar';
import Palette from './palette';
import Canvas from './canvas';
import PropertiesSidebar from './properties-sidebar';

interface EditorProps {
  projectId: string;
  projectName: string;
}

// Client editor: owns the socket lifecycle (via the hook), selection state, and
// connect-mode for relationship tools. Composes toolbar, palette, canvas, and
// properties sidebar. All edits go through sendOp so they sync to others.
export default function Editor({ projectId, projectName }: EditorProps) {
  const [name, setName] = useState(projectName);
  // history is created after the socket hook (it needs sendOp), so the
  // STATE-reset callback goes through a ref
  const historyResetRef = useRef<(() => void) | null>(null);
  const {
    diagram,
    presence,
    connected,
    sendOp,
    forceSave,
    lockedIds,
    heldLockId,
    lockElement,
    unlockElement,
  } = useProjectSocket(
    projectId,
    (deniedId) => {
      // lost a lock race: drop selection if it was on the denied element
      setSelectedId((prev) => (prev === deniedId ? null : prev));
    },
    // server replaced the whole document (e.g. an XMI import): drop history
    () => historyResetRef.current?.(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<PaletteTool | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{
    tool: PaletteTool;
    sourceId: string;
  } | null>(null);
  // All local mutations go through the history layer so they are undoable;
  // the layer re-emits inverse/forward ops through sendOp on undo/redo.
  const history = useDiagramHistory(sendOp);
  historyResetRef.current = history.reset;

  function handleDropClass(x: number, y: number) {
    const el = defaultClassElement(x, y);
    history.commit(
      { op: 'upsertElement', element: el },
      { kind: 'element', element: null },
    );
    setSelectedId(el.id);
    setPendingConnect(null);
    setActiveTool(null);
  }

  function handleClassClick(id: string) {
    if (activeTool && activeTool !== 'class') {
      // relationship connect mode: click source then target
      if (!pendingConnect) {
        setPendingConnect({ tool: activeTool, sourceId: id });
      } else if (pendingConnect.sourceId === id) {
        // clicking the same source cancels
        setPendingConnect(null);
      } else if (pendingConnect.tool === 'associationClass') {
        // Association Class: an association between the two clicked
        // classes plus a new class box near the line midpoint, committed as
        // one composite history entry.
        const source = diagram.elements.find(
          (e) => e.id === pendingConnect.sourceId,
        );
        const target = diagram.elements.find((e) => e.id === id);
        const box: ClassElement = defaultClassElement(0, 0);
        const rel: RelationshipElement = {
          id: newId(),
          kind: 'association',
          name: '',
          sourceId: pendingConnect.sourceId,
          targetId: id,
          sourceMultiplicity: '',
          targetMultiplicity: '',
          associationClassId: box.id,
        };
        if (source && target) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          box.x = Math.round(midX);
          box.y = Math.round(midY + 70);
        } else {
          box.x = 0;
          box.y = 0;
        }
        history.commitGroup(
          [
            { op: 'upsertRelationship', relationship: rel },
            { op: 'upsertElement', element: box },
          ],
          [
            { op: 'delete', id: rel.id },
            { op: 'delete', id: box.id },
          ],
        );
        setSelectedId(rel.id);
        setPendingConnect(null);
        setActiveTool(null);
      } else {
        const rel: RelationshipElement = {
          id: newId(),
          kind: pendingConnect.tool as RelationshipElement['kind'],
          name: '',
          sourceId: pendingConnect.sourceId,
          targetId: id,
          sourceMultiplicity: '',
          targetMultiplicity: '',
        };
        history.commit(
          { op: 'upsertRelationship', relationship: rel },
          { kind: 'relationship', relationship: null },
        );
        setSelectedId(rel.id);
        setPendingConnect(null);
        setActiveTool(null);
      }
      return;
    }
    setSelectedId(id);
  }

  function handleMove(id: string, x: number, y: number) {
    // Live move op streams through sendOp; the single history entry for the
    // whole drag is committed via the beginMove/endMove drag lifecycle.
    sendOp({ op: 'move', id, x: Math.round(x), y: Math.round(y) } as DiagramOp);
  }

  function handleSelectRelationship(id: string) {
    setSelectedId(id);
    setPendingConnect(null);
  }

  function handleClearSelection() {
    // pointer-down on empty canvas releases the currently held lock
    if (heldLockId) {
      unlockElement(heldLockId);
    }
    setSelectedId(null);
    setPendingConnect(null);
    if (activeTool && activeTool !== 'class') {
      setActiveTool(null);
    }
  }

  function handleUpdateClass(el: ClassElement) {
    history.commit(
      { op: 'upsertElement', element: el },
      {
        kind: 'element',
        element: diagram.elements.find((e) => e.id === el.id) ?? null,
      },
    );
    setSelectedId(el.id);
  }

  function handleUpdateRelationship(rel: RelationshipElement) {
    history.commit(
      { op: 'upsertRelationship', relationship: rel },
      {
        kind: 'relationship',
        relationship:
          diagram.relationships.find((r) => r.id === rel.id) ?? null,
      },
    );
    setSelectedId(rel.id);
  }

  function handleUpdateMeta(meta: { packageName: string; diagramName: string }) {
    history.commit({ op: 'updateMeta', ...meta }, {
      kind: 'meta',
      packageName: diagram.packageName,
      diagramName: diagram.diagramName,
    });
  }

  function handleDelete(id: string) {
    const element = diagram.elements.find((e) => e.id === id) ?? null;
    const relationship = element
      ? null
      : (diagram.relationships.find((r) => r.id === id) ?? null);
    // Snapshot the full cascade the reducer will perform (mirroring its
    // fixed-point closure) so one undo restores the complete deleted set,
    // including association-class boxes.
    const removedElements = new Set<string>([id]);
    const removedRelationships = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const rel of diagram.relationships) {
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
    const cascaded = diagram.relationships.filter(
      (r) => r.id !== id && removedRelationships.has(r.id),
    );
    const cascadedElements = diagram.elements.filter(
      (e) => e.id !== id && removedElements.has(e.id),
    );
    history.commit(
      { op: 'delete', id },
      {
        kind: 'delete',
        element,
        relationship,
        cascaded,
        cascadedElements,
      },
    );
    setSelectedId(null);
    setPendingConnect(null);
  }

  const selectedClass = diagram.elements.find((e) => e.id === selectedId) ?? null;
  const selectedRelationship =
    diagram.relationships.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        projectId={projectId}
        projectName={name}
        onProjectRenamed={setName}
        presence={presence}
        connected={connected}
        onSave={forceSave}
        onUndo={history.undo}
        onRedo={history.redo}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
      />
      <div className="flex min-h-0 flex-1">
        <Palette
          activeTool={activeTool}
          onSelectTool={(tool) => {
            if (tool === 'class') {
              setActiveTool(null);
              setPendingConnect(null);
            } else {
              setActiveTool(tool);
              setPendingConnect(null);
            }
          }}
          packageName={diagram.packageName}
          diagramName={diagram.diagramName}
          onUpdateMeta={handleUpdateMeta}
        />
        <Canvas
          diagram={diagram}
          selectedId={selectedId}
          pendingConnectSource={pendingConnect?.sourceId ?? null}
          lockedIds={lockedIds}
          onSelectRelationship={handleSelectRelationship}
          onClearSelection={handleClearSelection}
          onClassClick={handleClassClick}
          onDropClass={handleDropClass}
          onMove={handleMove}
          onLockElement={lockElement}
          onDragStart={(id, x, y) => history.beginMove(id, x, y)}
          onDragEnd={(x, y) =>
            history.endMove(Math.round(x), Math.round(y))
          }
        />
        <PropertiesSidebar
          selectedClass={selectedClass}
          selectedRelationship={selectedRelationship}
          onUpdateClass={handleUpdateClass}
          onUpdateRelationship={handleUpdateRelationship}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
