
export enum AssetType {
  GOLD = '黄金',
  QUANT_FUND = '量化基金',
  BOND = '债券',
  NASDAQ = '纳斯达克100',
  BITCOIN = '比特币',
  CASH = '现金'
}

export interface Asset {
  id: string;
  code: string; // Stock or Fund Code (e.g., 510300, QQQ)
  name: string;
  type: AssetType;
  quantity: number;
  costBasis: number; // Average purchase price
  currentPrice: number; // Current market price
  lastUpdated: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  allocation: Record<AssetType, number>; // Percentage 0-100
  cashBalance: number;
}

export interface TargetStrategy {
  allocations: Record<AssetType, number>; // Target %
  maxDeviation: number; // Threshold for Red light (e.g., 20% relative deviation)
}

export interface MarketData {
  [assetName: string]: {
    price: number;
    change24h: number;
  }
}

export type TrafficLightStatus = 'green' | 'yellow' | 'red';

// Auth Types
export interface User {
  email: string;
  name: string;
}

export interface UserCloudData {
  assets: Asset[];
  cashBalance: number;
  strategy: TargetStrategy;
  lastSynced: number;
}
