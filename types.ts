
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
  basePrice?: number; // Price as of Jan 1st for YTD calculation
  currency?: 'CNY' | 'USD';
  lastUpdated: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
  allocation: Record<AssetType, number>; // Percentage 0-100
  typeDetails: Record<AssetType, { value: number; cost: number; return: number; returnPercent: number }>;
  cashBalance: number;
  realizedLoss: number;
  realizedProfit: number;
}

export interface TargetStrategy {
  allocations: Record<AssetType, number>; // Target %
  maxDeviation: number; // Threshold for Red light (e.g., 20% relative deviation)
  customNames?: Partial<Record<AssetType, string>>; // Custom names for asset categories
}

export interface SettlementConfig {
  profitThreshold1: number; // e.g., 3
  profitThreshold2: number; // e.g., 5
  sharingRate1: number; // e.g., 20
  sharingRate2: number; // e.g., 50
  guaranteeThreshold: number; // e.g., 3
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
  uid: string;
  email: string;
  name: string;
}

export interface Mortgage {
  id: string;
  name: string;
  initialPrincipal: number; // 初始录入时的剩余房贷金额
  interestRate: number; // 房贷利率 (e.g., 4.1 for 4.1%)
  remainingMonths: number; // 初始录入时的剩余还款月份数
  monthlyPayment: number; // 当前每月还款金额
  repaymentDate: number; // 每月还款日期 (1-31)
  startDate: string; // 录入日期
}

export interface UserCloudData {
  assets: Asset[];
  cashBalance: number;
  realizedLoss?: number;
  realizedProfit?: number;
  strategy: TargetStrategy;
  settlementConfig?: SettlementConfig;
  mortgages?: Mortgage[];
  lastSynced: number;
}
