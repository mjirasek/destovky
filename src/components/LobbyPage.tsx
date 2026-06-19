import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Challenge, GameRow, Profile } from '../multiplayer';

interface Props {
  configured: boolean;
  user: User | null;
  profiles: Profile[];
  challenges: Challenge[];
  games: GameRow[];
  activeGame: GameRow | null;
  status: string;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onCreateChallenge: (opponentId: string) => Promise<void>;
  onAcceptChallenge: (challenge: Challenge) => Promise<void>;
  onDeclineChallenge: (challengeId: string) => Promise<void>;
  onOpenGame: (gameId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onClearQueue: () => Promise<void>;
  onStartLocalGame: () => void;
}

function nameFor(profile?: Profile): string {
  return profile?.display_name ?? profile?.username ?? 'Unknown';
}

function gameResult(game: GameRow, userId?: string): string {
  const state = game.state_json;
  if (!state.gameOver) return 'In progress';
  if (!state.winner) return 'Draw';
  if (!userId) return `${state.winner} won`;
  const won = state.winner === 'white' ? game.white_user_id === userId : game.black_user_id === userId;
  return won ? 'Won' : 'Lost';
}

export default function LobbyPage({
  configured,
  user,
  profiles,
  challenges,
  games,
  activeGame,
  status,
  onSignIn,
  onSignOut,
  onCreateChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
  onOpenGame,
  onRefresh,
  onClearQueue,
  onStartLocalGame,
}: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [opponentId, setOpponentId] = useState('');

  const profileById = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles]);
  const opponents = user ? profiles.filter(profile => profile.id !== user.id) : [];
  const incoming = user ? challenges.filter(c => c.status === 'pending' && c.challenged_user_id === user.id).slice(0, 4) : [];
  const outgoing = user ? challenges.filter(c => c.status === 'pending' && c.challenger_user_id === user.id).slice(0, 4) : [];
  const accepted = challenges.filter(c => c.status === 'accepted' && c.game_id).slice(0, 4);
  const currentGames = games.filter(game => !game.state_json.gameOver).slice(0, 4);
  const completedGames = games.filter(game => game.state_json.gameOver).slice(0, 8);
  const canChallenge = Boolean(user && opponentId && !activeGame);

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div>
          <h1 style={titleStyle}>Destovky</h1>
          <p style={subtitleStyle}>Lobby, challenges, game history, and live games.</p>
        </div>
        <button type="button" style={primaryButtonStyle} onClick={onStartLocalGame}>
          Playground
        </button>
      </section>

      <div style={gridStyle}>
        <section style={panelStyle}>
          <PanelHeader title="Account" action={user ? 'signed in' : 'login'} />
          {!configured && <p style={warningStyle}>Online play needs Supabase config in the deployed build.</p>}
          {!user ? (
            <div style={{ display: 'grid', gap: '8px' }}>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="email" style={inputStyle} />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="password" type="password" style={inputStyle} />
              <button type="button" style={primaryButtonStyle} disabled={!configured} onClick={() => onSignIn(email, password)}>
                Sign in
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              <span style={bodyText}>{user.email}</span>
              <button type="button" style={secondaryButtonStyle} onClick={onSignOut}>Sign out</button>
            </div>
          )}
          {status && <p style={statusStyle}>{status}</p>}
        </section>

        <section style={panelStyle}>
          <PanelHeader title="Challenge" action={activeGame ? 'in game' : 'ready'} />
          <div style={{ display: 'grid', gap: '8px' }}>
            <select value={opponentId} onChange={e => setOpponentId(e.target.value)} style={inputStyle} disabled={!user || Boolean(activeGame)}>
              <option value="">{opponents.length === 0 ? 'No opponents loaded' : 'Choose opponent'}</option>
              {opponents.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.display_name}</option>
              ))}
            </select>
            <button type="button" style={primaryButtonStyle} disabled={!canChallenge} onClick={() => onCreateChallenge(opponentId)}>
              Send challenge
            </button>
            <button type="button" style={secondaryButtonStyle} disabled={!user} onClick={onClearQueue}>Clear queue</button>
          </div>
        </section>

        <section style={widePanelStyle}>
          <PanelHeader title="Lobby" action={`${profiles.length} players`} />
          <div style={playersGridStyle}>
            {profiles.map(profile => (
              <div key={profile.id} style={playerRowStyle}>
                <span style={onlineDotStyle} />
                <span>{profile.display_name}</span>
              </div>
            ))}
            {profiles.length === 0 && <p style={mutedText}>Sign in to load players.</p>}
          </div>
        </section>

        <QueuePanel
          title="Incoming"
          items={incoming}
          profiles={profileById}
          empty="No incoming challenges."
          renderActions={challenge => (
            <>
              <button type="button" style={smallButtonStyle} onClick={() => onAcceptChallenge(challenge)}>Accept</button>
              <button type="button" style={smallButtonStyle} onClick={() => onDeclineChallenge(challenge.id)}>Decline</button>
            </>
          )}
        />

        <QueuePanel
          title="Pending"
          items={outgoing}
          profiles={profileById}
          empty="No pending challenges."
          renderActions={() => <span style={mutedText}>waiting</span>}
        />

        <QueuePanel
          title="Ready Games"
          items={accepted}
          profiles={profileById}
          empty="No accepted games."
          renderActions={challenge => (
            <button type="button" style={smallButtonStyle} onClick={() => challenge.game_id && onOpenGame(challenge.game_id)}>
              Open
            </button>
          )}
        />

        <section style={widePanelStyle}>
          <PanelHeader title="Games" action="active" />
          <GameList games={currentGames} profiles={profileById} userId={user?.id} empty="No active games." onOpenGame={onOpenGame} />
        </section>

        <section style={widePanelStyle}>
          <PanelHeader title="History" action="latest" />
          <GameList games={completedGames} profiles={profileById} userId={user?.id} empty="No completed games yet." onOpenGame={onOpenGame} />
        </section>
      </div>

      <button type="button" style={refreshButtonStyle} disabled={!user} onClick={onRefresh}>Refresh lobby</button>
    </main>
  );
}

