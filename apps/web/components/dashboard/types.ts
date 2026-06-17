/**
 * Shared DTOs for the user dashboard surface — mirrors GET /api/user-stats and
 * the getUserStats agent tool output. Kept in one place so the dashboard page,
 * the chat card, and the presentational components agree on shape.
 */

export interface UserStatsData {
  txCount: number;
  volumeUsd: number;
  actions: { transfer: number; swap: number; lend: number; bridge: number; limit: number };
  distinctActions: number;
  firstTs: string | null;
}

export interface BadgeStateDto {
  id: string;
  name: string;
  blurb: string;
  earned: boolean;
}

export interface WalletCoinDto {
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: number;
  price: number;
  verified: boolean;
  logo: string;
}

export interface WalletOverviewDto {
  degraded: boolean;
  totalUsdValue: number | null;
  coins: WalletCoinDto[];
  onchainTxCount: number | null;
  recent: Array<{ digest: string; type: string; timestampMs: number | null }>;
}

export interface ReceiptDto {
  timestamp: string;
  actionLabel: string;
  txDigest: string;
  usdValue: number;
}

export interface DailyUsageDto {
  usedUsd: number;
  capUsd: number | null;
}

/** The full /api/user-stats response (chat tool omits route-only fields). */
export interface UserStatsApiResponse {
  walletAddress: string;
  stats: UserStatsData;
  badges: { earned: BadgeStateDto[]; locked: BadgeStateDto[] };
  wallet?: WalletOverviewDto;
  recentReceipts?: ReceiptDto[];
  dailyUsage?: DailyUsageDto;
  memoryEnabled?: boolean;
}
