import { useState } from 'react';

const ENGINES = [
  { name: 'Random',    desc: 'Picks a uniformly random legal action.',                           status: 'baseline',  elo: '0' },
  { name: 'Heuristic', desc: 'Softmax over hand-crafted piece values + placement scores.',       status: 'done',      elo: '+~500' },
  { name: 'IS-MCTS',   desc: 'Information-set Monte Carlo Tree Search (determinised rollouts).', status: 'done',      elo: '+~600' },
  { name: 'Neural',    desc: 'Custom MLP trained via self-play + Stockfish value labels.',        status: 'training',  elo: 'Gen 4 in progress' },
  { name: 'Stockfish', desc: 'Stockfish 17 for chess-phase positions (reference oracle).',        status: 'reference', elo: '—' },
];

const ARCH_ROWS: [string, string, string][] = [
  ['Input',        '790 features',  'Board (12 planes × 64), deck composition, turn mode, king-placed flags, revealed card'],
  ['Trunk',        '[512, 256, 128]', 'Three dense layers with ReLU — ~0.57 M params'],
  ['Policy head',  '4 165 actions', 'Chess moves (from/to/promo) + place-on-square + flip-card'],
  ['Value head',   '1 scalar',      'Expected outcome from current player POV, tanh-bounded to [−1, 1]'],
  ['Total params', '~1.1 M',        'Small by design — CPU-playable at inference time'],
];

const WHY_ROWS: [string, string, string, boolean][] = [
  ['AlphaZero / LCZero ResNet', 'Conv on 8 × 8 board', 'Board is sparse in placement phase; conv patterns assume full piece sets', false],
  ['Stockfish NNUE',            'Handcrafted features + tiny net', 'Chess-only; no placement phase, no deck, incompatible action space', false],
  ['Transfer from pretrained',  'Fine-tune chess weights', 'Input format incompatible; game semantics differ across the placement phase', false],
  ['DestovkyNet (chosen)',       '790 flat features → dual heads', 'Handles full game state including deck and turn mode; trained from scratch', true],
];

const DATA_CARDS = [
  { label: 'Self-play mode',             value: 'Heuristic softmax, temp=20',  note: 'Diverse placement decisions' },
  { label: 'Chess-phase value labels',   value: 'Stockfish 17 (1 ms / pos)',   note: '0.7 × SF + 0.3 × outcome' },
  { label: 'Asymmetric-phase labels',    value: 'Rollout 30 steps → SF',       note: '0.5 × SF + 0.5 × outcome' },
  { label: 'Pure-placement labels',      value: 'Game outcome only',            note: 'Rollout too expensive here' },
  { label: 'Value loss weighting',       value: '3× for |v| > 0.15',           note: 'Amplifies decisive positions' },
  { label: 'Training regime',            value: 'lr = 1e-4, cosine, 60 ep',    note: 'Fine-tuning on RTX 6000 Ada (49 GB)' },
];

const LABEL_BG: Record<string, string> = {
  baseline:  '#2a2927',
  done:      '#1e2a0f',
  training:  '#2a220a',
  reference: '#0a1a2a',
};
const LABEL_FG: Record<string, string> = {
  baseline:  '#777',
  done:      '#a8d060',
  training:  '#d0a840',
  reference: '#60a0d0',
};

const card: React.CSSProperties = {
  background: '#1f1e1b',
  border: '1px solid #333',
  borderRadius: '8px',
  padding: '20px 24px',
  marginBottom: '20px',
};
const sectionTitle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#b58863',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: '14px',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  color: '#7f7a70',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '6px 10px',
  borderBottom: '1px solid #333',
};
const td: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: '13px',
  color: '#c9c1b5',
  borderBottom: '1px solid #2a2927',
  verticalAlign: 'top',
};

