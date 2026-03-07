import { appConfig } from './config';
import { createServer } from './server';
import { logProviderAuthStatus } from './services/agent-provider';

const app = createServer();

app.listen(appConfig.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on port ${appConfig.port}`);
  
  // Log AI provider authentication status
  logProviderAuthStatus();
});
