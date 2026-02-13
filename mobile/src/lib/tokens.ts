export interface TokenInfo {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  coingeckoId: string;
  logoUrl: string;
}

export const TOKENS: TokenInfo[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    coingeckoId: 'solana',
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    coingeckoId: 'usd-coin',
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    coingeckoId: 'tether',
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
    coingeckoId: 'jupiter-exchange-solana',
    logoUrl: 'https://static.jup.ag/jup/icon.png',
  },
  {
    symbol: 'BONK',
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    decimals: 5,
    coingeckoId: 'bonk',
    logoUrl: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  },
  {
    symbol: 'WIF',
    name: 'dogwifhat',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    decimals: 6,
    coingeckoId: 'dogwifcoin',
    logoUrl: 'https://bafkreibk3covs5ltyqxa272uodhber7flse52gqsv6aho4turjax3cs6oe.ipfs.nftstorage.link',
  },
];

export const TOKEN_BY_SYMBOL: Record<string, TokenInfo> = {};
export const TOKEN_BY_MINT: Record<string, TokenInfo> = {};
for (const t of TOKENS) {
  TOKEN_BY_SYMBOL[t.symbol] = t;
  TOKEN_BY_MINT[t.mint] = t;
}
