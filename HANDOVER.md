# Destovky — Session Handover (2026-10-05)

Status snapshot for whoever (human or Claude) picks this up next. This session was
Q&A/status only — no code was changed or committed.

## 1. Remote training migration (maddog2020.chem.gla.ac.uk) — mostly done

- Self-play/training now runs on the remote GPU server instead of locally.
- `.gitignore` updated locally (not yet committed) to exclude `training/data/`,
  `training/models/checkpoints/`, `training/stockfish/`.
- Remote env confirmed working: conda env `recursive_nn`, torch+CUDA, project at
  `/mnt/STORAGE3/michael/recursive_nn/training`. Disk at 95% full — watch it.
- Local and remote self-play data pools are NOT synced (two independent, diverged
  pools). Only a one-way manual push exists (local→remote, inside
  `training/scripts/gpu_pipeline.py`).
- **Open:** no recurring/automated remote self-play workflow set up yet (capped
  workers, `STOCKFISH_PATH` baked in, periodic pull-back) — was asked for, not done.

## 2. Engine strategy sweep — concluded, clear winner

Full detail: `training/STRATEGY_EXPLORATION.md`, `training/strategy_sweep_results.json`.

- **`mcts_agent` (IS-MCTS + hand-crafted material/PST eval, no neural net) is
  undefeated** across 8 head-to-head 5,000-game experiments (~9h compute). Beats
  heuristic 51.7%-14.0%.
- Smarter 1-ply heuristics (deck-probability expectimax, tuned king-safety/tempo)
  all landed within noise of plain heuristic — search depth is the lever, not
  per-move cleverness.
- The trained neural net (`gen7_best.pt`) is a genuinely bad evaluator, not just
  under-searched — bolting it onto the same MCTS tree as leaf eval lost badly
  (11.5% vs 46.3%) to the hand-crafted eval. Likely distribution shift: value head
  trained on weak self-play policies, doesn't generalize to strong-search positions.
- Cheap Stockfish top-3 re-rank on top of MCTS (`sf_mcts_agent.py`) is a **null
  result** vs plain MCTS (32.2% vs 31.2%) — MCTS's own visit-count ranking already
  agrees with Stockfish most of the time. This is a shallow SF integration
  (post-search re-rank only); a deeper one (SF as in-tree leaf eval, much larger
  time budget to absorb per-query cost) was never tried.
- Search budget plateaus hard past ~600ms/move (100→600ms: +24.9pp; 600→2400ms:
  only +2.8pp). At fixed budget, **few-and-deep beats many-and-shallow**:
  K=2 x 300ms beat K=12 x 50ms, 46.9% to 30.0%.
- **Validated operating point: ~500-600ms/move, K=2-4 determinizations, most time
  on per-determinization depth.**
- **4,000-game self-play batch generated 2026-10-05** on maddog2020 with this
  strong config (K=4, T=150ms, `--sf`): 1,214,366 examples, only 14% draws (vs
  ~83% old heuristic self-play) — much better training signal. Saved at
  `training/data/selfplay_mcts_sf_20261005_120054.pkl` on maddog2020.
  **Not yet pulled to local or used for retraining.**
- **Untested question (raised this session):** pure `stockfish_agent` (real SF for
  chess phase, heuristic fallback for placement) head-to-head vs plain `mcts_agent`
  over full games — never run. Reasoned guess is MCTS still wins because Stockfish
  can't help at all during placement/flip (the heuristic fallback there is the
  weakest agent in the sweep), but this is inference, not measured. A 2,000-5,000
  game arena run would settle it.

## 3. Engine test dashboard (maddog2020:8787) — working, not in git by design

- `/mnt/STORAGE3/michael/recursive_nn/dashboard/server.py` — deliberately kept out
  of the destovky git repo per explicit instruction.
- Now serves the real production site (`dashboard/dist/`, built locally via
  `npm run build` then scp'd over) at `/`, not just a lookalike test board.
- Dashboard model list: `stockfish` (real SF, multipv=2, chess-phase only),
  `mcts` (validated few-and-deep IS-MCTS), both with adjustable think time
  (0.5s-10s) and move explanations. `hybrid`/`heuristic`/`random` as fixed
  baselines. Research-only variants (`prob`, `sfmcts`, `neuralmcts`, `mctsbig`)
  still exist in `strategy_sweep.py` but aren't surfaced in the dashboard.
- Post-game review capture: flagged moves + notes POST to `/api/save_review`,
  written to `dashboard/reviews/<timestamp>_<id>.json` on maddog2020.
  **Check this directory for new user critiques before assuming no feedback
  exists.**
- Bug fixed: `crypto.randomUUID()` doesn't exist over plain HTTP (non-secure
  context) — crashed the whole SPA to a blank page. Fixed with a `genId()`
  fallback. Lesson: curl/HTTP-level checks don't catch this; need a real browser.
- Bug fixed: king-shuffling instead of drawing cards in placement phase, caused by
  softmax temperature (tuned for material-scale score gaps) blurring the much
  smaller king-PST-vs-flip-EV gap in that phase. Fixed with a deterministic
  `_greedy_placement_choose` for that specific decision only.
  **Note: this same temperature-blur issue likely also affects `heuristic_agent`
  and `prob_agent` as standalone agents** — worth checking if revisiting the sweep.
- Restart command if down:
  ```
  cd /mnt/STORAGE3/michael/recursive_nn && STOCKFISH_PATH=.../stockfish-ubuntu-x86-64-avx2 \
    nohup /home/michael/miniconda3/envs/recursive_nn/bin/python3 dashboard/server.py 8787 \
    > /tmp/dashboard.log 2>&1 < /dev/null &
  ```
  Verify with `pgrep -af dashboard/server.py` (exit codes from this remote
  fish/bash setup are unreliable for this check — don't trust them).

## 4. Uncommitted local changes (as of session end)

Nothing was committed or touched this session. Working tree still has (from prior
sessions):
- Modified: `.gitignore`, `src/App.tsx`, `src/engine/ENGINE_PLAN.md`
- Untracked: `src/engine/remoteEngine.ts` (same-origin remote engine calls for the
  dashboard), the entire `training/` tree (agents, scripts, reports, results json).

## 5. Open items / next steps, in rough priority order

1. Retrain the value/policy net on the new strong-search self-play batch
   (`selfplay_mcts_sf_20261005_120054.pkl`) and re-arena vs `mcts_agent` — the one
   neural approach not yet falsified.
2. Run `stockfish` vs `mcts` full-game arena (2,000-5,000 games) to settle the
   open architecture question from this session with real data instead of inference.
3. Set up the recurring/automated remote self-play workflow (capped workers,
   `STOCKFISH_PATH` baked in, periodic pull-back) — asked for, not yet built.
4. Check `dashboard/reviews/` on maddog2020 for any new user critiques.
5. Decide whether/how to commit the large uncommitted `training/` tree and the
   `remoteEngine.ts`/`App.tsx`/`ENGINE_PLAN.md` changes to git.

## 6. Unresolved from this session: "chat text looks corrupted"

User reported the text in this chat looked corrupted; root cause not confirmed.
Working theory: typographic Unicode characters (em dashes, smart quotes) in
assistant replies rendering as mojibake in a terminal/client not handling UTF-8
correctly (common with Windows console legacy codepages). Mitigation applied this
session: switched to plain ASCII punctuation (hyphens, straight quotes). **Not
verified** — no confirming screenshot/snippet was provided before the session
closed. Worth a fresh look next session if it recurs.
