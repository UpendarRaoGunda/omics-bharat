import { createServer } from 'node:http';
import { handler } from './src/handler.js';

const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const server = createServer(handler);

server.listen(port, host, () => {
  console.log(`Omics Bharat is running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
