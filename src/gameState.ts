import { createDeck } from './deck';
import { legalPlacementSquares, legalChessMoves, isInCheck } from './chessEngine';
import type { GameState, Color, CGPiece, CGRole, Square, TurnMode, Deck } from './types';

function opposite(c: Color): Color {
  return c === 'white' ? 'black' : 'white';
}

function makeDeck(): Deck {
  return { pile: createDeck(), revealed: null };
}

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
    pendingPromotion: null,
  };
}

export function flipCard(state: GameState): GameState {
  if (state.cardFlipped || state.gameOver) return state;
  const deckKey = state.turn === 'white' ? 'whiteDecks' : 'blackDecks';
  const deck = state[deckKey];
  if (deck.pile.length === 0) return state;
  const [top, ...rest] = deck.pile;
  const placementSquares = legalPlacementSquares(top.type, state.turn, state.board);
  return {
    ...state,
    [deckKey]: { pile: rest, revealed: top },
    cardFlipped: true,
    legalPlacementSquares: placementSquares,
  };
}

export function placePiece(state: GameState, square: Square): GameState {
  if (state.gameOver) return state;
  if (!state.legalPlacementSquares.includes(square)) return state;
  const deckKey = state.turn === 'white' ? 'whiteDecks' : 'blackDecks';
  const deck = state[deckKey];
  if (!deck.revealed) return state;
  const card = deck.revealed;
  const role: CGPiece['role'] =
    card.type === 'bishop-light' || card.type === 'bishop-dark' ? 'bishop' : card.type;
  const newBoard = new Map(state.board);
  newBoard.set(square, { role, color: state.turn });
  const whiteKingPlaced = state.turn === 'white' && card.type === 'king' ? true : state.whiteKingPlaced;
  const blackKingPlaced = state.turn === 'black' && card.type === 'king' ? true : state.blackKingPlaced;
  return resolveNextTurn({
    ...state,
    board: newBoard,
    [deckKey]: { ...deck, revealed: null },
    turn: opposite(state.turn),
    cardFlipped: false,
    whiteKingPlaced,
    blackKingPlaced,
    legalPlacementSquares: [],
    legalMoves: new Map(),
    pendingPromotion: null,
  });
}

export function makeMove(state: GameState, from: Square, to: Square): GameState {
  if (state.gameOver) return state;
  const legal = state.legalMoves.get(from);
  if (!legal || !legal.includes(to)) return state;
  const newBoard = new Map(state.board);
  const piece = newBoard.get(from)!;
  newBoard.delete(from);
  newBoard.set(to, piece);
  const rank = to >> 3;
  // Pawn reaches back rank — pause for promotion choice
  if (
    piece.role === 'pawn' &&
    ((piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0))
  ) {
    return {
      ...state,
      board: newBoard,
      cardFlipped: false,
      legalPlacementSquares: [],
      legalMoves: new Map(),
      pendingPromotion: { from, to },
    };
  }
  return resolveNextTurn({
    ...state,
    board: newBoard,
    turn: opposite(state.turn),
    cardFlipped: false,
    legalPlacementSquares: [],
    legalMoves: new Map(),
    pendingPromotion: null,
  });
}

export function completePromotion(state: GameState, role: CGRole): GameState {
  if (!state.pendingPromotion) return state;
  const { to } = state.pendingPromotion;
  const newBoard = new Map(state.board);
  const piece = newBoard.get(to);
  if (!piece) return state;
  newBoard.set(to, { ...piece, role });
  return resolveNextTurn({
    ...state,
    board: newBoard,
    turn: opposite(state.turn),
    pendingPromotion: null,
    cardFlipped: false,
    legalPlacementSquares: [],
    legalMoves: new Map(),
  });
}

function resolveNextTurn(state: GameState): GameState {
  const { turn } = state;
  const myKingPlaced = turn === 'white' ? state.whiteKingPlaced : state.blackKingPlaced;
  const inCheck = isInCheck(turn, state.board);
  const legalMoves = myKingPlaced ? legalChessMoves(turn, state.board) : new Map<Square, Square[]>();

  if (myKingPlaced && inCheck) {
    const hasMoves = legalMoves.size > 0;
    const myDeck = turn === 'white' ? state.whiteDecks : state.blackDecks;
    let canPlaceToResolve = false;
    if (myDeck.pile.length > 0) {
      for (const cardType of new Set(myDeck.pile.map(c => c.type))) {
        for (const sq of legalPlacementSquares(cardType, turn, state.board)) {
          const testBoard = new Map(state.board);
          const role: CGPiece['role'] =
            cardType === 'bishop-light' || cardType === 'bishop-dark' ? 'bishop' : (cardType as CGPiece['role']);
          testBoard.set(sq, { role, color: turn });
          if (!isInCheck(turn, testBoard)) { canPlaceToResolve = true; break; }
        }
        if (canPlaceToResolve) break;
      }
    }
    if (!hasMoves && !canPlaceToResolve) {
      return { ...state, inCheck: true, legalMoves, legalPlacementSquares: [], gameOver: true, winner: opposite(turn), turnMode: 'must-move', pendingPromotion: null };
    }
  }

  const turnMode: TurnMode = !myKingPlaced ? 'must-place' : inCheck ? 'must-move' : 'choose';
  return { ...state, inCheck, legalMoves, legalPlacementSquares: [], turnMode, pendingPromotion: null };
}
