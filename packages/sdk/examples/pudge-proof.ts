import { readFile } from 'node:fs/promises';
import { ccc } from '@ckb-ccc/core';
import { injectOracleProof, OracellClient } from '../src/index.js';

const RPC = 'https://testnet.ckbapp.dev/';
const FEE_RATE = 1_000n;

async function main() {
  const [mode, argument] = process.argv.slice(2);
  const keyFile = process.env.ORACELL_PUDGE_WALLET_KEY_FILE;
  if (!keyFile || !['balance', 'deploy', 'prove', 'confirm'].includes(mode)) {
    throw new Error('Set ORACELL_PUDGE_WALLET_KEY_FILE and choose balance, deploy <binary>, prove <deploy hash>, or confirm <tx hash>.');
  }

  const rawKey = (await readFile(keyFile, 'utf8')).trim();
  const client = new ccc.ClientPublicTestnet({ url: RPC, fallbacks: [] });
  const signer = new ccc.SignerCkbPrivateKey(client, ccc.hexFrom(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`));
  const { script: lock } = await signer.getRecommendedAddressObj();
  if (mode === 'balance') {
    console.log(JSON.stringify({ capacityShannons: (await signer.getBalance()).toString() }));
    return;
  }

  if (!argument) throw new Error('Supply the verifier binary path or transaction hash.');
  if (mode === 'confirm') {
    const result = await client.waitTransaction(argument, 1, 180_000);
    if (result?.status !== 'committed') throw new Error('Transaction did not commit');
    console.log(JSON.stringify({ txHash: argument, status: result.status, blockNumber: result.blockNumber?.toString(), blockHash: result.blockHash }));
    return;
  }

  const tx = ccc.Transaction.from({});
  let proofMeta = {};
  if (mode === 'deploy') {
    const binary = await readFile(argument);
    tx.addOutput({ lock }, binary);
    proofMeta = { index: 0, codeHash: ccc.hashCkb(binary), hashType: 'data2', binaryBytes: binary.length,
      capacityShannons: tx.outputs[0].capacity.toString() };
    await tx.completeInputsByCapacity(signer);
  } else {
    const expectedPubkey = process.env.ORACELL_PUBLISHER_PUBKEY;
    if (!expectedPubkey) throw new Error('Set the trusted hosted publisher pubkey before submitting.');
    const outPoint = ccc.OutPoint.from({ txHash: argument, index: 0 });
    const codeCell = await client.getCellLive(outPoint, true);
    if (!codeCell || codeCell.outputData === '0x') throw new Error('Verifier code cell is not live.');
    const codeHash = ccc.hashCkb(codeCell.outputData);
    tx.addCellDeps({ outPoint, depType: 'code' });
    tx.addOutput({ lock, type: { codeHash, hashType: 'data2', args: expectedPubkey } });
    await tx.completeInputsByCapacity(signer);

    const oracle = new OracellClient();
    const quote = await oracle.getLatestPrice('CKB/USDT');
    if (!oracle.verifyFeed(quote, expectedPubkey)) throw new Error('Untrusted quote signature.');
    if (quote.payload.flags & 2) throw new Error('Oracle circuit breaker is tripped.');
    const tip = await oracle.getTipHeader();
    const lag = tip.blockNumber - quote.payload.blockNumber;
    if (lag < 0 || lag > 2) throw new Error(`Quote lag is ${lag} blocks. Retry with a fresh quote.`);
    const anchorAtHeight = await client.getHeaderByNumber(quote.payload.blockNumber);
    if (anchorAtHeight?.hash !== quote.payload.tipBlockHash) throw new Error('Quote anchor differs from the canonical header.');
    const injected = injectOracleProof({ headerDeps: [tip.tipBlockHash], witnesses: ['0x'] }, quote, {
      wrapInWitnessArgs: true,
      witnessIndex: 0,
    });
    tx.headerDeps = injected.headerDeps.map(ccc.hexFrom);
    tx.witnesses = injected.witnesses.map(ccc.hexFrom);
    proofMeta = { codeHash, publisherPubkey: expectedPubkey, pair: quote.pair,
      quoteBlock: quote.payload.blockNumber, anchorHash: quote.payload.tipBlockHash,
      referenceTip: tip.blockNumber, priceScaled: quote.payload.priceScaled };
  }

  await tx.completeFeeBy(signer, FEE_RATE, undefined, { shouldAddInputs: mode === 'deploy' });
  const signed = await signer.signTransaction(tx);
  const cycles = (await client.estimateCycles(signed)).toString();
  const txHash = await client.sendTransaction(signed, 'passthrough');
  // Print the hash before waiting so an RPC timeout cannot hide a broadcast.
  console.log(JSON.stringify({ txHash, cycles, ...proofMeta }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
