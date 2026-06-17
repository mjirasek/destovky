import { useEffect, useRef } from 'react';

interface Props {
  notations: string[];   // flat list: [white1, black1, white2, black2, ...]
  cursor: number;        // current position (0 = initial, 1 = after first half-move, etc.)
  onBack: () => void;
  onForward: () => void;
}

export default function MoveList({ notations, cursor, onBack, onForward }: Props) {
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cursor]);

  // Pair up into move rows: [[white, black?], ...]
  const rows: Array<{ n: number; white: string; black?: string }> = [];
  for (let i = 0; i < notations.length; i += 2) {
    rows.push({ n: Math.floor(i / 2) + 1, white: notations[i], black: notations[i + 1] });
  }

  const canBack = cursor > 0;
  const canForward = cursor < notations.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[
          { label: '⟨⟨', action: () => onBack(), disabled: !canBack, title: 'Back' },
          { label: '⟩⟩', action: () => onForward(), disabled: !canForward, title: 'Forward' },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            disabled={btn.disabled}
            title={btn.title}
            style={{
              flex: 1, padding: '5px', borderRadius: '6px',
              fontSize: '14px', fontWeight: 700, cursor: btn.disabled ? 'default' : 'pointer',
              background: btn.disabled ? '#1a1816' : '#262422',
              color: btn.disabled ? '#3d3b38' : '#9e9b96',
              border: `1px solid ${btn.disabled ? '#2a2826' : '#3d3b38'}`,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!btn.disabled) e.currentTarget.style.background = '#302e2c'; }}
            onMouseLeave={e => { if (!btn.disabled) e.currentTarget.style.background = '#262422'; }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Move list */}
      <div
        style={{
          background: '#1a1816', border: '1px solid #3d3b38', borderRadius: '8px',
          padding: '6px 4px', maxHeight: '220px', overflowY: 'auto',
          fontSize: '11px', fontFamily: 'monospace',
        }}
      >
        {rows.length === 0 && (
          <div style={{ color: '#4a4744', textAlign: 'center', padding: '12px 0' }}>No moves yet</div>
        )}
        {rows.map(row => {
          // cursor positions: white of row n = index 2*(n-1)+1, black = 2*(n-1)+2
          const whiteIdx = (row.n - 1) * 2 + 1;
          const blackIdx = (row.n - 1) * 2 + 2;
          const whiteActive = cursor === whiteIdx;
          const blackActive = cursor === blackIdx;

          return (
            <div
              key={row.n}
              style={{
                display: 'grid', gridTemplateColumns: '24px 1fr 1fr',
                padding: '2px 6px', borderRadius: '4px',
                background: (whiteActive || blackActive) ? '#1e2a0f' : 'transparent',
              }}
            >
              <span style={{ color: '#4a4744' }}>{row.n}.</span>
              <span
                ref={whiteActive ? activeRef : undefined}
                style={{ color: whiteActive ? '#a8d060' : '#9e9b96', padding: '0 2px' }}
              >
                {row.white}
              </span>
              <span
                ref={blackActive ? activeRef : undefined}
                style={{ color: blackActive ? '#a8d060' : '#9e9b96', padding: '0 2px' }}
              >
                {row.black ?? ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
