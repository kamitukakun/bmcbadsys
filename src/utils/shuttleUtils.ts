import { ShuttleStock, ShuttlePurchaseLot } from '../types';

/**
 * シャトルの総保有球数（本数）を計算
 */
export function getShuttleTotalBalls(shuttle: ShuttleStock): number {
  const ballsPerTube = shuttle.ballsPerTube || 12;
  const tubes = Math.max(0, shuttle.tubesInStock || 0);
  const loose = Math.max(0, shuttle.looseBallsInStock || 0);
  return tubes * ballsPerTube + loose;
}

/**
 * 総球数（本数）から筒数（ダース）とバラ本数に正規化
 */
export function normalizeBallsToTubes(totalBalls: number, ballsPerTube = 12): { tubes: number; loose: number } {
  const safeTotal = Math.max(0, Math.round(totalBalls));
  const tubes = Math.floor(safeTotal / ballsPerTube);
  const loose = safeTotal % ballsPerTube;
  return { tubes, loose };
}

/**
 * 筒数とバラ本数から総球数（本数）を計算
 */
export function combineTubesAndLoose(tubes: number, loose: number, ballsPerTube = 12): number {
  const safeTubes = Math.max(0, Number(tubes) || 0);
  const safeLoose = Math.max(0, Number(loose) || 0);
  return safeTubes * ballsPerTube + safeLoose;
}

/**
 * シャトル在庫の文字列表記 (例: "8筒 4本 (計100本)")
 */
export function formatShuttleStockText(shuttle: ShuttleStock): string {
  const total = getShuttleTotalBalls(shuttle);
  const { tubes, loose } = normalizeBallsToTubes(total, shuttle.ballsPerTube || 12);
  if (loose === 0) {
    return `${tubes}筒 (${total}本)`;
  }
  return `${tubes}筒 + ${loose}本 (${total}本)`;
}

/**
 * シャトル在庫の原価総額（現在庫の総原価）
 * 在庫加重平均方式: totalCostInStock が保持されていればそれを優先。
 * 既存データで未設定の場合は保有球数 × (pricePerTube ÷ 12) で安全に算出。
 */
export function getShuttleTotalOriginalCost(shuttle: ShuttleStock): number {
  const totalBalls = getShuttleTotalBalls(shuttle);
  if (totalBalls <= 0) return 0;

  if (typeof shuttle.totalCostInStock === 'number' && !isNaN(shuttle.totalCostInStock)) {
    return Math.max(0, Math.round(shuttle.totalCostInStock));
  }

  const bpt = shuttle.ballsPerTube || 12;
  if (bpt <= 0) return 0;
  return Math.max(0, Math.round(totalBalls * (shuttle.pricePerTube / bpt)));
}

/**
 * シャトルの1球（1本）あたりの現在庫加重平均原価 (円、四捨五入整数)
 * 計算式: 現在の在庫総原価 ÷ 現在の在庫本数
 */
export function getShuttleCostPerBall(shuttle: ShuttleStock): number {
  const totalBalls = getShuttleTotalBalls(shuttle);
  const bpt = shuttle.ballsPerTube || 12;

  if (totalBalls <= 0) {
    // 在庫0本の場合: 参考価格として最新仕入れ単価または標準単価から算出 (0または安全値)
    return bpt > 0 ? Math.round(shuttle.pricePerTube / bpt) : 0;
  }

  const totalCost = getShuttleTotalOriginalCost(shuttle);
  return Math.round(totalCost / totalBalls);
}

/**
 * シャトルの1球（1本）あたりの現在庫加重平均原価 (高精度浮動小数点)
 */
export function getShuttleCostPerBallExact(shuttle: ShuttleStock): number {
  const totalBalls = getShuttleTotalBalls(shuttle);
  const bpt = shuttle.ballsPerTube || 12;

  if (totalBalls <= 0) {
    return bpt > 0 ? (shuttle.pricePerTube / bpt) : 0;
  }

  const totalCost = getShuttleTotalOriginalCost(shuttle);
  return totalCost / totalBalls;
}

/**
 * シャトル在庫の資産評価額（指定レート%）
 */
export function getShuttleValuationAmount(shuttle: ShuttleStock, ratePercent: number): number {
  const originalCost = getShuttleTotalOriginalCost(shuttle);
  return Math.round(originalCost * (ratePercent / 100));
}

