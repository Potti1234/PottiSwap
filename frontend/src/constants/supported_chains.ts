// Common chain configurations
export const SUPPORTED_CHAINS = [
  { id: 1, name: "Ethereum Mainnet", symbol: "ETH", isTestnet: false },
  { id: 11155111, name: "Sepolia Testnet", symbol: "ETH", isTestnet: true },
  { id: 84532, name: "Base Sepolia Testnet", symbol: "ETH", isTestnet: true },
  { id: 8453, name: "Base", symbol: "ETH", isTestnet: false },
] as const;
