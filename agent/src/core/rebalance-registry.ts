import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";

// IDL will be generated after `anchor build` — import from target/
// For now, we inline the minimal structure needed to deserialize the PDA.

const REBALANCE_SEED = Buffer.from("rebalance");

export interface RebalanceConfig {
  owner: PublicKey;
  positionId: string;
  enabled: boolean;
  crossPool: boolean;
  createdAt: number; // i64 as BN → number
  updatedAt: number;
  bump: number;
}

/**
 * Derive the PDA address for a rebalance config.
 */
export function findRebalanceConfigPDA(
  programId: PublicKey,
  owner: PublicKey,
  positionId: string
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REBALANCE_SEED, owner.toBuffer(), Buffer.from(positionId)],
    programId
  );
}

/**
 * Check if auto-rebalance is enabled for a given owner + position.
 * Returns null if the PDA doesn't exist (user never opted in).
 */
export async function isRebalanceEnabled(
  connection: Connection,
  programId: PublicKey,
  owner: PublicKey,
  positionId: string
): Promise<{ enabled: boolean; crossPool: boolean } | null> {
  const [pda] = findRebalanceConfigPDA(programId, owner, positionId);

  const accountInfo = await connection.getAccountInfo(pda);
  if (!accountInfo) {
    return null; // No PDA = not opted in
  }

  // Deserialize manually (avoids needing full IDL at runtime)
  // Layout: 8 (discriminator) + 32 (owner) + 4+N (string) + 1 (enabled) + 1 (crossPool) + 8 + 8 + 1
  const data = accountInfo.data;
  const offset = 8 + 32; // skip discriminator + owner pubkey

  // Read string length (4 bytes LE)
  const strLen = data.readUInt32LE(offset);
  const stringEnd = offset + 4 + strLen;

  const enabled = data[stringEnd] === 1;
  const crossPool = data[stringEnd + 1] === 1;

  return { enabled, crossPool };
}
