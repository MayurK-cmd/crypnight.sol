import { verifySocketAuth } from '../middleware/auth.middleware.js';
import { supabase } from '../config/supabase.js';
import { getPuzzleForDuel } from '../services/puzzleLoader.js';
import { normalizeTier } from '../utils/tiers.js';

const activeDuels = new Map();

const DUEL_DURATION_MS = 3 * 60 * 1000;
const FORFEIT_TIMEOUT_MS = 30 * 1000;
const DEPOSIT_TIMEOUT_MS = 30 * 1000;
const QUEUE_BAN_MS = 5 * 60 * 1000;

export default (io) => {
  io.use(verifySocketAuth);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[duel] User connected: ${user.id}`);

    socket.on('queue:join', async ({ tier }) => {
      try {
        const normalizedTier = normalizeTier(tier);
        if (!normalizedTier) {
          return socket.emit('error', { message: 'Invalid tier' });
        }

        const { data: existing } = await supabase
          .from('duel_queue')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'banned')
          .gt('ban_until', new Date().toISOString())
          .maybeSingle();

        if (existing) {
          return socket.emit('queue:banned', {
            until: existing.ban_until,
            message: 'You are temporarily banned from the queue for not depositing.',
          });
        }

        await supabase.from('duel_queue').insert({
          user_id: user.id,
          tier: normalizedTier,
          stake_sol: tierToStakeSol(normalizedTier),
          status: 'waiting',
        });

        socket.join(`queue:${normalizedTier}`);
        socket.emit('queue:joined', { tier: normalizedTier });

        await tryMatchmaking(io, normalizedTier, user.id, socket);
      } catch (err) {
        console.error('[duel] queue:join error:', err);
        socket.emit('error', { message: 'Failed to join queue' });
      }
    });

    socket.on('queue:leave', async () => {
      await supabase
        .from('duel_queue')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'waiting');
      socket.emit('queue:left');
    });

    socket.on('duel:deposit_confirmed', async ({ matchId, txSignature }) => {
      try {
        const { data: duel } = await supabase
          .from('duel_sessions')
          .select('*')
          .eq('id', matchId)
          .single();

        if (!duel) return socket.emit('error', { message: 'Match not found' });

        const isPlayerA = duel.player_a_id === user.id;
        const isPlayerB = duel.player_b_id === user.id;

        if (!isPlayerA && !isPlayerB) {
          return socket.emit('error', { message: 'Not a participant' });
        }

        await supabase
          .from('duel_sessions')
          .update({ escrow_pda: txSignature })
          .eq('id', matchId);

        const { data: updated } = await supabase
          .from('duel_sessions')
          .select('*')
          .eq('id', matchId)
          .single();

        if (updated.player_a_deposited && updated.player_b_deposited) {
          await startDuel(io, updated);
        }
      } catch (err) {
        console.error('[duel] deposit_confirmed error:', err);
      }
    });

    socket.on('duel:move', async ({ matchId, move }) => {
      try {
        await handleDuelMove(io, socket, user, matchId, move);
      } catch (err) {
        console.error('[duel] move error:', err);
        socket.emit('error', { message: 'Move processing failed' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[duel] User disconnected: ${user.id}`);

      for (const [matchId, state] of activeDuels.entries()) {
        if (state.playerAId === user.id || state.playerBId === user.id) {
          state.forfeitTimers = state.forfeitTimers || {};
          state.forfeitTimers[user.id] = setTimeout(async () => {
            await handleForfeit(io, matchId, user.id);
          }, FORFEIT_TIMEOUT_MS);

          const opponentId = state.playerAId === user.id ? state.playerBId : state.playerAId;
          io.to(`duel:${matchId}`).emit('duel:opponent_disconnected', {
            message: 'Opponent disconnected. Auto-forfeit in 30 seconds.',
          });
          break;
        }
      }
    });

    socket.on('duel:reconnect', ({ matchId }) => {
      const state = activeDuels.get(matchId);
      if (!state) return;

      if (state.forfeitTimers?.[user.id]) {
        clearTimeout(state.forfeitTimers[user.id]);
        delete state.forfeitTimers[user.id];
        socket.join(`duel:${matchId}`);
        io.to(`duel:${matchId}`).emit('duel:opponent_reconnected');
        socket.emit('duel:state', buildStateSnapshot(state, user.id));
      }
    });
  });
};