export default function EnginePage() {
  const [showReport, setShowReport] = useState(false);
  const reportUrl = import.meta.env.BASE_URL + 'engine-training.html';

  return (
    <div style={{ minHeight: '100vh', background: '#161512', color: '#d9d1c1', overflowY: 'auto', padding: '28px 32px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Engine Training</h1>
      <p style={{ color: '#7f7a70', fontSize: '13px', marginBottom: '24px' }}>
        Destovky uses a custom neural network trained via self-play with Stockfish-guided value labels.
        Agents are benchmarked in round-robin arenas against the heuristic baseline.
      </p>

      {/* ── Agent hierarchy ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Agent hierarchy</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Agent', 'Description', 'Relative Elo', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ENGINES.map(e => (
              <tr key={e.name}>
                <td style={{ ...td, fontWeight: 700, color: '#d9d1c1', whiteSpace: 'nowrap' }}>{e.name}</td>
                <td style={td}>{e.desc}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{e.elo}</td>
                <td style={td}>
                  <span style={{ background: LABEL_BG[e.status], color: LABEL_FG[e.status], padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Architecture ────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>DestovkyNet architecture</div>
        <p style={{ fontSize: '13px', color: '#9e9b96', marginBottom: '14px' }}>
          A two-headed MLP (policy + value) trained end-to-end with cross-entropy and MSE loss.
          No convolutions — the placement phase makes the board too sparse and dynamic for spatial
          filters to be useful early in the game.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Component', 'Size', 'Notes'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ARCH_ROWS.map(([comp, size, notes]) => (
              <tr key={comp}>
                <td style={{ ...td, fontWeight: 600, color: '#d9d1c1', whiteSpace: 'nowrap' }}>{comp}</td>
                <td style={{ ...td, color: '#b58863', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{size}</td>
                <td style={td}>{notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Why custom ──────────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Why a custom architecture?</div>
        <p style={{ fontSize: '13px', color: '#9e9b96', marginBottom: '14px' }}>
          Existing chess networks were evaluated and rejected. Stockfish positional knowledge is instead
          distilled into training labels — no weight transfer required.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Approach', 'Architecture', 'Rationale'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {WHY_ROWS.map(([approach, arch, reason, chosen]) => (
              <tr key={approach} style={chosen ? { background: 'rgba(168,208,96,0.04)' } : {}}>
                <td style={{ ...td, fontWeight: chosen ? 700 : 400, color: chosen ? '#a8d060' : '#c9c1b5', whiteSpace: 'nowrap' }}>{approach}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: '12px' }}>{arch}</td>
                <td style={td}>{reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Training data ───────────────────────────────────────────── */}
      <div style={card}>
        <div style={sectionTitle}>Training data and value labelling</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {DATA_CARDS.map(({ label, value, note }) => (
            <div key={label} style={{ background: '#161512', border: '1px solid #2a2927', borderRadius: '6px', padding: '12px 14px' }}>
              <div style={{ fontSize: '11px', color: '#7f7a70', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#d0c9bf', marginBottom: '2px' }}>{value}</div>
              <div style={{ fontSize: '11px', color: '#5f5a52' }}>{note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Full training log ───────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showReport ? '16px' : '0' }}>
          <div style={{ ...sectionTitle, marginBottom: 0 }}>Full training log and benchmarks</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowReport(v => !v)}
              style={{ background: showReport ? '#1e2a0f' : '#2b2926', color: showReport ? '#a8d060' : '#9e9b96', border: '1px solid ' + (showReport ? '#3a5a12' : '#45413b'), borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              {showReport ? 'Hide' : 'Show charts'}
            </button>
            <a
              href={reportUrl}
              target="_blank"
              rel="noreferrer"
              style={{ background: '#2b2926', color: '#9e9b96', border: '1px solid #45413b', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
            >
              Open in new tab ↗
            </a>
          </div>
        </div>
        {showReport && (
          <iframe
            src={reportUrl}
            style={{ width: '100%', height: '80vh', border: 'none', borderRadius: '6px', background: '#161512', marginTop: '16px' }}
            title="Training progress report"
          />
        )}
      </div>
    </div>
  );
}