/**
 * 本数（球数）増減による在庫更新ヘルパー
 * 在庫加重平均方式に対応：本数の増減とともに在庫総原価(totalCostInStock)を整合的に増減
 * @param costDelta 明示的に増減させる原価（円）。指定がなければ現在の加重平均原価で増減。
 */
export function adjustShuttleStockByBalls(
  shuttle: ShuttleStock, 
  deltaBalls: number, 
  costDelta?: number
): ShuttleStock {
  const currentTotal = getShuttleTotalBalls(shuttle);
  const currentTotalCost = getShuttleTotalOriginalCost(shuttle);
  const newTotal = Math.max(0, currentTotal + deltaBalls);
  const bpt = shuttle.ballsPerTube || 12;
  const { tubes, loose } = normalizeBallsToTubes(newTotal, bpt);

  let newTotalCost: number;

  if (newTotal === 0) {
    newTotalCost = 0;
  } else if (costDelta !== undefined) {
    newTotalCost = Math.max(0, currentTotalCost + costDelta);
  } else if (deltaBalls < 0) {
    // 消費時: 現在の加重平均原価で差し引く
    const avgCost = currentTotal > 0 ? (currentTotalCost / currentTotal) : (shuttle.pricePerTube / bpt);
    const consumedCost = Math.abs(deltaBalls) * avgCost;
    newTotalCost = Math.max(0, currentTotalCost - consumedCost);
  } else if (deltaBalls > 0) {
    // 増加時: 単価指定がない場合は現在の加重平均原価で復元
    const avgCost = currentTotal > 0 ? (currentTotalCost / currentTotal) : (shuttle.pricePerTube / bpt);
    const addedCost = deltaBalls * avgCost;
    newTotalCost = currentTotalCost + addedCost;
  } else {
    newTotalCost = currentTotalCost;
  }

  return {
    ...shuttle,
    tubesInStock: tubes,
    looseBallsInStock: loose,
    totalCostInStock: Math.max(0, Math.round(newTotalCost)),
  };
}

/**
 * 筒（ダース）数増減による在庫更新ヘルパー
 */
export function adjustShuttleStockByTubes(shuttle: ShuttleStock, deltaTubes: number, costDelta?: number): ShuttleStock {
  const deltaBalls = deltaTubes * (shuttle.ballsPerTube || 12);
  return adjustShuttleStockByBalls(shuttle, deltaBalls, costDelta);
}

/**
 * シャトル追加仕入れ（入荷）処理
 * 【最重要仕様：在庫加重平均方式】
 * 既存在庫の原価を最新単価で上書きせず、現在の在庫総原価に今回の仕入れ金額を加算する。
 */
export function restockShuttle(
  shuttle: ShuttleStock,
  tubesToAdd: number,
  pricePerTube: number,
  looseToAdd: number = 0,
  dateStr?: string
): ShuttleStock {
  const bpt = shuttle.ballsPerTube || 12;
  const totalBallsToAdd = Math.max(0, tubesToAdd * bpt + looseToAdd);
  const costPerBall = pricePerTube / bpt;
  const addedCost = Math.round(totalBallsToAdd * costPerBall);

  const currentTotalBalls = getShuttleTotalBalls(shuttle);
  const currentTotalCost = getShuttleTotalOriginalCost(shuttle);

  const newTotalBalls = currentTotalBalls + totalBallsToAdd;
  const newTotalCost = currentTotalCost + addedCost;
  const { tubes, loose } = normalizeBallsToTubes(newTotalBalls, bpt);

  const lotRecord: ShuttlePurchaseLot = {
    id: `lot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    date: dateStr || new Date().toISOString().slice(0, 10),
    tubes: tubesToAdd,
    loose: looseToAdd > 0 ? looseToAdd : 0,
    totalBalls: totalBallsToAdd,
    pricePerTube,
    totalCost: addedCost,
    createdAt: new Date().toISOString(),
  };

  const existingHistory = shuttle.purchaseHistory || [];

  return {
    ...shuttle,
    tubesInStock: tubes,
    looseBallsInStock: loose,
    pricePerTube, // 最新仕入れ単価を保持（次回仕入れフォームの初期値や参考価格用）
    totalCostInStock: Math.round(newTotalCost),
    purchaseHistory: [lotRecord, ...existingHistory],
  };
}
