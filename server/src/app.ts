import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { errorHandler, notFoundHandler } from './middlewares/errors.js';
import { authRouter } from './routes/auth.js';
import { gameRouter } from './routes/game.js';
import { adminRouter, statsRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(helmet());
  // Origine exacte + credentials : le joker « * » est interdit avec les cookies. `cors` ajoute Vary: Origin.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, maxAge: 600 }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use(gameRouter);
  app.use('/admin', adminRouter);
  app.use('/stats', statsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
