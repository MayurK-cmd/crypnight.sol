import { supabase } from '../config/supabase.js';
import { getPuzzleForDuel } from '../services/puzzleLoader.js';
import { normalizeTier } from '../utils/tiers.js';
import { v4 as uuidv4 } from 'uuid';

const activeDuels = new Map();
const userConnections = new Map();
const userToMatch = new Map();

const DUEL_DURATION_MS = 3 * 60 * 1000;
const FORFEIT_TIMEOUT_MS = 30 * 1000;
const DEPOSIT_TIMEOUT_MS = 30 * 1000;
const QUEUE_BAN_MS = 5 * 60 * 1000;
const MATCHMAKING_INTERVAL_MS = 2000;

let matchmakingTimer = null;

// Message protocol: all messages are JSON with { type: string, ...data }
const send = (ws, type, data = {}) => {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify({ type, ...data }));
  }
};

const broadcast = (userIds, type, data) => {
  userIds.forEach(userId => {
    const ws = userConnections.get(userId);
    if (ws) send(ws, type, data);
  });
};

const startMatchmakingLoop = () => {
  if (matchmakingTimer) return;
  matchmakingTimer = setInterval(() => {
    attemptMatchForAllTiers();
  }, MATCHMAKING_INTERVAL_MS);
};

const stopMatchmakingLoop = () => {
  if (matchmakingTimer) {
    clearInterval(matchmakingTimer);
    matchmakingTimer = null;
  }
};

