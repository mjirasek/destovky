"""
Expectimax agent for Destovky.

When choosing between flip and chess move, computes:

  E[flip] = Σ_{piece_type} P(piece_type) × max_{sq} eval(board after place(piece, sq))

  V[move m] = eval(board after m)

  decision = argmax(E[flip], max_m V[move m])

Position evaluation uses a dynamic SF/heuristic blend based on how many
pieces are still to be placed:

  chess_weight → 1.0 when both kings placed, all pieces on board (pure SF)
  chess_weight → 0.3 in early placement phase (SF unreliable on sparse board)

Usage:
  from training.agents.expectimax_agent import make_agent
  agent = make_agent()          # opens Stockfish
  action = agent(state, rng)

Selfplay usage (both sides expectimax, slower but stronger data):
  python -m training.scripts.selfplay --mode fast --games 500 --agent expectimax
"""

from __future__ import annotations
import os, sys, copy
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)

from training.engine.game_state import flip_card, place_piece, make_move, available_promotion_roles
from training.engine.mcts import _apply
from training.agents.heuristic_agent import choose_action as _heuristic
from training.agents.random_agent import legal_actions

# Stockfish exe paths (same as selfplay.py)
_SF_EXE = os.path.abspath(os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'stockfish', 'stockfish', 'stockfish-windows-x86-64.exe',
))

PIECE_VALUES = {'pawn': 1, 'knight': 3, 'bishop': 3, 'rook': 5, 'queen': 9, 'king': 0}
_ROLES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']


# ── Stockfish ─────────────────────────────────────────────────────────────────

def _open_sf(exe: str | None = None):
    path = os.environ.get('STOCKFISH_PATH') or exe or _SF_EXE
    if not os.path.exists(path):
        return None
    try:
        import chess.engine
        engine = chess.engine.SimpleEngine.popen_uci(path)
        engine.configure({'Threads': 1, 'Hash': 16})
        return engine
    except Exception as e:
        print(f'[expectimax] Stockfish failed: {e}')
        return None


def _sf_eval(sf_engine, state: dict) -> float | None:
    """SF evaluation from current player's POV. Returns None if not applicable."""
    if sf_engine is None:
        return None
    if not (state.get('white_king_placed') and state.get('black_king_placed')):
        return None
    if state.get('card_flipped') or state.get('pending_promotion') is not None:
        return None
    try:
        import chess, chess.engine, math
        from training.agents.evaluate import to_chess_board
        cb = to_chess_board(state)
        cb.turn = chess.WHITE if state['turn'] == 'white' else chess.BLACK
        info = sf_engine.analyse(cb, chess.engine.Limit(time=0.001))
        score = info['score'].pov(cb.turn).score(mate_score=30_000)
        if score is None:
            return None
        return float(2.0 / (1.0 + math.exp(-score / 400.0)) - 1.0)
    except Exception:
        return None


# ── Position evaluation (dynamic blend) ───────────────────────────────────────

def _material_eval(state: dict) -> float:
    """Material balance normalised to [-1, +1] from current player's POV."""
    color = state['turn']
    opp   = 'black' if color == 'white' else 'white'
    my_mat  = sum(PIECE_VALUES.get(r, 0) for r, c in state['board'].values() if c == color)
    opp_mat = sum(PIECE_VALUES.get(r, 0) for r, c in state['board'].values() if c == opp)
    return max(-1.0, min(1.0, (my_mat - opp_mat) / 20.0))


def _eval(state: dict, sf_engine) -> float:
    """
    Dynamic SF / material blend.

    chess_weight = 1.0 when both kings placed (pure SF territory)
                 = 0.3 when nothing placed yet (SF meaningless on sparse board)
                 scales linearly with pieces-placed fraction in between.
    """
    if state.get('game_over'):
        winner = state.get('winner')
        color  = state['turn']
        if winner is None:   return 0.0
        if winner == color:  return 1.0
        return -1.0

    both_kings = state.get('white_king_placed') and state.get('black_king_placed')

    # Dynamic weight
    total_start   = 32   # 16 cards per side
    remaining     = len(state.get('white_deck', [])) + len(state.get('black_deck', []))
    placed_frac   = 1.0 - remaining / total_start  # 0→1 as game progresses
    chess_weight  = 0.3 + 0.7 * placed_frac if not both_kings else 1.0

    mat = _material_eval(state)

    if both_kings:
        sf = _sf_eval(sf_engine, state)
        if sf is not None:
            return chess_weight * sf + (1.0 - chess_weight) * mat

    return mat


# ── Simulate revealing a specific piece type ───────────────────────────────────

def _simulate_reveal(state: dict, piece_type: str) -> dict | None:
    """
    Return a new state as if the current player flipped and got `piece_type`,
    regardless of actual deck order. Returns None if piece_type not in deck.
    """
    color    = state['turn']
    deck_key = f'{color}_deck'
    deck     = state[deck_key]

    # Find a card of this type in the deck
    swap_idx = None
    for i, card in enumerate(deck):
        if card.split('-')[0] == piece_type:
            swap_idx = i
            break
    if swap_idx is None:
        return None

    # Swap to front so flip_card draws it
    new_deck = list(deck)
    new_deck[0], new_deck[swap_idx] = new_deck[swap_idx], new_deck[0]

    modified = dict(state)
    modified[deck_key] = new_deck
    return flip_card(modified)


