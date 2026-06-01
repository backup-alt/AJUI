import { createServer } from 'vite';

const port = Number(process.env.PORT || 5173);

const server = await createServer({
  root: process.cwd(),
  server: {
    host: '0.0.0.0',
    port,
  },
});

await server.listen();
server.printUrls();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});
