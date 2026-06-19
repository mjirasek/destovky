import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { GameMessage, Profile } from '../multiplayer';

interface Props {
  user: User | null;
  messages: GameMessage[];
  profiles: Profile[];
  status: string;
  onSendMessage: (body: string) => Promise<void>;
}

function nameFor(userId: string, profiles: Profile[]): string {
  return profiles.find(profile => profile.id === userId)?.display_name ?? 'Player';
}

export default function GameChat({ user, messages, profiles, status, onSendMessage }: Props) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(body);
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={titleStyle}>Chat</span>
        {status && <span style={statusStyle}>{status}</span>}
      </div>
      <div style={messagesStyle}>
        {messages.length === 0 && <p style={mutedText}>No messages yet.</p>}
        {messages.map(message => (
          <div key={message.id} style={messageStyle}>
            <span style={authorStyle}>{nameFor(message.user_id, profiles)}</span>
            <span style={bodyStyle}>{message.body}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px' }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void send();
          }}
          placeholder={user ? 'Message' : 'Sign in to chat'}
          disabled={!user}
          style={inputStyle}
        />
        <button type="button" style={buttonStyle} disabled={!user || !body.trim() || sending} onClick={() => void send()}>
          Send
        </button>
      </div>
    </section>
  );
}

const panelStyle: React.CSSProperties = {
  background: '#262422',
  border: '1px solid #3d3b38',
  borderRadius: '8px',
  padding: '8px',
  display: 'grid',
  gap: '8px',
};

const titleStyle: React.CSSProperties = {
  color: '#8f8981',
  fontSize: '10px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const statusStyle: React.CSSProperties = {
  color: '#629924',
  fontSize: '10px',
  fontWeight: 700,
};

const messagesStyle: React.CSSProperties = {
  display: 'grid',
  gap: '6px',
  maxHeight: '160px',
  overflowY: 'auto',
  background: '#1a1816',
  border: '1px solid #34312c',
  borderRadius: '6px',
  padding: '7px',
};

const messageStyle: React.CSSProperties = {
  display: 'grid',
  gap: '2px',
};

const authorStyle: React.CSSProperties = {
  color: '#8f8981',
  fontSize: '10px',
  fontWeight: 800,
};

const bodyStyle: React.CSSProperties = {
  color: '#d0c9bf',
  fontSize: '12px',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const mutedText: React.CSSProperties = {
  color: '#756f67',
  fontSize: '11px',
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  background: '#1a1816',
  color: '#e0dbd4',
  border: '1px solid #3d3b38',
  borderRadius: '6px',
  padding: '7px 8px',
  fontSize: '12px',
};

const buttonStyle: React.CSSProperties = {
  background: '#1e2a0f',
  color: '#a8d060',
  border: '1px solid #3a5a12',
  borderRadius: '6px',
  padding: '7px 9px',
  fontSize: '12px',
  fontWeight: 800,
  cursor: 'pointer',
};
