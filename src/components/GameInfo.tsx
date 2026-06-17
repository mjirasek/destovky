import type { GameState, CardType } from '../types';

interface Props {
  state: GameState;
  onNewGame: () => void;
}

const CARD_NAMES: Record<CardType, string> = {
  king: 'King',
  queen: 'Queen',
  rook: 'Rook',
  knight: 'Knight',
  'bishop-light': 'Light-sq. Bishop',
  'bishop-dark': 'Dark-sq. Bishop',
  pawn: 'Pawn',
};

export default function GameInfo({ state, onNewGame }: Props) {
  const { turn, turnMode, cardFlipped, gameOver, winner, inCheck, whiteDecks, blackDecks } = state;
  const myDeck = turn === 'white' ? whiteDecks : blackDecks;
  const hasCards = myDeck.pile.length > 0;
  const turnLabel = turn === 'white' ? 'White' : 'Black';

  let hint: React.ReactNode = null;
  if (!gameOver) {
    if (turnMode === 'must-place') {
      hint = cardFlipped
        ? <>Place the <strong style={{ color: '#a8d060' }}>{myDeck.revealed ? CARD_NAMES[myDeck.revealed.type] : ''}</strong> on a green square</>
        : 'Click your deck to flip a card';
    } else if (turnMode === 'choose') {
      if (cardFlipped) {
        hint = <>Place the <strong style={{ color: '#a8d060' }}>{myDeck.revealed ? CARD_NAMES[myDeck.revealed.type] : ''}</strong> on a green square</>;
      } else if (hasCards) {
        hint = 'Flip your deck — or click any piece to move';
      } else {
        hint = 'Deck empty — click a piece to move';
      }
    } else if (turnMode === 'must-move') {
      hint = cardFlipped
        ? <>Block check: place the <strong style={{ color: '#a8d060' }}>{myDeck.revealed ? CARD_NAMES[myDeck.revealed.type] : ''}</strong> on a green square</>
        : <span style={{ color: '#ff9944' }}>In check — click a piece to move</span>;
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm min-w-[170px]">

      {/* Game over */}
      {gameOver && (
        <div className="rounded-xl p-4 text-center" style={{ background: '#1e2a0f', border: '1px solid #629924' }}>
          <div className="text-xl font-bold mb-1" style={{ color: '#a8d060' }}>
            {winner === 'white' ? '⬜ White wins!' : '⬛ Black wins!'}
          </div>
          <div className="text-xs" style={{ color: '#7a9a40' }}>Checkmate</div>
        </div>
      )}

      {/* Check warning */}
      {!gameOver && inCheck && (
        <div className="rounded-lg p-2 text-center" style={{ background: '#2a0a0a', border: '1px solid #cc3333' }}>
          <span className="font-bold text-xs tracking-wide" style={{ color: '#ff5555' }}>
            ⚠ {turnLabel} in check!
          </span>
        </div>
      )}

      {/* Turn indicator */}
      {!gameOver && (
        <div className="rounded-lg p-3" style={{ background: '#262422', border: '1px solid #3d3b38' }}>
          <div className="flex items-center gap-2 justify-center mb-2">
            <span
              className="w-3 h-3 rounded-full border-2 flex-shrink-0"
              style={{
                background: turn === 'white' ? '#f0d9b5' : '#2a1a0e',
                borderColor: turn === 'white' ? '#b58863' : '#9a7050',
              }}
            />
            <span className="font-bold text-sm" style={{ color: '#e0dbd4' }}>{turnLabel}'s turn</span>
          </div>
          <p className="text-center leading-snug" style={{ fontSize: '11px', color: '#6e6b67' }}>
            {hint}
          </p>
        </div>
      )}

      {/* New game */}
      <button
        onClick={onNewGame}
        className="w-full py-2 px-3 rounded-lg font-semibold transition-colors"
        style={{ fontSize: '12px', background: '#262422', color: '#9e9b96', border: '1px solid #3d3b38' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#302e2c')}
        onMouseLeave={e => (e.currentTarget.style.background = '#262422')}
      >
        New Game
      </button>
    </div>
  );
}
