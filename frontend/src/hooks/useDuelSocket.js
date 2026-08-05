import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export const useDuelSocket = () => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [matchState, setMatchState] = useState(null);
  const [queueState, setQueueState] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('auth_token') || '';
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;
    return () => socket.disconnect();
  }, []);

  const joinQueue = (tier) => {
    socketRef.current?.emit('queue:join', { tier });
    setQueueState('waiting');
  };

  const leaveQueue = () => {
    socketRef.current?.emit('queue:leave');
    setQueueState(null);
  };

  const confirmDeposit = (matchId, txSignature) => {
    socketRef.current?.emit('duel:deposit_confirmed', { matchId, txSignature });
  };

  const submitMove = (matchId, move) => {
    socketRef.current?.emit('duel:move', { matchId, move });
  };

  const onMatchFound = (cb) => socketRef.current?.on('duel:match_found', cb);
  const onDuelStart = (cb) => socketRef.current?.on('duel:start', cb);
  const onProgress = (cb) => socketRef.current?.on('duel:progress', cb);
  const onPuzzleSolved = (cb) => socketRef.current?.on('duel:puzzle_solved', cb);
  const onPuzzleFailed = (cb) => socketRef.current?.on('duel:puzzle_failed', cb);
  const onOpponentReply = (cb) => socketRef.current?.on('duel:opponent_reply', cb);
  const onDuelEnded = (cb) => socketRef.current?.on('duel:ended', cb);
  const onDuelSettled = (cb) => socketRef.current?.on('duel:settled', cb);
  const onOpponentDisconnected = (cb) => socketRef.current?.on('duel:opponent_disconnected', cb);
  const onCancelled = (cb) => socketRef.current?.on('duel:cancelled', cb);
  const onBanned = (cb) => socketRef.current?.on('queue:banned', cb);

  return {
    connected,
    joinQueue,
    leaveQueue,
    confirmDeposit,
    submitMove,
    onMatchFound,
    onDuelStart,
    onProgress,
    onPuzzleSolved,
    onPuzzleFailed,
    onOpponentReply,
    onDuelEnded,
    onDuelSettled,
    onOpponentDisconnected,
    onCancelled,
    onBanned,
    socket: socketRef.current,
  };
};
