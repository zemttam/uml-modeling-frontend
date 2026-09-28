'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';
import {
  DIAGRAM_EVENT,
  DiagramDocument,
  DiagramOp,
  emptyDiagram,
} from './diagram-types';
import { applyOp } from './diagram-reducer';

export interface ProjectSocket {
  diagram: DiagramDocument;
  presence: number;
  connected: boolean;
  /** true when the last connection attempt failed (e.g. missing/invalid token) */
  connectError: boolean;
  sendOp: (op: DiagramOp) => void;
  forceSave: () => void;
  /** element ids locked by other users (own lock excluded) */
  lockedIds: Set<string>;
  /** element id currently locked by this user, if any */
  heldLockId: string | null;
  /** request the lock; releases any previously held lock first */
  lockElement: (id: string) => void;
  /** release the lock on an element */
  unlockElement: (id: string) => void;
}

// Connects to the backend diagrams Socket.IO namespace with the session
// JWT in the connection auth payload, joins the project room, applies
// inbound ops to local state, emits local ops, tracks live presence,
// and exposes a force-save method. Also manages per-element session
// locks: optimistic acquire, denial handling, and tracking of which
// locks other users hold. Reconnects when projectId changes.
export function useProjectSocket(
  projectId: string,
  onLockDenied?: (elementId: string) => void,
  onStateReset?: () => void,
): ProjectSocket {
  const [diagram, setDiagram] = useState<DiagramDocument>(emptyDiagram);
  const [presence, setPresence] = useState(0);
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState(false);
  const [allLocked, setAllLocked] = useState<Set<string>>(new Set());
  const [heldLockId, setHeldLockId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const heldLockRef = useRef<string | null>(null);
  const deniedCbRef = useRef(onLockDenied);
  const stateResetCbRef = useRef(onStateReset);
  // Serialized local ops awaiting their own server echo. The gateway
  // broadcasts every op to the whole room including the sender; re-applying
  // an echo here could clobber newer local state (e.g. a stale upsert
  // landing mid-typing wipes the characters typed since). Echos of our own
  // ops are no-ops — they were applied optimistically at emit time — so we
  // skip them and only apply ops from other sessions.
  const pendingEchoes = useRef<string[]>([]);
  deniedCbRef.current = onLockDenied;
  stateResetCbRef.current = onStateReset;

  useEffect(() => {
    const socket = io(`${API_URL}/diagrams`, {
      auth: { token: getToken() },
      transports: ['polling', 'websocket'],
    });
    socketRef.current = socket;
    setAllLocked(new Set());
    setHeldLockId(null);
    heldLockRef.current = null;
    pendingEchoes.current = [];

    socket.on('connect', () => {
      setConnected(true);
      setConnectError(false);
      socket.emit(DIAGRAM_EVENT.JOIN, { projectId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setConnectError(true);
    });
    socket.on(DIAGRAM_EVENT.STATE, (doc: DiagramDocument) => {
      // STATE is the authoritative full document: on join and on a
      // replace-in-place import it is a full reset. Drop any pending echo
      // queue, all element-lock state, and the local undo/redo history so no
      // stale op can survive the replacement (imports are not undoable).
      pendingEchoes.current = [];
      setAllLocked(new Set());
      setHeldLockId(null);
      heldLockRef.current = null;
      setDiagram(doc ?? emptyDiagram());
      stateResetCbRef.current?.();
    });
    socket.on(DIAGRAM_EVENT.OP, (op: DiagramOp) => {
      const serialized = JSON.stringify(op);
      const idx = pendingEchoes.current.indexOf(serialized);
      if (idx >= 0) {
        // own echo: drop it, the op was already applied optimistically
        pendingEchoes.current.splice(idx, 1);
        return;
      }
      setDiagram((prev) => applyOp(prev, op));
    });
    socket.on(DIAGRAM_EVENT.PRESENCE_COUNT, (payload: { count: number }) => {
      setPresence(payload?.count ?? 0);
    });
    socket.on(DIAGRAM_EVENT.ELEMENT_LOCKED, (payload: { elementId: string }) => {
      const elementId = payload?.elementId;
      if (!elementId) return;
      setAllLocked((prev) => {
        if (prev.has(elementId)) return prev;
        const next = new Set(prev);
        next.add(elementId);
        return next;
      });
    });
    socket.on(
      DIAGRAM_EVENT.ELEMENT_UNLOCKED,
      (payload: { elementId: string }) => {
        const elementId = payload?.elementId;
        if (!elementId) return;
        setAllLocked((prev) => {
          if (!prev.has(elementId)) return prev;
          const next = new Set(prev);
          next.delete(elementId);
          return next;
        });
        if (heldLockRef.current === elementId) {
          heldLockRef.current = null;
          setHeldLockId(null);
        }
      },
    );
    socket.on(
      DIAGRAM_EVENT.ELEMENT_LOCK_DENIED,
      (payload: { elementId: string }) => {
        const elementId = payload?.elementId;
        if (!elementId) return;
        // lost the race: revert optimistic ownership and treat as locked
        if (heldLockRef.current === elementId) {
          heldLockRef.current = null;
          setHeldLockId(null);
        }
        setAllLocked((prev) => {
          const next = new Set(prev);
          next.add(elementId);
          return next;
        });
        deniedCbRef.current?.(elementId);
      },
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectError(false);
      setPresence(0);
      setAllLocked(new Set());
      setHeldLockId(null);
      heldLockRef.current = null;
      pendingEchoes.current = [];
    };
  }, [projectId]);

  // locks held by this user never appear as "locked by others"
  const lockedIds = useMemo(() => {
    const next = new Set(allLocked);
    if (heldLockId) {
      next.delete(heldLockId);
    }
    return next;
  }, [allLocked, heldLockId]);

  const lockElement = useCallback((id: string) => {
    const previous = heldLockRef.current;
    if (previous === id) {
      return; // already holding it (idempotent)
    }
    if (previous) {
      // at most one held lock: release the previous one first
      socketRef.current?.emit(DIAGRAM_EVENT.ELEMENT_UNLOCK, {
        elementId: previous,
      });
    }
    heldLockRef.current = id;
    setHeldLockId(id);
    socketRef.current?.emit(DIAGRAM_EVENT.ELEMENT_LOCK, { elementId: id });
  }, []);

  const unlockElement = useCallback((id: string) => {
    if (heldLockRef.current === id) {
      heldLockRef.current = null;
      setHeldLockId(null);
    }
    socketRef.current?.emit(DIAGRAM_EVENT.ELEMENT_UNLOCK, { elementId: id });
  }, []);

  const sendOp = useCallback((op: DiagramOp) => {
    pendingEchoes.current.push(JSON.stringify(op));
    if (pendingEchoes.current.length > 200) {
      pendingEchoes.current.shift();
    }
    // Optimistic local apply (idempotent on the server echo).
    setDiagram((prev) => applyOp(prev, op));
    socketRef.current?.emit(DIAGRAM_EVENT.OP, op);
  }, []);

  const forceSave = useCallback(() => {
    socketRef.current?.emit(DIAGRAM_EVENT.SAVE_REQUEST);
  }, []);

  return {
    diagram,
    presence,
    connected,
    connectError,
    sendOp,
    forceSave,
    lockedIds,
    heldLockId,
    lockElement,
    unlockElement,
  };
}
