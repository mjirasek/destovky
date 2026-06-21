"""
Arena: plays one Destovky game between two agents and returns a result dict.

Result dict:
  winner          str | None
  turns           int         total half-moves applied
  end_reason      str         'checkmate' | 'card_gamble' | 'stalemate' | 'timeout' | 'repetition'
"""

from ..engine.game_state import (
    create_initial_state,
    flip_card,
    place_piece,
    make_move,
    complete_promotion,
)

# Random play can last many moves; 1200 half-moves (~600 full) keeps the
# benchmark running while catching true infinite loops.
MAX_TURNS = 1200
# Declare draw if a board position (board+turn) repeats this many times.
REPETITION_LIMIT = 3


def _board_hash(state: dict) -> tuple:
    """Minimal position hash: sorted piece list + turn + turn_mode."""
    return (
        tuple(sorted((sq, role, color) for sq, (role, color) in state['board'].items())),
        state['turn'],
        state['turn_mode'],
    )


def _apply(state: dict, action: tuple) -> dict:
    kind = action[0]
    if kind == 'flip':
        return flip_card(state)
    if kind == 'place':
        return place_piece(state, action[1])
    if kind == 'move':
        return make_move(state, action[1], action[2])
    if kind == 'promote':
        return complete_promotion(state, action[1])
    return state


def play_game(white_agent, black_agent, rng=None) -> dict:
    """
    Play one complete game.

    white_agent / black_agent: callables(state, rng) -> action tuple | None
    rng: optional random.Random instance (for reproducibility)
    """
    state = create_initial_state()
    agents = {'white': white_agent, 'black': black_agent}
    turns = 0
    end_reason = 'timeout'
    position_counts: dict = {}

    while not state['game_over'] and turns < MAX_TURNS:
        # Repetition detection (3-fold → draw)
        h = _board_hash(state)
        cnt = position_counts.get(h, 0) + 1
        position_counts[h] = cnt
        if cnt >= REPETITION_LIMIT:
            end_reason = 'repetition'
            break

        agent = agents[state['turn']]
        action = agent(state, rng)

        if action is None:
            # No legal actions and not game_over → stalemate
            end_reason = 'stalemate'
            break

        prev_flipped = state['card_flipped']
        state = _apply(state, action)
        turns += 1

        if state['game_over']:
            # Card-gamble loss: the flip itself ended the game
            if action[0] == 'flip' and state['card_flipped']:
                end_reason = 'card_gamble'
            else:
                end_reason = 'checkmate'
            break
    else:
        # Loop exhausted without break
        if state['game_over']:
            end_reason = 'checkmate'
        # else stays 'timeout'

    return {
        'winner':     state['winner'],
        'turns':      turns,
        'end_reason': end_reason,
    }
