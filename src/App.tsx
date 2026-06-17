import { useState, useCallback } from 'react';
import ChessBoard from './components/ChessBoard';
import CardPile from './components/CardPile';
import GameInfo from './components/GameInfo';
import { createInitialState, flipCard, placePiece, makeMove } from './gameState';
import type { GameState, Square } from './types';

function KnightLogo() {
  return (
    <svg viewBox="0 0 50 50" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 12 38 C 12 38 13 27 19 25 C 19 25 15 24 14 18 C 14 18 16 11 24 10 C 24 10 22 14 25 15 C 25 15 29 8 35 9 C 35 9 30 12 31 17 C 31 17 37 12 39 16 C 39 16 34 17 33 22 C 33 22 38 22 38 27 C 38 27 32 25 28 30 C 28 30 32 31 32 38 Z"
        fill="#629924"
        stroke="#4a7018"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="20" cy="17" rx="2" ry="2" fill="#1a2a08" />
    </svg>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(createInitialState);

  const handleNewGame = useCallback(() => setGame(createInitialState()), []);
  const handleFlipCard = useCallback(() => setGame(prev => flipCard(prev)), []);

  // Placement: fires from chessground's select event
  const handleSquareClick = useCallback((sq: Square) => {
    setGame(prev => {
      if (prev.gameOver) return prev;
      if (prev.cardFlipped && prev.legalPlacementSquares.includes(sq)) {
        return placePiece(prev, sq);
      }
      return prev;
    });
  }, []);

  // Move: fires from chessground's move event (click-click or drag-drop)
  const handleMove = useCallback((from: Square, to: Square) => {
    setGame(prev => makeMove(prev, from, to));
  }, []);

  const canWhiteFlip =
    game.turn === 'white' &&
    !game.cardFlipped &&
    game.turnMode !== 'must-move' &&
    game.whiteDecks.pile.length > 0 &&
    !game.gameOver;

  const canBlackFlip =
    game.turn === 'black' &&
    !game.cardFlipped &&
    game.turnMode !== 'must-move' &&
    game.blackDecks.pile.length > 0 &&
    !game.gameOver;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#161512', color: '#bababa' }}>

      {/* Header */}
      <header
        style={{ background: '#262422', borderBottom: '1px solid #3d3b38' }}
        className="flex items-center justify-between px-6 py-3"
      >
        <div className="flex items-center gap-3">
          <KnightLogo />
          <div>
            <span className="text-white font-bold text-lg tracking-wide">Raindrop Chess</span>
            <span
              className="ml-3 text-xs font-medium px-2 py-0.5 rounded"
              style={{ background: '#1e2a0f', color: '#629924', border: '1px solid #3a5a12' }}
            >
              hot seat
            </span>
          </div>
        </div>
        <span className="text-xs" style={{ color: '#6e6b67' }}>
          Powered by chessground &amp; chessops
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4 gap-6">

        {/* Black card pile */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-1 px-3 py-1 rounded"
            style={{
              color: game.turn === 'black' && !game.gameOver ? '#a8d060' : '#6e6b67',
              background: game.turn === 'black' && !game.gameOver ? '#1e2a0f' : 'transparent',
              border: game.turn === 'black' && !game.gameOver ? '1px solid #3a5a12' : '1px solid transparent',
            }}
          >
            ⬛ Black
          </div>
          <CardPile
            deck={game.blackDecks}
            color="black"
            isActive={game.turn === 'black' && !game.gameOver}
            canFlip={canBlackFlip}
            onFlipCard={handleFlipCard}
          />
        </div>

        {/* Board */}
        <div style={{ width: '100%', maxWidth: '560px', flexShrink: 0 }}>
          <ChessBoard
            state={game}
            onSquareClick={handleSquareClick}
            onMove={handleMove}
          />
        </div>

        {/* White card pile */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-xs font-bold uppercase tracking-widest mb-1 px-3 py-1 rounded"
            style={{
              color: game.turn === 'white' && !game.gameOver ? '#a8d060' : '#6e6b67',
              background: game.turn === 'white' && !game.gameOver ? '#1e2a0f' : 'transparent',
              border: game.turn === 'white' && !game.gameOver ? '1px solid #3a5a12' : '1px solid transparent',
            }}
          >
            ⬜ White
          </div>
          <CardPile
            deck={game.whiteDecks}
            color="white"
            isActive={game.turn === 'white' && !game.gameOver}
            canFlip={canWhiteFlip}
            onFlipCard={handleFlipCard}
          />
        </div>

        {/* Divider */}
        <div className="hidden md:block self-stretch w-px" style={{ background: '#3d3b38' }} />

        {/* Game info panel */}
        <GameInfo
          state={game}
          onNewGame={handleNewGame}
        />
      </main>
    </div>
  );
}
