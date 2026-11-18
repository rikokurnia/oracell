import { OracleAggregator } from './aggregator.js';
import { createAggregatorServer } from './server.js';

const PORT = Number.parseInt(process.env.PORT ?? '4001', 10);

async function main() {
  const aggregator = new OracleAggregator();
  const server = createAggregatorServer(aggregator, PORT);

  await aggregator.start();

  server.listen(PORT, () => {
    console.log(`[oracell-aggregator] Listening on http://localhost:${PORT}`);
    console.log(`[oracell-aggregator] Publisher Schnorr Pubkey: ${aggregator.getPublisherPubkey()}`);
    console.log(`[oracell-aggregator] CKB RPC: ${aggregator.getCkbRpcUrl()}`);
  });

  const shutdown = () => {
    console.log('\n[oracell-aggregator] Shutting down...');
    aggregator.stop();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[oracell-aggregator] Fatal startup error:', err);
  process.exit(1);
});
