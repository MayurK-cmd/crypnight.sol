import WebSocket from 'ws';
import { DuelManager } from './duelManager.js';
import { supabase } from '../config/supabase.js';
import { settleDuel, refundDuel, forfeitDuel } from './duelPayoutService.js';
import { getPuzzleByRating } from './puzzleLoader.js';

// Store active WebSocket connections by user ID for broadcasting
const userSockets = new Map();

// Tier to rating band mapping
const TIER_RATING_BANDS = {
  beginner: [100, 1200],
  intermediate: [1000, 1800],
  pro: [1500, 2200],
  gm: [2000, 2800],
};

const messageHandlers = {
  'queue:join': handleQueueJoin,
  'queue:leave': handleQueueLeave,
  'deposit:confirm': handleDepositConfirm,
  'move:submit': handleMoveSubmit,
  'reconnect': handleReconnect,
};

async function handleQueueJoin(ws, data) {
  const { tier } = data;
  const userId = ws.userId; // Use authenticated user ID from JWT

  try {
    const match = DuelManager.addToQueue(userId, tier);

    if (match) {
      // Match found
      ws.playerAId = match.playerAId;
      ws.playerBId = match.playerBId;

      // Create duel session in DB
      const STAKE_BY_TIER = {
        beginner: 0.05,
        intermediate: 0.10,
        pro: 0.25,
        gm: 0.50,
      };
      const stakeSol = STAKE_BY_TIER[tier] || 0.05;

      const { data: sessionData, error: insertError } = await supabase
        .from('duel_sessions')
        .insert({
          tier,
          stake_sol: stakeSol,
          pot_sol: stakeSol * 2,
          status: 'waiting_deposits',
          player_a_id: match.playerAId,
          player_b_id: match.playerBId,
          player_a_wallet: data.playerAWallet || '',
          player_b_wallet: data.playerBWallet || '',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[duelSocket] Insert error:', insertError);
        throw new Error(`Failed to create duel session: ${insertError.message}`);
      }

      if (!sessionData) {
        console.error('[duelSocket] No session data returned after insert');
        throw new Error('Failed to create duel session: no data returned');
      }

      ws.sessionId = sessionData.id;

      // Notify both players that match was found
      const matchMessage = JSON.stringify({
        type: 'match:found',
        sessionId: sessionData.id,
        tier,
        stake_sol: sessionData.stake_sol,
        depositTimeoutSeconds: 30,
      });

      // Send to both players if they're connected
      ws.send(matchMessage);

      const otherPlayerId = userId === match.playerAId ? match.playerBId : match.playerAId;
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(matchMessage);
      }
    } else {
      ws.send(JSON.stringify({
        type: 'queue:waiting',
        tier,
        queuePosition: DuelManager.getQueueStatus(tier),
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleQueueLeave(ws, data) {
  const { tier } = data;
  DuelManager.removeFromQueue(ws.userId, tier);
  ws.send(JSON.stringify({ type: 'queue:left' }));
}

async function handleDepositConfirm(ws, data) {
  const { sessionId, txSignature } = data;

  try {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');

    // Mark both players as ready when both confirm
    const result = await DuelManager.confirmDeposit(sessionId, ws.userId);

    if (result === 'active') {
      // Load puzzle for this duel session (one puzzle for both players)
      const [minRating, maxRating] = TIER_RATING_BANDS[session.tier];
      const puzzle = await getPuzzleByRating(minRating, maxRating);

      if (!puzzle) throw new Error('Failed to load puzzle');

      // Store puzzle in duel session
      await supabase
        .from('duel_sessions')
        .update({
          current_puzzle_id: puzzle.puzzle_id || puzzle.PuzzleId,
          current_puzzle_fen: puzzle.fen || puzzle.FEN,
        })
        .eq('id', sessionId);

      // Send puzzle to both players
      const startPayload = {
        type: 'duel:start',
        sessionId,
        puzzle: {
          puzzle_id: puzzle.puzzle_id || puzzle.PuzzleId,
          fen: puzzle.fen || puzzle.FEN,
          rating: puzzle.rating || puzzle.Rating,
        },
        timerSeconds: 180,
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(startPayload));

      // Send to other player if connected
      const otherPlayerId = session.player_a_id === ws.userId ? session.player_b_id : session.player_a_id;
      const otherPlayerWs = userSockets.get(otherPlayerId);
      if (otherPlayerWs && otherPlayerWs.readyState === WebSocket.OPEN) {
        otherPlayerWs.send(JSON.stringify(startPayload));
      }
    } else {
      ws.send(JSON.stringify({
        type: 'deposit:confirmed',
        waiting: true,
      }));
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleMoveSubmit(ws, data) {
  const { sessionId, move } = data;

  try {
    const { data: session } = await supabase
      .from('duel_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session || session.status !== 'active') throw new Error('Duel not active');

    const result = await DuelManager.submitMove(sessionId, ws.userId, move);

    if (result.result === 'failed') {
      // Puzzle failed — notify both players
      ws.send(JSON.stringify({
        type: 'puzzle:failed',
      }));
    } else if (result.result === 'continue') {
      ws.send(JSON.stringify({ type: 'move:valid' }));
    }
  } catch (error) {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

async function handleReconnect(ws, data) {
  const { sessionId } = data;

  const { data: session } = await supabase
    .from('duel_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
    return;
  }

  ws.sessionId = sessionId;
  ws.userId = ws.userId;

  ws.send(JSON.stringify({
    type: 'reconnect:success',
    sessionId,
  }));
}

export function setupDuelWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    if (request.url === '/ws/duel') {
      // Extract JWT from cookies or headers
      const cookies = request.headers.cookie || '';
      const authToken = cookies
        .split(';')
        .find(c => c.trim().startsWith('auth_token='))
        ?.split('=')[1];

      if (!authToken) {
        socket.destroy();
        return;
      }

      // Verify token and get user ID
      try {
        const { data } = await supabase.auth.getUser(authToken);
        if (!data?.user?.id) {
          socket.destroy();
          return;
        }
        request.userId = data.user.id;
      } catch (err) {
        console.error('[duelSocket] Auth error:', err.message);
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    const userId = request.userId;
    console.log('Client connected to duel WebSocket:', userId);

    // Attach userId to WebSocket connection
    ws.userId = userId;

    // Store this user's WebSocket connection
    userSockets.set(userId, ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        const handler = messageHandlers[data.type];

        if (handler) {
          await handler(ws, data);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    });

    ws.on('close', () => {
      userSockets.delete(userId);
      if (ws.sessionId && ws.userId) {
        DuelManager.handleDisconnect(ws.sessionId, ws.userId);
      }
      console.log('Client disconnected from duel WebSocket:', userId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  return wss;
}

