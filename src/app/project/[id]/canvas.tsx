'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ClassElement,
  type DiagramDocument,
  type RelationshipKind,
} from '@/lib/diagram-types';
import './theme.css';

const BOX_W = 150;
const HEADER_H = 22;
const LINE_H = 16;
const PAD = 4;

function boxHeight(el: ClassElement): number {
  const attrH = Math.max(el.attributes.length, 1) * LINE_H + PAD * 2;
  const opH = Math.max(el.operations.length, 1) * LINE_H + PAD * 2;
  return HEADER_H + attrH + opH;
}

// Point on the border of a rect (centered at cx,cy, size BOX_W x h) along the
// ray toward (tx,ty). Used to anchor relationship endpoints to box edges.
function borderPoint(
  cx: number,
  cy: number,
  h: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = BOX_W / 2;
  const halfH = h / 2;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function markerFor(kind: RelationshipKind): {
  start?: string;
  end?: string;
} {
  switch (kind) {
    case 'generalization':
      return { end: 'url(#m-arrow)' };
    case 'composition':
      return { start: 'url(#m-diamond-filled)' };
    case 'aggregation':
      return { start: 'url(#m-diamond-hollow)' };
    default:
      return {};
  }
}

interface CanvasProps {
  diagram: DiagramDocument;
  selectedId: string | null;
  pendingConnectSource: string | null;
  lockedIds: Set<string>;
  onSelectRelationship: (id: string) => void;
  onClearSelection: () => void;
  onClassClick: (id: string) => void;
  onDropClass: (x: number, y: number) => void;
  onMove: (id: string, x: number, y: number) => void;
  onLockElement: (id: string) => void;
  onDragStart: (id: string, x: number, y: number) => void;
  onDragEnd: (x: number, y: number) => void;
}

interface DragState {
  id: string;
  startClientX: number;
  startClientY: number;
  origX: number;
  origY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

export default function Canvas({
  diagram,
  selectedId,
  pendingConnectSource,
  lockedIds,
  onSelectRelationship,
  onClearSelection,
  onClassClick,
  onDropClass,
  onMove,
  onLockElement,
  onDragStart,
  onDragEnd,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // a lock denial arriving mid-drag aborts the in-flight drag
  useEffect(() => {
    if (drag && lockedIds.has(drag.id)) {
      setDrag(null);
    }
  }, [lockedIds, drag]);

  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const tool = e.dataTransfer.getData('application/x-uml-tool');
    if (tool !== 'class') return;
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    onDropClass(x - BOX_W / 2, y - HEADER_H / 2);
  }

  function handleBackgroundPointerDown() {
    // pointer-down on empty canvas releases the currently held lock
    onClearSelection();
  }

  function handleClassPointerDown(e: React.PointerEvent, el: ClassElement) {
    e.stopPropagation();
    if (lockedIds.has(el.id)) {
      // locked by another user: no select, no drag, no lock emit
      return;
    }
    // optimistically acquire the lock, then proceed with select/drag
    onLockElement(el.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onDragStart(el.id, el.x, el.y);
    setDrag({
      id: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: el.x,
      origY: el.y,
      dx: 0,
      dy: 0,
      moved: false,
    });
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
      setDrag({ ...drag, dx, dy, moved: true });
    } else if (drag.moved && (dx !== drag.dx || dy !== drag.dy)) {
      setDrag({ ...drag, dx, dy });
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    const id = drag.id;
    if (drag.moved) {
      onMove(id, drag.origX + dx, drag.origY + dy);
      onDragEnd(drag.origX + dx, drag.origY + dy);
    } else {
      // no movement: still close the drag lifecycle (clears pending history)
      onDragEnd(drag.origX, drag.origY);
      onClassClick(id);
    }
    setDrag(null);
  }

  return (
    <div className="relative flex-1 overflow-auto bg-[var(--canvas-bg)]">
      <svg
        ref={svgRef}
        width={2000}
        height={1400}
        style={{ cursor: 'default' }}
        onPointerDown={handleBackgroundPointerDown}
        onClick={() => onClearSelection()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <marker
            id="m-arrow"
            viewBox="0 0 12 12"
            refX="11"
            refY="6"
            markerWidth="13"
            markerHeight="13"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L11,6 L0,12 z" fill="var(--node-bg)" stroke="var(--node-border)" />
          </marker>
          <marker
            id="m-diamond-filled"
            viewBox="0 0 16 10"
            refX="1"
            refY="5"
            markerWidth="16"
            markerHeight="10"
            orient="auto"
          >
            <path d="M1,5 L8,1 L15,5 L8,9 z" fill="var(--node-border)" stroke="var(--node-border)" />
          </marker>
          <marker
            id="m-diamond-hollow"
            viewBox="0 0 16 10"
            refX="1"
            refY="5"
            markerWidth="16"
            markerHeight="10"
            orient="auto"
          >
            <path d="M1,5 L8,1 L15,5 L8,9 z" fill="var(--node-bg)" stroke="var(--node-border)" />
          </marker>
        </defs>

        {diagram.relationships.map((rel) => {
          const src = diagram.elements.find((e) => e.id === rel.sourceId);
          const tgt = diagram.elements.find((e) => e.id === rel.targetId);
          if (!src || !tgt) return null;
          const srcH = boxHeight(src);
          const tgtH = boxHeight(tgt);
          const sc = { x: src.x + BOX_W / 2, y: src.y + srcH / 2 };
          const tc = { x: tgt.x + BOX_W / 2, y: tgt.y + tgtH / 2 };
          const sp = borderPoint(sc.x, sc.y, srcH, tc.x, tc.y);
          const tp = borderPoint(tc.x, tc.y, tgtH, sc.x, sc.y);
          const markers = markerFor(rel.kind);
          const mid = { x: (sp.x + tp.x) / 2, y: (sp.y + tp.y) / 2 };
          const isSelected = selectedId === rel.id;
          return (
            <g
              key={rel.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectRelationship(rel.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <line
                x1={sp.x}
                y1={sp.y}
                x2={tp.x}
                y2={tp.y}
                stroke={isSelected ? 'var(--selection-color)' : 'var(--line-stroke)'}
                strokeWidth={isSelected ? 2.5 : 1.5}
                markerStart={markers.start}
                markerEnd={markers.end}
              />
              <line
                x1={sp.x}
                y1={sp.y}
                x2={tp.x}
                y2={tp.y}
                stroke="transparent"
                strokeWidth={12}
              />
              {rel.name && (
                <text
                  x={mid.x}
                  y={mid.y - 4}
                  textAnchor="middle"
                  className="fill-[var(--project-text-secondary)] text-[11px]"
                >
                  {rel.name}
                </text>
              )}
            </g>
          );
        })}

        {diagram.elements.map((el) => {
          const h = boxHeight(el);
          const dragging = drag && drag.id === el.id && drag.moved;
          const renderX = el.x + (dragging ? drag!.dx : 0);
          const renderY = el.y + (dragging ? drag!.dy : 0);
          const isSelected = selectedId === el.id;
          const isConnectSource = pendingConnectSource === el.id;
          const isLockedByOther = lockedIds.has(el.id);
          const attrH = Math.max(el.attributes.length, 1) * LINE_H + PAD * 2;
          return (
            <g
              key={el.id}
              transform={`translate(${renderX}, ${renderY})`}
              onPointerDown={(e) => handleClassPointerDown(e, el)}
              onClick={(e) => e.stopPropagation()}
              style={{
                cursor: isLockedByOther ? 'not-allowed' : 'move',
                opacity: isLockedByOther ? 0.55 : 1,
              }}
            >
              <rect
                width={BOX_W}
                height={h}
                fill="var(--node-bg)"
                stroke={isSelected || isConnectSource ? 'var(--selection-color)' : 'var(--node-border)'}
                strokeWidth={isSelected || isConnectSource ? 2.5 : 1.5}
              />
              {isLockedByOther && (
                <text
                  x={BOX_W - 10}
                  y={14}
                  textAnchor="end"
                  className="text-[12px] fill-[var(--node-text)]"
                >
                  🔒
                </text>
              )}
              <rect width={BOX_W} height={HEADER_H} fill="var(--node-header-bg)" />
              <text
                x={BOX_W / 2}
                y={HEADER_H - 6}
                textAnchor="middle"
                className="fill-[var(--node-text)] text-[12px] font-bold"
              >
                {el.name || '«unnamed»'}
              </text>
              <line x1={0} y1={HEADER_H} x2={BOX_W} y2={HEADER_H} stroke="var(--node-border)" />
              {el.attributes.map((a, i) => (
                <text
                  key={a.id}
                  x={PAD}
                  y={HEADER_H + PAD + 12 + i * LINE_H}
                  className="fill-[var(--node-text-sub)] text-[11px]"
                >
                  {a.name}
                  {a.type ? ` : ${a.type}` : ''}
                </text>
              ))}
              <line
                x1={0}
                y1={HEADER_H + attrH}
                x2={BOX_W}
                y2={HEADER_H + attrH}
                stroke="var(--node-border)"
              />
              {el.operations.map((o, i) => (
                <text
                  key={o.id}
                  x={PAD}
                  y={HEADER_H + attrH + PAD + 12 + i * LINE_H}
                  className="fill-[var(--node-text-sub)] text-[11px]"
                >
                  {o.name}
                  {o.returnType ? ` : ${o.returnType}` : ''}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