async function tryMatchmaking(io, tier, currentUserId, socket) {
  const { data: opponents } = await supabase
    .from('duel_queue')
    .select('*, users!inner(id, wallet_address, username, rating)')
    .eq('tier', tier)
    .eq('status', 'waiting')
    .neq('user_id', currentUserId)
    .order('queued_at', { ascending: true })
    .limit(1);

  if (!opponents || opponents.length === 0) return;

  const opponent = opponents[0];
  const matchId = crypto.randomUUID();

  const { data: currentUser } = await supabase
    .from('users')
    .select('wallet_address, username, rating')
    .eq('id', currentUserId)
    .single();

  const stakeSol = tierToStakeSol(tier);

  await supabase.from('duel_sessions').insert({
    id: matchId,
    tier,
    stake_sol: stakeSol,
    pot_sol: stakeSol * 2,
    status: 'waiting_deposits',
    player_a_id: currentUserId,
    player_b_id: opponent.user_id,
    player_a_wallet: currentUser.wallet_address,
    player_b_wallet: opponent.users.wallet_address,
  });

  await supabase
    .from('duel_queue')
    .update({ status: 'matched', matched_at: new Date().toISOString() })
    .in('user_id', [currentUserId, opponent.user_id])
    .eq('status', 'waiting');

  socket.join(`duel:${matchId}`);
  socket.emit('duel:match_found', {
    matchId,
    tier,
    stakeSol,
    opponent: { username: opponent.users.username, rating: opponent.users.rating },
    yourWallet: currentUser.wallet_address,
    role: 'player_a',
  });

  const opponentSocket = findSocketByUserId(io, opponent.user_id);
  if (opponentSocket) {
    opponentSocket.join(`duel:${matchId}`);
    opponentSocket.emit('duel:match_found', {
      matchId,
      tier,
      stakeSol,
      opponent: { username: currentUser.username, rating: currentUser.rating },
      yourWallet: opponent.users.wallet_address,
      role: 'player_b',
    });
  }

  setTimeout(async () => {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', matchId)
      .single();

    if (session?.status === 'waiting_deposits') {
      await cancelMatchForTimeout(io, session);
    }
  }, DEPOSIT_TIMEOUT_MS);
}

async function startDuel(io, session) {
  const matchId = session.id;
  const puzzle = await getPuzzleForDuel(session.tier);

  const state = {
    matchId,
    playerAId: session.player_a_id,
    playerBId: session.player_b_id,
    playerAWallet: session.player_a_wallet,
    playerBWallet: session.player_b_wallet,
    tier: session.tier,
    stakeSol: session.stake_sol,
    playerA: {
      puzzlesSolved: 0,
      puzzlesFailed: 0,
      currentPuzzle: puzzle,
      currentSolutionIndex: 0,
    },
    playerB: {
      puzzlesSolved: 0,
      puzzlesFailed: 0,
      currentPuzzle: puzzle,
      currentSolutionIndex: 0,
    },
    startedAt: Date.now(),
    timerHandle: null,
    forfeitTimers: {},
  };

  activeDuels.set(matchId, state);

  await supabase
    .from('duel_sessions')
    .update({
      status: 'active',
      started_at: new Date().toISOString(),
      player_a_current_puzzle_id: puzzle.id,
      player_b_current_puzzle_id: puzzle.id,
    })
    .eq('id', matchId);

  const puzzlePayload = {
    id: puzzle.id,
    fen: puzzle.fen,
    rating: puzzle.rating,
    themes: puzzle.themes,
  };

  io.to(`duel:${matchId}`).emit('duel:start', {
    puzzle: puzzlePayload,
    durationMs: DUEL_DURATION_MS,
    startedAt: state.startedAt,
  });

  state.timerHandle = setTimeout(async () => {
    await endDuelByTimer(io, matchId);
  }, DUEL_DURATION_MS);
}