# ── Expected value of flipping ─────────────────────────────────────────────────

def _heuristic_place_score(state: dict, sq: int) -> float:
    """Quick heuristic score for placing the revealed card on a square (for ranking)."""
    from training.agents.heuristic_agent import score_placement
    try:
        return score_placement(state, sq)
    except Exception:
        return 0.0


def _expected_flip_value(state: dict, sf_engine, top_k: int = 3) -> float:
    """
    E[V(flip)] = Σ_piece P(piece) × max_sq eval(state after place(piece, sq))

    Averages over remaining deck composition (not deck order — player doesn't
    know what's on top).

    top_k: for each piece type, rank placement squares by heuristic score and
           SF-evaluate only the top_k squares. This limits SF calls to
           (num_piece_types × top_k) keeping decisions fast enough for selfplay.
           Set top_k=None to evaluate all squares (slower, more accurate).
    """
    color = state['turn']
    deck  = state['white_deck'] if color == 'white' else state['black_deck']
    if not deck:
        return -2.0  # can't flip

    counts = Counter(card.split('-')[0] for card in deck)
    total  = len(deck)

    expected = 0.0
    for piece_type, count in counts.items():
        prob = count / total

        revealed = _simulate_reveal(state, piece_type)
        if revealed is None or revealed.get('game_over'):
            continue

        placement_squares = revealed.get('legal_placement_sq', [])
        if not placement_squares:
            expected += prob * -1.0
            continue

        # Rank squares by heuristic, then SF-evaluate only top_k
        if top_k is not None and sf_engine is not None and len(placement_squares) > top_k:
            scored = sorted(placement_squares,
                            key=lambda sq: _heuristic_place_score(revealed, sq),
                            reverse=True)
            candidate_squares = scored[:top_k]
        else:
            candidate_squares = placement_squares

        best_sq_val = -2.0
        for sq in candidate_squares:
            placed = place_piece(revealed, sq)
            val    = _eval(placed, sf_engine)
            if val > best_sq_val:
                best_sq_val = val

        expected += prob * best_sq_val

    return expected


# ── Best chess move by SF ──────────────────────────────────────────────────────

def _best_chess_move(state: dict, sf_engine) -> tuple[tuple | None, float]:
    """Evaluate all legal chess moves, return (best_action, best_value)."""
    best_action = None
    best_val    = -2.0

    for from_sq, dests in state['legal_moves'].items():
        for to_sq in dests:
            try:
                next_state = make_move(state, from_sq, to_sq)
                # Eval from original player's POV (make_move switches turn)
                raw = _eval(next_state, sf_engine)
                val = -raw   # negate: next_state eval is opponent's POV
            except Exception:
                continue
            if val > best_val:
                best_val    = val
                best_action = ('move', from_sq, to_sq)

    return best_action, best_val


# ── Main decision ──────────────────────────────────────────────────────────────

def choose_action(state: dict, sf_engine=None, rng=None) -> tuple | None:
    """
    Pick the best action using expectimax reasoning.
    Falls back to heuristic for forced / trivial cases.
    """
    import random as _random
    if rng is None:
        rng = _random

    if state['game_over']:
        return None

    # Forced: promotion
    if state['pending_promotion'] is not None:
        roles = available_promotion_roles(state, state['turn'])
        for r in ('queen', 'rook', 'bishop', 'knight'):
            if r in roles:
                return ('promote', r)
        return None

    # Forced: place the already-revealed card — use heuristic spatial scoring
    if state['card_flipped']:
        return _heuristic(state, rng)

    color = state['turn']
    deck  = state['white_deck'] if color == 'white' else state['black_deck']
    tm    = state['turn_mode']

    # Forced: must flip (king not yet placed)
    if tm == 'must-place':
        return ('flip',)

    actions = legal_actions(state)
    if not actions:
        return None
    if len(actions) == 1:
        return actions[0]

    # Must-move (in check, no flip): pick best chess move
    has_flip  = any(a[0] == 'flip' for a in actions)
    has_moves = any(a[0] == 'move' for a in actions)

    if not has_flip:
        action, _ = _best_chess_move(state, sf_engine)
        return action or _heuristic(state, rng)

    if not has_moves:
        return ('flip',)

    # ── The key decision: flip vs chess move ──────────────────────────────
    flip_val = _expected_flip_value(state, sf_engine)
    move_action, move_val = _best_chess_move(state, sf_engine)

    if flip_val >= move_val:
        return ('flip',)
    else:
        return move_action or ('flip',)


# ── Factory ────────────────────────────────────────────────────────────────────

def make_agent(sf_exe: str | None = None):
    """
    Return a configured agent callable. Opens Stockfish once.

    agent = make_agent()
    action = agent(state, rng)
    """
    sf_engine = _open_sf(sf_exe)
    if sf_engine is None:
        print('[expectimax] No Stockfish — falling back to material eval only')

    def agent(state: dict, rng=None) -> tuple | None:
        return choose_action(state, sf_engine, rng)

    agent.__name__ = 'Expectimax+SF' if sf_engine else 'Expectimax(no-SF)'

    # Attach cleanup so arena can close SF when done
    def close():
        if sf_engine:
            try: sf_engine.quit()
            except Exception: pass
    agent.close = close

    return agent
