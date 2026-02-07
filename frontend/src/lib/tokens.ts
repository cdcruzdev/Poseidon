/**
 * Token definitions for the LP aggregator
 * Logo URLs from CoinGecko CDN
 */

export interface Token {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logo: string;
  coingeckoId?: string;
}

export const TOKENS: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/4128/standard/solana.png",
    coingeckoId: "solana",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/6319/standard/usdc.png",
    coingeckoId: "usd-coin",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/325/standard/Tether.png",
    coingeckoId: "tether",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/34188/standard/jup.png",
    coingeckoId: "jupiter-exchange-solana",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logo: "https://assets.coingecko.com/coins/images/28600/standard/bonk.jpg",
    coingeckoId: "bonk",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/33566/standard/dogwifhat.jpg",
    coingeckoId: "dogwifcoin",
  },
  {
    symbol: "JTO",
    name: "Jito",
    mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/33228/standard/jto.png",
    coingeckoId: "jito-governance-token",
  },
  {
    symbol: "RAY",
    name: "Raydium",
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/13928/standard/PSigc4ie_400x400.jpg",
    coingeckoId: "raydium",
  },
  {
    symbol: "ORCA",
    name: "Orca",
    mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/17547/standard/Orca_Logo.png",
    coingeckoId: "orca",
  },
  {
    symbol: "mSOL",
    name: "Marinade SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    logo: "https://assets.coingecko.com/coins/images/17752/standard/mSOL.png",
    coingeckoId: "msol",
  },
  {
    symbol: "JLP",
    name: "Jupiter LP",
    mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/34700/standard/JLP.png",
    coingeckoId: "jupiter-perpetuals-liquidity-provider-token",
  },
  {
    symbol: "PYTH",
    name: "Pyth Network",
    mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/31924/standard/pyth.png",
    coingeckoId: "pyth-network",
  },
  {
    symbol: "W",
    name: "Wormhole",
    mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
    decimals: 6,
    logo: "https://assets.coingecko.com/coins/images/35087/standard/wormhole_logo_full_color_rgb_800px__72ppi_.png",
    coingeckoId: "wormhole",
  },
];

export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
}

export function getTokenByMint(mint: string): Token | undefined {
  return TOKENS.find((t) => t.mint === mint);
}