async function handleDuelMove(io, socket, user, matchId, move) {
  const state = activeDuels.get(matchId);
  if (!state) return socket.emit('error', { message: 'Duel not found' });

  const elapsed = Date.now() - state.startedAt;
  if (elapsed >= DUEL_DURATION_MS) {
    return socket.emit('error', { message: 'Time is up' });
  }

  const isPlayerA = state.playerAId === user.id;
  const playerState = isPlayerA ? state.playerA : state.playerB;
  const puzzle = playerState.currentPuzzle;

  if (!puzzle) return socket.emit('error', { message: 'No active puzzle' });

  const expectedMove = puzzle.solution[playerState.currentSolutionIndex];
  const isCorrect = move.toLowerCase() === expectedMove.toLowerCase();

  if (!isCorrect) {
    playerState.puzzlesFailed += 1;

    await supabase.from('duel_attempts').insert({
      duel_session_id: matchId,
      user_id: user.id,
      puzzle_id: puzzle.id,
      solved: false,
      time_taken_ms: Date.now() - state.startedAt,
    });

    await broadcastProgress(io, matchId, state);

    const nextPuzzle = await getPuzzleForDuel(state.tier);
    playerState.currentPuzzle = nextPuzzle;
    playerState.currentSolutionIndex = 0;

    socket.emit('duel:puzzle_failed', {
      nextPuzzle: { id: nextPuzzle.id, fen: nextPuzzle.fen, rating: nextPuzzle.rating },
      puzzlesFailed: playerState.puzzlesFailed,
      puzzlesSolved: playerState.puzzlesSolved,
    });
    return;
  }

  playerState.currentSolutionIndex += 1;

  if (playerState.currentSolutionIndex < puzzle.solution.length) {
    const replyMove = puzzle.solution[playerState.currentSolutionIndex];
    playerState.currentSolutionIndex += 1;

    socket.emit('duel:opponent_reply', { move: replyMove });

    if (playerState.currentSolutionIndex >= puzzle.solution.length) {
      await handlePuzzleSolved(io, socket, state, isPlayerA, matchId);
    }
    return;
  }

  await handlePuzzleSolved(io, socket, state, isPlayerA, matchId);
}

async function handlePuzzleSolved(io, socket, state, isPlayerA, matchId) {
  const playerState = isPlayerA ? state.playerA : state.playerB;
  const puzzle = playerState.currentPuzzle;
  const userId = isPlayerA ? state.playerAId : state.playerBId;

  playerState.puzzlesSolved += 1;

  await supabase.from('duel_attempts').insert({
    duel_session_id: matchId,
    user_id: userId,
    puzzle_id: puzzle.id,
    solved: true,
    time_taken_ms: Date.now() - state.startedAt,
  });

  await broadcastProgress(io, matchId, state);

  const nextPuzzle = await getPuzzleForDuel(state.tier);
  playerState.currentPuzzle = nextPuzzle;
  playerState.currentSolutionIndex = 0;

  socket.emit('duel:puzzle_solved', {
    nextPuzzle: { id: nextPuzzle.id, fen: nextPuzzle.fen, rating: nextPuzzle.rating },
    puzzlesSolved: playerState.puzzlesSolved,
    puzzlesFailed: playerState.puzzlesFailed,
  });
}

async function endDuelByTimer(io, matchId) {
  const state = activeDuels.get(matchId);
  if (!state) return;

  clearTimeout(state.timerHandle);

  const { winner, isDraw } = determineWinner(state);

  io.to(`duel:${matchId}`).emit('duel:ended', {
    reason: 'timer',
    playerA: {
      puzzlesSolved: state.playerA.puzzlesSolved,
      puzzlesFailed: state.playerA.puzzlesFailed,
    },
    playerB: {
      puzzlesSolved: state.playerB.puzzlesSolved,
      puzzlesFailed: state.playerB.puzzlesFailed,
    },
    isDraw,
    winnerId: winner,
  });

  await settleDuelOnChain(io, matchId, state, winner, isDraw);
  activeDuels.delete(matchId);
}

async function handleForfeit(io, matchId, forfeitingUserId) {
  const state = activeDuels.get(matchId);
  if (!state) return;

  clearTimeout(state.timerHandle);

  const winnerId = state.playerAId === forfeitingUserId ? state.playerBId : state.playerAId;

  io.to(`duel:${matchId}`).emit('duel:ended', {
    reason: 'forfeit',
    forfeitedBy: forfeitingUserId,
    winnerId,
    isDraw: false,
  });

  await settleDuelOnChain(io, matchId, state, winnerId, false, true);
  activeDuels.delete(matchId);
}

function determineWinner(state) {
  const a = state.playerA;
  const b = state.playerB;

  if (a.puzzlesSolved > b.puzzlesSolved) {
    return { winner: state.playerAId, isDraw: false };
  }
  if (b.puzzlesSolved > a.puzzlesSolved) {
    return { winner: state.playerBId, isDraw: false };
  }

  if (a.puzzlesFailed < b.puzzlesFailed) {
    return { winner: state.playerAId, isDraw: false };
  }
  if (b.puzzlesFailed < a.puzzlesFailed) {
    return { winner: state.playerBId, isDraw: false };
  }

  return { winner: null, isDraw: true };
}

