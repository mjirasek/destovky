import { describe, expect, it } from 'vitest';
import { cgKeyToSquare } from './chessEngine';
import { availablePromotionRoles, completePromotion, createInitialState, legalMovesForState } from './gameState';
import type { GameState, PromotionRole } from './types';

function stateWithPromotionUsage(used: PromotionRole[]): GameState {
  return {
    ...createInitialState(),
    board: new Map([
      [cgKeyToSquare('e1'), { role: 'king', color: 'white' }],
      [cgKeyToSquare('h8'), { role: 'king', color: 'black' }],
      [cgKeyToSquare('a7'), { role: 'pawn', color: 'white' }],
    ]),
    whiteKingPlaced: true,
    blackKingPlaced: true,
    promotionCounts: { white: used.length, black: 0 },
    promotionRolesUsed: { white: used, black: [] },
    turn: 'white',
  };
}

describe('promotion role limits', () => {
  it('allows each promotion role only once per side', () => {
    const to = cgKeyToSquare('a8');
    const state: GameState = {
      ...stateWithPromotionUsage(['queen']),
      board: new Map([[to, { role: 'pawn', color: 'white' }]]),
      pendingPromotion: { from: cgKeyToSquare('a7'), to },
    };

    expect(availablePromotionRoles(state, 'white')).toEqual(['rook', 'bishop', 'knight']);
    expect(completePromotion(state, 'queen')).toBe(state);

    const promoted = completePromotion(state, 'rook');
    expect(promoted.board.get(to)?.role).toBe('rook');
    expect(promoted.promotionRolesUsed.white).toEqual(['queen', 'rook']);
  });

  it('removes back-rank pawn moves after all promotion roles are used', () => {
    const state = stateWithPromotionUsage(['queen', 'rook', 'bishop', 'knight']);
    const moves = legalMovesForState(state, 'white');

    expect(moves.get(cgKeyToSquare('a7')) ?? []).not.toContain(cgKeyToSquare('a8'));
  });
});
