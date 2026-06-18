import type { Color, PromotionRole } from '../types';

interface Props {
  color: Color;
  usedRoles: PromotionRole[];
  onSelect: (role: PromotionRole) => void;
}

const CHOICES: PromotionRole[] = ['queen', 'rook', 'bishop', 'knight'];

export default function PromotionDialog({ color, usedRoles, onSelect }: Props) {
  const used = new Set(usedRoles);

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: '#262422', border: '2px solid #629924',
          borderRadius: '12px', padding: '20px 24px', textAlign: 'center',
        }}
      >
        <div style={{ color: '#a8d060', fontWeight: 700, fontSize: '13px', marginBottom: '14px', letterSpacing: '0.05em' }}>
          PAWN PROMOTION
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {CHOICES.map(role => {
            const disabled = used.has(role);
            return (
              <button
                key={role}
                disabled={disabled}
                onClick={() => onSelect(role)}
                style={{
                  width: '60px', height: '72px',
                  background: disabled ? '#141311' : '#1a1816',
                  border: `2px solid ${disabled ? '#2a2825' : '#3d3b38'}`,
                  borderRadius: '8px',
                  cursor: disabled ? 'default' : 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '4px',
                  position: 'relative',
                  opacity: disabled ? 0.45 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  if (disabled) return;
                  e.currentTarget.style.borderColor = '#629924';
                  e.currentTarget.style.background = '#1e2a0f';
                }}
                onMouseLeave={e => {
                  if (disabled) return;
                  e.currentTarget.style.borderColor = '#3d3b38';
                  e.currentTarget.style.background = '#1a1816';
                }}
              >
                <span
                  className="cg-wrap promotion-piece-icon"
                  dangerouslySetInnerHTML={{ __html: `<piece class="${role} ${color}" aria-hidden="true"></piece>` }}
                />
                <span style={{ fontSize: '9px', color: '#6e6b67', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {role}
                </span>
                {disabled && <span style={disabledSlashStyle} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const disabledSlashStyle: React.CSSProperties = {
  position: 'absolute',
  left: '10px',
  right: '10px',
  top: '50%',
  height: '2px',
  background: '#b45345',
  transform: 'rotate(-28deg)',
  transformOrigin: 'center',
};
