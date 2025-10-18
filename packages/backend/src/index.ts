import { appConfig } from './config';
import { createServer } from './server';

const app = createServer();

app.listen(appConfig.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on port ${appConfig.port}`);
});
