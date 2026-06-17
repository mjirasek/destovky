import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key, Piece as CGLibPiece } from 'chessground/types';
import { squareToCgKey, cgKeyToSquare } from '../chessEngine';
import type { GameState, Color, Square } from '../types';

interface Props {
  state: GameState;
  onSquareClick: (sq: Square) => void;
  onMove: (from: Square, to: Square) => void;
  /** False when viewing history or promotion pending — disables all board interaction */
  interactive: boolean;
}

function buildCGPieces(board: Map<Square, { role: string; color: Color }>): Map<Key, CGLibPiece> {
  const map = new Map<Key, CGLibPiece>();
  for (const [sq, piece] of board) {
    map.set(squareToCgKey(sq) as Key, { role: piece.role as any, color: piece.color });
  }
  return map;
}

function buildDests(legalMoves: Map<Square, Square[]>): Map<Key, Key[]> {
  const dests = new Map<Key, Key[]>();
  for (const [from, tos] of legalMoves) {
    dests.set(squareToCgKey(from) as Key, tos.map(t => squareToCgKey(t) as Key));
  }
  return dests;
}

export default function ChessBoard({ state, onSquareClick, onMove, interactive }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  const onSquareClickRef = useRef(onSquareClick);
  onSquareClickRef.current = onSquareClick;

  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const cg = Chessground(el, {
      fen: '8/8/8/8/8/8/8/8',
      orientation: 'white',
      coordinates: true,
      movable: { free: false, showDests: false, color: undefined },
      selectable: { enabled: false },
      draggable: { enabled: false },
      premovable: { enabled: false },
      events: {
        select: (key: Key) => onSquareClickRef.current(cgKeyToSquare(key)),
        move: (from: Key, to: Key) => onMoveRef.current(cgKeyToSquare(from), cgKeyToSquare(to)),
      },
    });
    cgRef.current = cg;

    const raf = requestAnimationFrame(() => cg.redrawAll());
    const ro = new ResizeObserver(() => cg.redrawAll());
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cg.destroy();
      cgRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cg = cgRef.current;
    if (!cg) return;

    const isPlacing = interactive && state.cardFlipped && !state.gameOver;
    const isMoving =
      interactive &&
      !state.pendingPromotion &&
      (state.turnMode === 'choose' || state.turnMode === 'must-move') &&
      !state.cardFlipped &&
      !state.gameOver;

    const customHighlights = new Map<Key, Set<string>>();
    if (isPlacing) {
      for (const sq of state.legalPlacementSquares) {
        customHighlights.set(squareToCgKey(sq) as Key, new Set(['move-dest']));
      }
    }

    const config: Config = {
      check: state.inCheck ? (state.turn as any) : undefined,
      turnColor: state.turn,
      movable: {
        free: false,
        color: isMoving ? state.turn : undefined,
        dests: isMoving ? buildDests(state.legalMoves) : new Map(),
        showDests: isMoving,
      },
      selectable: { enabled: isPlacing || isMoving },
      highlight: {
        lastMove: false,
        check: true,
        custom: customHighlights as any,
      },
      draggable: { enabled: isMoving },
    };

    cg.set(config);
    // Clear any in-progress selection when leaving move mode
    if (!isMoving) cg.cancelMove();

    // Diff-update pieces
    const desired = buildCGPieces(state.board);
    const current = cg.state.pieces;
    const allKeys = new Set([...current.keys(), ...desired.keys()]);
    const diff = new Map<Key, CGLibPiece | undefined>();
    for (const key of allKeys) {
      const cur = current.get(key);
      const des = desired.get(key);
      if (JSON.stringify(cur) !== JSON.stringify(des)) diff.set(key, des);
    }
    if (diff.size > 0) cg.setPieces(diff as any);
  }, [state, interactive]);

  return (
    <div
      ref={containerRef}
      className="cg-wrap"
      style={{ width: '100%', aspectRatio: '1 / 1', display: 'block' }}
    />
  );
}
