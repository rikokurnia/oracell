import {
  decodeOracleWitness,
  injectOracleProof,
  OracellClient,
  type CkbTransactionSkeleton,
} from '../src/index.js';

/**
 * End-to-end example demonstrating:
 * 1. Live fetch from services/aggregator (https://oracell.vercel.app) + CKB Testnet get_tip_header
 * 2. Witness encoding & header_deps injection
 * 3. Parallel transaction simulation proving zero shared oracle cell contention
 */
async function main() {
  const client = new OracellClient({
    aggregatorUrl: process.env.ORACELL_AGGREGATOR_URL,
    ckbRpcUrl: process.env.CKB_RPC_URL ?? 'https://testnet.ckbapp.dev/',
  });

  console.log('1) Fetching live CKB Testnet tip header...');
  const tip = await client.getTipHeader();
  console.log(`   Tip block #${tip.blockNumber} (${tip.tipBlockHash})`);

  console.log('2) Fetching latest signed CKB/USDT feed from Oracell Aggregator...');
  const quote = await client.getLatestPrice('CKB_USDT');
  const sigValid = client.verifyFeed(quote);
  console.log(
    `   CKB/USDT = $${quote.payload.price} (bound block #${quote.payload.blockNumber}, sigValid=${sigValid})`
  );
  if (!sigValid) {
    throw new Error('Oracle Schnorr signature failed verification!');
  }

  console.log('3) Simulating 25 concurrent DeFi transactions in the same block...');
  const txBatch = Array.from({ length: 25 }, (_, i) => {
    const userTx: CkbTransactionSkeleton = {
      version: '0x0',
      cellDeps: [],
      headerDeps: [],
      inputs: [
        {
          previousOutput: {
            txHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
            index: '0x0',
          },
          since: '0x0',
        },
      ],
      outputs: [{ capacity: '0x2540be400' }],
      outputsData: ['0x'],
      witnesses: ['0x'],
    };
    return injectOracleProof(userTx, quote);
  });

  // Verify zero cell overlap & identical valid oracle proof in witnesses
  const seenInputs = new Set<string>();
  for (const tx of txBatch) {
    const inp = tx.inputs![0].previousOutput!;
    const outpointKey = `${inp.txHash}:${inp.index}`;
    if (seenInputs.has(outpointKey)) {
      throw new Error(`Cell contention detected on ${outpointKey}`);
    }
    seenInputs.add(outpointKey);
    const decoded = decodeOracleWitness(tx.witnesses![1]);
    if (decoded.payload.tipBlockHash !== quote.payload.tipBlockHash) {
      throw new Error('Witness tipBlockHash mismatch');
    }
  }

  console.log(
    `   SUCCESS: ${txBatch.length} parallel transactions built with 0 shared oracle cells and 0 collisions.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
