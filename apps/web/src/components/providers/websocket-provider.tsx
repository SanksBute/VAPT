'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

interface WebSocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  subscribe: (event: string, handler: (data: unknown) => void) => () => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  socket: null,
  isConnected: false,
  subscribe: () => () => undefined,
  joinRoom: () => undefined,
  leaveRoom: () => undefined,
});

export function useWebSocket(): WebSocketContextValue {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { isAuthenticated, accessToken } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const wsUrl = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001';

    const socket = io(wsUrl, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('WebSocket connection error:', err.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, accessToken]);

  const subscribe = (event: string, handler: (data: unknown) => void): (() => void) => {
    const socket = socketRef.current;
    if (!socket) return () => undefined;

    socket.on(event, handler);
    return () => socket.off(event, handler);
  };

  const joinRoom = (room: string): void => {
    socketRef.current?.emit('subscribe:scan', { scanId: room });
  };

  const leaveRoom = (room: string): void => {
    socketRef.current?.emit('unsubscribe:scan', { scanId: room });
  };

  return (
    <WebSocketContext.Provider value={{ socket: socketRef.current, isConnected, subscribe, joinRoom, leaveRoom }}>
      {children}
    </WebSocketContext.Provider>
  );
}
