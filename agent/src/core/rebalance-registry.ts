import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("HLsgAVzjjBaBR9QCLqV3vjC9LTnR2xtmtB77j1EJQBsZ");
const REBALANCE_SEED = Buffer.from("rebalance");

export interface RebalanceConfig {
  owner: PublicKey;
  enabled: boolean;
  maxSlippageBps: number;
  minYieldImprovementBps: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Derive the PDA address for a rebalance config.
 * Seeds: ["rebalance", owner]
 */
export function findRebalanceConfigPDA(
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REBALANCE_SEED, owner.toBuffer()],
    programId
  );
}

/**
 * Fetch the full rebalance config for an owner.
 * Returns null if the PDA doesn't exist (user never opted in).
 */
export async function fetchRebalanceConfig(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<RebalanceConfig | null> {
  const [pda] = findRebalanceConfigPDA(owner, programId);

  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo || accountInfo.data.length < 61) {
    return null;
  }

  const data = accountInfo.data;
  // Layout: 8 discriminator + 32 owner + 1 enabled + 2 max_slippage + 2 min_yield + 8 created + 8 updated
  let offset = 8; // skip discriminator
  const ownerKey = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const enabled = data[offset] === 1;
  offset += 1;
  const maxSlippageBps = data.readUInt16LE(offset);
  offset += 2;
  const minYieldImprovementBps = data.readUInt16LE(offset);
  offset += 2;
  const createdAt = Number(data.readBigInt64LE(offset));
  offset += 8;
  const updatedAt = Number(data.readBigInt64LE(offset));

  return { owner: ownerKey, enabled, maxSlippageBps, minYieldImprovementBps, createdAt, updatedAt };
}

/**
 * Check if auto-rebalance is enabled for a given owner.
 */
export async function isRebalanceEnabled(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey = PROGRAM_ID
): Promise<boolean> {
  const config = await fetchRebalanceConfig(connection, owner, programId);
  return config?.enabled ?? false;
}

export { PROGRAM_ID };
