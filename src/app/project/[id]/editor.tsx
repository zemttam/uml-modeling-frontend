'use client';

import { useState } from 'react';
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
  } = useProjectSocket(projectId, (deniedId) => {
    // lost a lock race: drop selection if it was on the denied element
    setSelectedId((prev) => (prev === deniedId ? null : prev));
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<PaletteTool | null>(null);
  const [pendingConnect, setPendingConnect] = useState<{
    tool: PaletteTool;
    sourceId: string;
  } | null>(null);
  // All local mutations go through the history layer so they are undoable;
  // the layer re-emits inverse/forward ops through sendOp on undo/redo.
  const history = useDiagramHistory(sendOp);

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
    const cascaded = element
      ? diagram.relationships.filter(
          (r) => r.sourceId === id || r.targetId === id,
        )
      : [];
    history.commit(
      { op: 'delete', id },
      { kind: 'delete', element, relationship, cascaded },
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
        projectName={projectName}
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
