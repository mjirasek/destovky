import type { Deck, Color, CardType } from '../types';

interface Props {
  deck: Deck;
  color: Color;
  isActive: boolean;
  canFlip: boolean;
  onFlipCard: () => void;
}

const CARD_SYMBOLS: Record<CardType, string> = {
  king: '♚',
  queen: '♛',
  rook: '♜',
  knight: '♞',
  'bishop-light': '♝',
  'bishop-dark': '♝',
  pawn: '♟',
};

const CARD_NAMES: Record<CardType, string> = {
  king: 'King',
  queen: 'Queen',
  rook: 'Rook',
  knight: 'Knight',
  'bishop-light': 'Bishop',
  'bishop-dark': 'Bishop',
  pawn: 'Pawn',
};

const CARD_SUBTITLES: Record<CardType, string> = {
  king: '',
  queen: '',
  rook: '',
  knight: '',
  'bishop-light': '☀ light sq.',
  'bishop-dark': '☾ dark sq.',
  pawn: '',
};

export default function CardPile({ deck, color, isActive, canFlip, onFlipCard }: Props) {
  const remaining = deck.pile.length;
  const revealed = deck.revealed;
  const isWhite = color === 'white';

  const handleDeckClick = () => {
    if (canFlip) onFlipCard();
  };

  // Piece symbol color: white pieces are light, black pieces dark (with outline)
  const symbolClass = isWhite
    ? 'text-[#f0d9b5]'
    : 'text-[#2a1a0e] [text-shadow:_0_0_3px_rgba(255,255,255,0.6)]';

  return (
    <div className={`flex flex-col items-center gap-4 ${isWhite ? '' : 'flex-col-reverse'}`}>

      {/* Revealed / face-up card */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-widest text-[#6e6b67] font-semibold">
          Drawn
        </span>
        {revealed ? (
          <div
            className={`
              w-[72px] h-[100px] rounded-lg flex flex-col items-center justify-center gap-1
              border-2 select-none
              ${isActive
                ? 'border-[#629924] bg-[#1e2a0f] shadow-[0_0_14px_rgba(98,153,36,0.4)]'
                : 'border-[#3d3b38] bg-[#262422]'}
            `}
          >
            <span className={`text-4xl leading-none mt-1 ${symbolClass}`}>
              {CARD_SYMBOLS[revealed.type]}
            </span>
            <span className="text-[11px] text-[#c0b9b0] font-semibold mt-1">
              {CARD_NAMES[revealed.type]}
            </span>
            {CARD_SUBTITLES[revealed.type] && (
              <span className="text-[9px] text-[#6e6b67] leading-tight text-center px-1">
                {CARD_SUBTITLES[revealed.type]}
              </span>
            )}
          </div>
        ) : (
          <div className="w-[72px] h-[100px] rounded-lg border-2 border-dashed border-[#3d3b38] bg-[#1a1816] flex items-center justify-center">
            <span className="text-[#4a4744] text-[10px] text-center leading-tight px-1">
              No card
            </span>
          </div>
        )}
      </div>

      {/* Face-down deck — click to flip */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-widest text-[#6e6b67] font-semibold">
          Deck
        </span>
        <div
          className={`w-[72px] h-[100px] relative select-none ${canFlip ? 'deck-clickable' : ''}`}
          onClick={handleDeckClick}
          title={canFlip ? 'Click to flip a card' : undefined}
        >
          {remaining > 0 ? (
            <>
              {/* Stack shadow layers */}
              {remaining > 2 && (
                <div className="absolute top-2 left-2 w-full h-full rounded-lg bg-[#1a1816] border border-[#3d3b38]" />
              )}
              {remaining > 1 && (
                <div className="absolute top-1 left-1 w-full h-full rounded-lg bg-[#222018] border border-[#3d3b38]" />
              )}
              {/* Top card (face-down) */}
              <div
                className={`
                  absolute inset-0 rounded-lg border-2 flex flex-col items-center justify-center gap-1
                  bg-gradient-to-br from-[#2c2926] to-[#1a1816]
                  ${canFlip
                    ? 'border-[#629924]'
                    : isActive
                      ? 'border-[#4a6020]'
                      : 'border-[#3d3b38]'}
                `}
              >
                {/* Knight watermark */}
                <span className="text-[36px] leading-none text-[#3a3530] select-none pointer-events-none">
                  ♞
                </span>
                <span className={`text-[11px] font-bold leading-none ${canFlip ? 'text-[#629924]' : 'text-[#4a4744]'}`}>
                  {remaining}
                </span>
                {canFlip && (
                  <span className="text-[9px] text-[#629924] opacity-80 leading-none">flip</span>
                )}
              </div>
            </>
          ) : (
            <div className="absolute inset-0 rounded-lg border-2 border-dashed border-[#3d3b38] bg-[#1a1816] flex items-center justify-center">
              <span className="text-[#4a4744] text-[10px]">Empty</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
