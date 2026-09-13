import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import AuthContext from './AuthContext';
import { getAccessToken } from '../services/api';

const SocketContext = createContext(null);

// The Socket.IO server lives on the same host as the REST API, just without
// the /api path prefix (see server/socket/index.js — attached to the same
// http.Server the Express app runs on).
const SOCKET_URL = (process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '');

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return;
    }

    // `auth` as a function (not a plain object) is called fresh on every
    // (re)connect attempt, so a socket that reconnects after the access
    // token has silently rotated still authenticates with the current one.
    const newSocket = io(SOCKET_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });

    // Set state immediately (not just on 'connect') so consumers can attach
    // listeners — including 'connect_error' — right away instead of racing it.
    setSocket(newSocket);
    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);

export default SocketContext;