async function settleDuelOnChain(io, matchId, state, winnerId, isDraw, isForfeit = false) {
  const { duelPayoutService } = await import('../services/duelPayoutService.js');

  try {
    let txSignature;

    if (isDraw) {
      txSignature = await duelPayoutService.refundDuel(matchId, state);
      await supabase
        .from('duel_sessions')
        .update({
          status: 'draw',
          ended_at: new Date().toISOString(),
          settle_tx_signature: txSignature,
        })
        .eq('id', matchId);
    } else {
      const winnerWallet = winnerId === state.playerAId ? state.playerAWallet : state.playerBWallet;

      txSignature = isForfeit
        ? await duelPayoutService.forfeitDuel(matchId, state, winnerId)
        : await duelPayoutService.settleDuel(matchId, state, winnerId);

      await supabase
        .from('duel_sessions')
        .update({
          status: isForfeit ? 'forfeited' : 'settled',
          winner_id: winnerId,
          ended_at: new Date().toISOString(),
          settle_tx_signature: txSignature,
          player_a_puzzles_solved: state.playerA.puzzlesSolved,
          player_b_puzzles_solved: state.playerB.puzzlesSolved,
          player_a_puzzles_failed: state.playerA.puzzlesFailed,
          player_b_puzzles_failed: state.playerB.puzzlesFailed,
        })
        .eq('id', matchId);
    }

    io.to(`duel:${matchId}`).emit('duel:settled', { txSignature, isDraw });
  } catch (err) {
    console.error('[duel] Settlement failed:', err.message);
    io.to(`duel:${matchId}`).emit('duel:settlement_failed', {
      message: 'Settlement failed — support has been notified.',
    });

    await supabase.from('audit_logs').insert({
      action: 'duel.settlement_failed',
      metadata: { matchId, error: err.message, winnerId, isDraw },
    });
  }
}

function broadcastProgress(io, matchId, state) {
  io.to(`duel:${matchId}`).emit('duel:progress', {
    playerA: {
      puzzlesSolved: state.playerA.puzzlesSolved,
      puzzlesFailed: state.playerA.puzzlesFailed,
    },
    playerB: {
      puzzlesSolved: state.playerB.puzzlesSolved,
      puzzlesFailed: state.playerB.puzzlesFailed,
    },
  });
}

function buildStateSnapshot(state, userId) {
  const isPlayerA = state.playerAId === userId;
  const myState = isPlayerA ? state.playerA : state.playerB;
  const oppState = isPlayerA ? state.playerB : state.playerA;
  return {
    puzzle: myState.currentPuzzle ? { id: myState.currentPuzzle.id, fen: myState.currentPuzzle.fen } : null,
    puzzlesSolved: myState.puzzlesSolved,
    puzzlesFailed: myState.puzzlesFailed,
    opponentPuzzlesSolved: oppState.puzzlesSolved,
    opponentPuzzlesFailed: oppState.puzzlesFailed,
    timeRemainingMs: DUEL_DURATION_MS - (Date.now() - state.startedAt),
  };
}

function findSocketByUserId(io, userId) {
  for (const [, socket] of io.sockets.sockets) {
    if (socket.user?.id === userId) return socket;
  }
  return null;
}

async function cancelMatchForTimeout(io, session) {
  const matchId = session.id;

  if (session.player_a_deposited || session.player_b_deposited) {
    const { duelPayoutService } = await import('../services/duelPayoutService.js');
    await duelPayoutService.refundDuel(matchId, {
      playerAWallet: session.player_a_wallet,
      playerBWallet: session.player_b_wallet,
      playerADeposited: session.player_a_deposited,
      playerBDeposited: session.player_b_deposited,
    });
  }

  const banUserId = session.player_a_deposited ? session.player_b_id : session.player_a_id;

  await supabase.from('duel_queue').insert({
    user_id: banUserId,
    tier: session.tier,
    stake_sol: session.stake_sol,
    status: 'banned',
    ban_until: new Date(Date.now() + QUEUE_BAN_MS).toISOString(),
  });

  await supabase.from('duel_sessions').update({ status: 'cancelled' }).eq('id', matchId);

  io.to(`duel:${matchId}`).emit('duel:cancelled', {
    reason: 'deposit_timeout',
    message: 'Match cancelled — opponent did not deposit in time.',
  });
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
