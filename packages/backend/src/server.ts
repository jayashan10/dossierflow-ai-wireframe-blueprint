import express from 'express';
import { generateRouter } from './routes/generate';
import { sourcesRouter } from './routes/sources';
import { templatesRouter } from './routes/templates';
import { programsRouter } from './routes/programs';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';

export function createServer() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/templates', templatesRouter);
  app.use('/api/sources', sourcesRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/programs', programsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