export default (wss) => {
  wss.on('connection', (ws, req) => {
    let user = null;

    // Auth: extract token from URL query or headers
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      send(ws, 'error', { message: 'Authentication required' });
      ws.close();
      return;
    }

    // Verify token
    supabase.auth
      .getUser(token)
      .then(async ({ data, error }) => {
        if (error || !data?.user) {
          send(ws, 'error', { message: 'Invalid token' });
          ws.close();
          return;
        }

        user = data.user;

        if (!user.email_confirmed_at) {
          send(ws, 'error', { message: 'Email not verified' });
          ws.close();
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('wallet_address, tier, rating, username')
          .eq('id', user.id)
          .single();

        user.profile = profile;
        userConnections.set(user.id, ws);
        console.log(`[duel-ws] User connected: ${user.id}`);

        // Message handler
        ws.on('message', (buffer) => {
          try {
            const msg = JSON.parse(buffer.toString());
            handleMessage(ws, user, msg);
          } catch (err) {
            send(ws, 'error', { message: 'Invalid message format' });
          }
        });

        ws.on('close', () => {
          userConnections.delete(user.id);
          console.log(`[duel-ws] User disconnected: ${user.id}`);

          const matchId = userToMatch.get(user.id);
          if (matchId) {
            const session = activeDuels.get(matchId);
            if (session && session.state === 'active') {
              handleForfeit(matchId, user.id).catch(err =>
                console.error('[duel] Forfeit error:', err)
              );
            }
          }
        });
      })
      .catch(() => {
        send(ws, 'error', { message: 'Auth failed' });
        ws.close();
      });
  });

  async function handleMessage(ws, user, msg) {
    const { type, tier, matchId, move, txSignature } = msg;

    if (type === 'queue:join') {
      const normalizedTier = normalizeTier(tier);
      if (!normalizedTier) {
        return send(ws, 'error', { message: 'Invalid tier' });
      }

      const { data: existing } = await supabase
        .from('duel_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'waiting')
        .maybeSingle();

      if (existing) {
        return send(ws, 'queue:already_queued', {
          message: 'Already in queue',
        });
      }

      const { data: banned } = await supabase
        .from('duel_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'banned')
        .gt('ban_until', new Date().toISOString())
        .maybeSingle();

      if (banned) {
        return send(ws, 'queue:banned', {
          message: 'You are banned from the queue',
          until: banned.ban_until,
        });
      }

      const stakeSol = tierToStakeSol(normalizedTier);

      await supabase.from('duel_queue').insert({
        user_id: user.id,
        tier: normalizedTier,
        stake_sol: stakeSol,
        status: 'waiting',
        queued_at: new Date().toISOString(),
      });

      send(ws, 'queue:joined', { tier: normalizedTier, stakeSol });
      startMatchmakingLoop();
    }

    if (type === 'queue:leave') {
      await supabase
        .from('duel_queue')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'waiting');

      send(ws, 'queue:left', {});
    }

    if (type === 'duel:deposit_confirmed') {
      const session = activeDuels.get(matchId);
      if (!session) {
        return send(ws, 'error', { message: 'Match not found' });
      }

      const isPlayerA = session.playerAId === user.id;
      if (!isPlayerA && session.playerBId !== user.id) {
        return send(ws, 'error', { message: 'Not a participant in this match' });
      }

      if (isPlayerA) {
        session.playerADeposited = true;
        session.playerATx = txSignature;
      } else {
        session.playerBDeposited = true;
        session.playerBTx = txSignature;
      }

      if (session.playerADeposited && session.playerBDeposited) {
        session.state = 'active';
        session.startedAt = Date.now();

        const puzzle = await getPuzzleForDuel(session.tier);
        session.puzzle = puzzle;
        session.playerAPuzzleIndex = 0;
        session.playerBPuzzleIndex = 0;

        await supabase
          .from('duel_sessions')
          .update({
            status: 'active',
            started_at: new Date().toISOString(),
            player_a_current_puzzle_id: puzzle.id,
            player_b_current_puzzle_id: puzzle.id,
          })
          .eq('id', matchId);

        broadcast([session.playerAId, session.playerBId], 'duel:start', {
          puzzle: {
            id: puzzle.id,
            fen: puzzle.fen,
            rating: puzzle.rating,
            themes: puzzle.themes,
          },
          durationMs: DUEL_DURATION_MS,
          startedAt: session.startedAt,
        });

        session.timerHandle = setTimeout(() => endDuel(matchId), DUEL_DURATION_MS);
      }
    }

    if (type === 'duel:move') {
      const session = activeDuels.get(matchId);
      if (!session || session.state !== 'active') {
        return send(ws, 'error', { message: 'Duel not active' });
      }

      const isPlayerA = session.playerAId === user.id;
      if (!isPlayerA && session.playerBId !== user.id) {
        return send(ws, 'error', { message: 'Not a participant' });
      }

      const playerState = isPlayerA ? session.playerA : session.playerB;
      const puzzle = session.puzzle;

      if (!move || move.length < 4) {
        return send(ws, 'error', { message: 'Invalid move format' });
      }

      const puzzleIndex = isPlayerA
        ? session.playerAPuzzleIndex
        : session.playerBPuzzleIndex;

      if (!puzzle || !puzzle.solution) {
        return send(ws, 'error', { message: 'No active puzzle' });
      }

      const expectedMove = puzzle.solution[puzzleIndex];
      const isCorrect = move.toLowerCase() === expectedMove.toLowerCase();

      if (!isCorrect) {
        playerState.puzzlesFailed += 1;

        await supabase.from('duel_attempts').insert({
          duel_session_id: matchId,
          user_id: user.id,
          puzzle_id: puzzle.id,
          solved: false,
          time_taken_ms: Date.now() - session.startedAt,
        });

        send(ws, 'duel:puzzle_failed', {
          puzzlesFailed: playerState.puzzlesFailed,
          puzzlesSolved: playerState.puzzlesSolved,
        });

        const nextPuzzle = await getPuzzleForDuel(session.tier);
        if (isPlayerA) {
          session.playerAPuzzleIndex = 0;
        } else {
          session.playerBPuzzleIndex = 0;
        }

        send(ws, 'duel:next_puzzle', {
          puzzle: {
            id: nextPuzzle.id,
            fen: nextPuzzle.fen,
            rating: nextPuzzle.rating,
          },
        });

        broadcast(
          [session.playerAId, session.playerBId],
          'duel:progress',
          {
            playerA: session.playerA,
            playerB: session.playerB,
          }
        );
        return;
      }

      const nextIndex = puzzleIndex + 1;
      if (isPlayerA) {
        session.playerAPuzzleIndex = nextIndex;
      } else {
        session.playerBPuzzleIndex = nextIndex;
      }

      if (nextIndex < puzzle.solution.length) {
        const replyMove = puzzle.solution[nextIndex];
        const afterReplyIndex = nextIndex + 1;
        if (isPlayerA) {
          session.playerAPuzzleIndex = afterReplyIndex;
        } else {
          session.playerBPuzzleIndex = afterReplyIndex;
        }

        send(ws, 'duel:opponent_reply', { move: replyMove });

        if (afterReplyIndex >= puzzle.solution.length) {
          handlePuzzleSolved(session, isPlayerA, matchId);
        }
      } else {
        handlePuzzleSolved(session, isPlayerA, matchId);
      }
    }
  }

  async function attemptMatchForAllTiers() {
    const tiers = ['beginner', 'intermediate', 'pro', 'gm'];
    for (const tier of tiers) {
      await attemptMatch(tier);
    }
  }

  async function attemptMatch(tier) {
    const { data: waiting } = await supabase
      .from('duel_queue')
      .select('*, users!inner(wallet_address, username, rating)')
      .eq('tier', tier)
      .eq('status', 'waiting')
      .order('queued_at', { ascending: true })
      .limit(2);

    if (!waiting || waiting.length < 2) return;

    const playerA = waiting[0];
    const playerB = waiting[1];
    const matchId = uuidv4();

    const session = {
      id: matchId,
      tier,
      state: 'waiting_deposits',
      playerAId: playerA.user_id,
      playerBId: playerB.user_id,
      playerAWallet: playerA.users.wallet_address,
      playerBWallet: playerB.users.wallet_address,
      playerA: { puzzlesSolved: 0, puzzlesFailed: 0 },
      playerB: { puzzlesSolved: 0, puzzlesFailed: 0 },
      playerAPuzzleIndex: 0,
      playerBPuzzleIndex: 0,
      startedAt: null,
      timerHandle: null,
    };

    activeDuels.set(matchId, session);
    userToMatch.set(playerA.user_id, matchId);
    userToMatch.set(playerB.user_id, matchId);

    await supabase.from('duel_sessions').insert({
      id: matchId,
      tier,
      stake_sol: playerA.stake_sol,
      pot_sol: playerA.stake_sol * 2,
      status: 'waiting_deposits',
      player_a_id: playerA.user_id,
      player_b_id: playerB.user_id,
      player_a_wallet: playerA.users.wallet_address,
      player_b_wallet: playerB.users.wallet_address,
    });

    await supabase
      .from('duel_queue')
      .update({ status: 'matched', matched_at: new Date().toISOString() })
      .in('user_id', [playerA.user_id, playerB.user_id]);

    const matchPayload = {
      matchId,
      tier,
      stakeSol: playerA.stake_sol,
    };

    send(userConnections.get(playerA.user_id), 'duel:match_found', {
      ...matchPayload,
      opponent: {
        username: playerB.users.username || 'Opponent',
        rating: playerB.users.rating,
      },
      yourWallet: playerA.users.wallet_address,
      role: 'player_a',
    });

    send(userConnections.get(playerB.user_id), 'duel:match_found', {
      ...matchPayload,
      opponent: {
        username: playerA.users.username || 'Opponent',
        rating: playerA.users.rating,
      },
      yourWallet: playerB.users.wallet_address,
      role: 'player_b',
    });

    setTimeout(() => {
      const s = activeDuels.get(matchId);
      if (s && s.state === 'waiting_deposits') {
        broadcast([playerA.user_id, playerB.user_id], 'duel:cancelled', {
          reason: 'deposit_timeout',
          message: 'Match cancelled — deposit timeout',
        });

        const depositor = s.playerADeposited ? playerB.user_id : playerA.user_id;
        const nonDepositor = s.playerADeposited ? playerA.user_id : playerB.user_id;

        supabase
          .from('duel_queue')
          .insert({
            user_id: nonDepositor,
            tier,
            stake_sol: playerA.stake_sol,
            status: 'banned',
            ban_until: new Date(Date.now() + QUEUE_BAN_MS).toISOString(),
          })
          .catch(err => console.error('[duel] Ban insert error:', err));

        activeDuels.delete(matchId);
        userToMatch.delete(playerA.user_id);
        userToMatch.delete(playerB.user_id);
      }
    }, DEPOSIT_TIMEOUT_MS);
  }

  async function handlePuzzleSolved(session, isPlayerA, matchId) {
    const playerState = isPlayerA ? session.playerA : session.playerB;
    const userId = isPlayerA ? session.playerAId : session.playerBId;

    playerState.puzzlesSolved += 1;

    const puzzle = session.puzzle;
    await supabase.from('duel_attempts').insert({
      duel_session_id: matchId,
      user_id: userId,
      puzzle_id: puzzle.id,
      solved: true,
      time_taken_ms: Date.now() - session.startedAt,
    });

    const nextPuzzle = await getPuzzleForDuel(session.tier);
    session.puzzle = nextPuzzle;
    if (isPlayerA) {
      session.playerAPuzzleIndex = 0;
    } else {
      session.playerBPuzzleIndex = 0;
    }

    const ws = userConnections.get(userId);
    send(ws, 'duel:puzzle_solved', {
      nextPuzzle: {
        id: nextPuzzle.id,
        fen: nextPuzzle.fen,
        rating: nextPuzzle.rating,
      },
      puzzlesSolved: playerState.puzzlesSolved,
      puzzlesFailed: playerState.puzzlesFailed,
    });

    broadcast([session.playerAId, session.playerBId], 'duel:progress', {
      playerA: session.playerA,
      playerB: session.playerB,
    });
  }

  async function endDuel(matchId) {
    const session = activeDuels.get(matchId);
    if (!session) return;

    if (session.timerHandle) clearTimeout(session.timerHandle);

    const a = session.playerA;
    const b = session.playerB;

    let winner = null;
    let isDraw = false;

    if (a.puzzlesSolved > b.puzzlesSolved) {
      winner = session.playerAId;
    } else if (b.puzzlesSolved > a.puzzlesSolved) {
      winner = session.playerBId;
    } else if (a.puzzlesFailed < b.puzzlesFailed) {
      winner = session.playerAId;
    } else if (b.puzzlesFailed < a.puzzlesFailed) {
      winner = session.playerBId;
    } else {
      isDraw = true;
    }

    session.state = 'ended';

    await supabase
      .from('duel_sessions')
      .update({
        status: isDraw ? 'draw' : 'settled',
        ended_at: new Date().toISOString(),
        winner_id: winner,
        player_a_puzzles_solved: a.puzzlesSolved,
        player_b_puzzles_solved: b.puzzlesSolved,
        player_a_puzzles_failed: a.puzzlesFailed,
        player_b_puzzles_failed: b.puzzlesFailed,
      })
      .eq('id', matchId);

    broadcast([session.playerAId, session.playerBId], 'duel:ended', {
      reason: isDraw ? 'draw' : 'timer',
      playerA: a,
      playerB: b,
      isDraw,
      winnerId: winner,
    });

    setTimeout(() => {
      activeDuels.delete(matchId);
      userToMatch.delete(session.playerAId);
      userToMatch.delete(session.playerBId);
    }, 5000);
  }

  async function handleForfeit(matchId, forfeitingUserId) {
    const session = activeDuels.get(matchId);
    if (!session) return;

    if (session.timerHandle) clearTimeout(session.timerHandle);

    const winnerId = session.playerAId === forfeitingUserId
      ? session.playerBId
      : session.playerAId;

    session.state = 'ended';

    await supabase
      .from('duel_sessions')
      .update({
        status: 'forfeited',
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
        player_a_puzzles_solved: session.playerA.puzzlesSolved,
        player_b_puzzles_solved: session.playerB.puzzlesSolved,
        player_a_puzzles_failed: session.playerA.puzzlesFailed,
        player_b_puzzles_failed: session.playerB.puzzlesFailed,
      })
      .eq('id', matchId);

    broadcast([session.playerAId, session.playerBId], 'duel:ended', {
      reason: 'forfeit',
      winnerId,
      forfeitedBy: forfeitingUserId,
      isDraw: false,
      playerA: session.playerA,
      playerB: session.playerB,
    });

    setTimeout(() => {
      activeDuels.delete(matchId);
      userToMatch.delete(session.playerAId);
      userToMatch.delete(session.playerBId);
    }, 5000);
  }

  function tierToStakeSol(tier) {
    const stakes = {
      beginner: 0.05,
      intermediate: 0.10,
      pro: 0.25,
      gm: 0.50,
    };
    return stakes[tier] ?? 0.05;
  }
};