function PanelHeader({ title, action }: { title: string; action: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
      <span style={panelTitleStyle}>{title}</span>
      <span style={panelActionStyle}>{action}</span>
    </div>
  );
}

function QueuePanel({
  title,
  items,
  profiles,
  empty,
  renderActions,
}: {
  title: string;
  items: Challenge[];
  profiles: Map<string, Profile>;
  empty: string;
  renderActions: (challenge: Challenge) => React.ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <PanelHeader title={title} action={String(items.length)} />
      <div style={{ display: 'grid', gap: '6px' }}>
        {items.length === 0 && <p style={mutedText}>{empty}</p>}
        {items.map(challenge => (
          <div key={challenge.id} style={challengeRowStyle}>
            <span style={bodyText}>
              {nameFor(profiles.get(challenge.challenger_user_id))} vs {nameFor(profiles.get(challenge.challenged_user_id))}
            </span>
            <span style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>{renderActions(challenge)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function GameList({
  games,
  profiles,
  userId,
  empty,
  onOpenGame,
}: {
  games: GameRow[];
  profiles: Map<string, Profile>;
  userId?: string;
  empty: string;
  onOpenGame: (gameId: string) => Promise<void>;
}) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {games.length === 0 && <p style={mutedText}>{empty}</p>}
      {games.map(game => (
        <div key={game.id} style={gameRowStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={bodyText}>
              {nameFor(profiles.get(game.white_user_id ?? ''))} vs {nameFor(profiles.get(game.black_user_id ?? ''))}
            </div>
            <div style={mutedText}>{gameResult(game, userId)} · {game.notations_json.length} moves · room {game.room_code}</div>
          </div>
          <button type="button" style={smallButtonStyle} onClick={() => onOpenGame(game.id)}>Open</button>
        </div>
      ))}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '1080px',
  margin: '0 auto',
  padding: '22px 18px 40px',
};

const heroStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: '16px',
  marginBottom: '16px',
};

const titleStyle: React.CSSProperties = { margin: 0, color: '#f0ede8', fontSize: '34px', lineHeight: 1, letterSpacing: 0 };
const subtitleStyle: React.CSSProperties = { margin: '8px 0 0', color: '#8f8981', fontSize: '14px' };

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '10px',
};

const panelStyle: React.CSSProperties = {
  background: '#262422',
  border: '1px solid #3d3b38',
  borderRadius: '8px',
  padding: '10px',
  display: 'grid',
  gap: '10px',
};

const widePanelStyle: React.CSSProperties = { ...panelStyle, gridColumn: 'span 2' };
const panelTitleStyle: React.CSSProperties = { color: '#8f8981', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' };
const panelActionStyle: React.CSSProperties = { color: '#629924', fontSize: '10px', fontWeight: 800 };
const bodyText: React.CSSProperties = { color: '#cfc8bf', fontSize: '12px', lineHeight: 1.35, margin: 0 };
const mutedText: React.CSSProperties = { color: '#756f67', fontSize: '11px', lineHeight: 1.35, margin: 0 };
const warningStyle: React.CSSProperties = { color: '#c8a84a', fontSize: '11px', lineHeight: 1.35, margin: 0 };
const statusStyle: React.CSSProperties = { color: '#c8a84a', fontSize: '11px', lineHeight: 1.35, margin: 0 };

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#1a1816',
  color: '#e0dbd4',
  border: '1px solid #3d3b38',
  borderRadius: '6px',
  padding: '8px',
  fontSize: '12px',
};

const primaryButtonStyle: React.CSSProperties = {
  background: '#1e2a0f',
  color: '#a8d060',
  border: '1px solid #3a5a12',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '12px',
  fontWeight: 800,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: '#1a1816',
  color: '#9e9b96',
  border: '1px solid #3d3b38',
  borderRadius: '6px',
  padding: '8px 10px',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

const smallButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  padding: '4px 7px',
  fontSize: '10px',
};

const refreshButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  marginTop: '10px',
};

const playersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '6px',
};

const playerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  background: '#1a1816',
  border: '1px solid #34312c',
  borderRadius: '6px',
  padding: '7px 8px',
  color: '#cfc8bf',
  fontSize: '12px',
};

const onlineDotStyle: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#629924',
  flexShrink: 0,
};

const challengeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  background: '#1a1816',
  border: '1px solid #34312c',
  borderRadius: '6px',
  padding: '7px 8px',
};

const gameRowStyle: React.CSSProperties = {
  ...challengeRowStyle,
  alignItems: 'center',
};
