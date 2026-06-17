/**
 * Raindrop Chess game state manager.
 * Keeps all mutable state immutable-style (returns new state objects).
 */

import { createDeck } from './deck';
import {
  legalPlacementSquares,
  legalChessMoves,
  isInCheck,
} from './chessEngine';
import type { GameState, Color, CGPiece, Square, TurnMode, Deck } from './types';

function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

function makeDeck(): Deck {
  return { pile: createDeck(), revealed: null };
}

// ── Initial state ─────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    board: new Map(),
    whiteDecks: makeDeck(),
    blackDecks: makeDeck(),
    turn: 'white',
    turnMode: 'must-place',
    cardFlipped: false,
    whiteKingPlaced: false,
    blackKingPlaced: false,
    legalPlacementSquares: [],
    legalMoves: new Map(),
    inCheck: false,
    gameOver: false,
    winner: null,
  };
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * Flip the top card of the current player's deck.
 * Returns new state with the revealed card.
 */
export function flipCard(state: GameState): GameState {
  if (state.cardFlipped || state.gameOver) return state;

  const deckKey = state.turn === 'white' ? 'whiteDecks' : 'blackDecks';
  const deck = state[deckKey];

  if (deck.pile.length === 0) return state;

  const [top, ...rest] = deck.pile;
  const newDeck: Deck = { pile: rest, revealed: top };
  const placementSquares = legalPlacementSquares(top.type, state.turn, state.board);

  return {
    ...state,
    [deckKey]: newDeck,
    cardFlipped: true,
    legalPlacementSquares: placementSquares,
  };
}

/**
 * Place the revealed card on `square`.
 */
export function placePiece(state: GameState, square: Square): GameState {
  if (state.gameOver) return state;
  if (!state.legalPlacementSquares.includes(square)) return state;

  const deckKey = state.turn === 'white' ? 'whiteDecks' : 'blackDecks';
  const deck = state[deckKey];
  if (!deck.revealed) return state;

  const card = deck.revealed;

  // Map card type to CGRole
  const role: CGPiece['role'] =
    card.type === 'bishop-light' || card.type === 'bishop-dark'
      ? 'bishop'
      : card.type;

  const newBoard = new Map(state.board);
  newBoard.set(square, { role, color: state.turn });

  const newDeck: Deck = { ...deck, revealed: null };

  const whiteKingPlaced =
    state.turn === 'white' && card.type === 'king' ? true : state.whiteKingPlaced;
  const blackKingPlaced =
    state.turn === 'black' && card.type === 'king' ? true : state.blackKingPlaced;

  const nextTurn = opposite(state.turn);

  let newState: GameState = {
    ...state,
    board: newBoard,
    [deckKey]: newDeck,
    turn: nextTurn,
    cardFlipped: false,
    whiteKingPlaced,
    blackKingPlaced,
    legalPlacementSquares: [],
    legalMoves: new Map(),
  };

  return resolveNextTurn(newState);
}

/**
 * Make a chess move (from → to).
 */
export function makeMove(state: GameState, from: Square, to: Square): GameState {
  if (state.gameOver) return state;

  const legal = state.legalMoves.get(from);
  if (!legal || !legal.includes(to)) return state;

  const newBoard = new Map(state.board);
  const piece = newBoard.get(from)!;
  newBoard.delete(from);
  newBoard.set(to, piece);

  // Pawn promotion: auto-promote to queen when reaching back rank
  const rank = to >> 3;
  if (piece.role === 'pawn') {
    if ((piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0)) {
      newBoard.set(to, { ...piece, role: 'queen' });
    }
  }

  const nextTurn = opposite(state.turn);
  let newState: GameState = {
    ...state,
    board: newBoard,
    turn: nextTurn,
    cardFlipped: false,
    legalPlacementSquares: [],
    legalMoves: new Map(),
  };

  return resolveNextTurn(newState);
}

// ── Internal ──────────────────────────────────────────────────────────────────

function resolveNextTurn(state: GameState): GameState {
  const { turn } = state;
  const myKingPlaced = turn === 'white' ? state.whiteKingPlaced : state.blackKingPlaced;

  const inCheck = isInCheck(turn, state.board);
  const legalMoves = myKingPlaced
    ? legalChessMoves(turn, state.board)
    : new Map<Square, Square[]>();

  // Check for checkmate
  if (myKingPlaced && inCheck) {
    const hasMoves = legalMoves.size > 0;
    const myDeckKey = turn === 'white' ? 'whiteDecks' : 'blackDecks';
    const myDeck = state[myDeckKey];
    const hasCardsLeft = myDeck.pile.length > 0;

    // Can any placement resolve the check?
    let canPlaceToResolve = false;
    if (hasCardsLeft) {
      // Try each card type remaining in deck to see if any placement can resolve check
      const uniqueTypes = new Set(myDeck.pile.map(c => c.type));
      for (const cardType of uniqueTypes) {
        const squares = legalPlacementSquares(cardType, turn, state.board);
        for (const sq of squares) {
          const testBoard = new Map(state.board);
          const role: CGPiece['role'] = cardType === 'bishop-light' || cardType === 'bishop-dark' ? 'bishop' : (cardType as CGPiece['role']);
          testBoard.set(sq, { role, color: turn });
          if (!isInCheck(turn, testBoard)) {
            canPlaceToResolve = true;
            break;
          }
        }
        if (canPlaceToResolve) break;
      }
    }

    if (!hasMoves && !canPlaceToResolve) {
      return {
        ...state,
        inCheck: true,
        legalMoves,
        legalPlacementSquares: [],
        gameOver: true,
        winner: opposite(turn),
        turnMode: 'must-move',
      };
    }
  }

  let turnMode: TurnMode;
  if (!myKingPlaced) {
    turnMode = 'must-place';
  } else if (inCheck) {
    turnMode = 'must-move';
  } else {
    turnMode = 'choose';
  }

  return { ...state, inCheck, legalMoves, legalPlacementSquares: [], turnMode };
}
