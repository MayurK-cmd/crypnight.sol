import { useEffect, useRef, useState } from 'react';

export const useDuelWebSocket = () => {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Map());

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setConnected(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, '').replace('/api', '') || 'localhost:5000'}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      console.log('[duel-ws] Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { type, ...data } = msg;

        const listeners = listenersRef.current.get(type) || [];
        listeners.forEach(cb => cb(data));
      } catch (err) {
        console.error('[duel-ws] Invalid message:', err);
      }
    };

    ws.onerror = () => {
      console.error('[duel-ws] WebSocket error');
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('[duel-ws] Disconnected');
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, []);

  const emit = (type, data = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  };

  const on = (type, callback) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, []);
    }
    listenersRef.current.get(type).push(callback);

    return () => {
      const listeners = listenersRef.current.get(type) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  };

  const joinQueue = (tier) => emit('queue:join', { tier });
  const leaveQueue = () => emit('queue:leave', {});
  const confirmDeposit = (matchId, txSignature) => emit('duel:deposit_confirmed', { matchId, txSignature });
  const submitMove = (matchId, move) => emit('duel:move', { matchId, move });

  return {
    connected,
    joinQueue,
    leaveQueue,
    confirmDeposit,
    submitMove,
    on,
    emit,
    ws: wsRef.current,
  };
};
