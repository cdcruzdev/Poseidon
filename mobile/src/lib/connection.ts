import { Connection } from '@solana/web3.js';

// In production, this should be proxied through a backend.
// For now, using direct RPC with key from app config.
const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';

export const connection = new Connection(RPC_URL, 'confirmed');
