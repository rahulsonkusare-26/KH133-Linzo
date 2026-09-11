import jwt from 'jsonwebtoken';

export function requireSocketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token || null;
    if (!token) return next(new Error('Authentication required'));

    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    socket.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch (e) {
    return next(new Error('Invalid or expired token'));
  }
}


