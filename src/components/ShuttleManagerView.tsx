import React, { useState, useMemo } from 'react';
import {
  Package,
  PlusCircle,
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit3,
  Trash2,
  Info,
  CheckCircle2,
  TrendingDown,
  ShoppingBag,
  Sparkles,
  Sliders,
  Store,
  DollarSign,
  TrendingUp,
  Scale,
  RotateCcw,
  Tag,
  Boxes,
  HelpCircle,
  Truck,
  ArrowRight,
  Plus,
  Minus,
  Layers,
  CircleDot,
  History
} from 'lucide-react';
import { ShuttleStock, PaymentSource, Member, ClubSettings } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  getShuttleTotalBalls,
  normalizeBallsToTubes,
  combineTubesAndLoose,
  getShuttleCostPerBall,
  getShuttleTotalOriginalCost,
  getShuttleValuationAmount,
  adjustShuttleStockByBalls,
  adjustShuttleStockByTubes
} from '../utils/shuttleUtils';

interface ShuttleManagerViewProps {
  inventory: ShuttleStock[];
  settings: ClubSettings;
  members: Member[];
  onUpdateShuttle: (shuttle: ShuttleStock) => void;
  onAddShuttle: (shuttle: Omit<ShuttleStock, 'id'>) => void;
  onDeleteShuttle: (id: string) => void;
  onRestock: (
    shuttleId: string,
    tubesToAdd: number,
    pricePerTube: number,
    recordToLedger: boolean,
    paymentSource?: PaymentSource,
    payerMemberId?: string,
    looseToAdd?: number
  ) => void;
  onUpdateValuationRate: (rate: number) => void;
}

export const SPEED_NUMBER_LABELS: Record<2 | 3 | 4 | 5, { label: string; season: string; tempRange: string; color: string }> = {
  2: { label: '2番 (夏用)', season: '夏季', tempRange: '27℃〜33℃', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  3: { label: '3番 (春秋用)', season: '春・秋季', tempRange: '22℃〜28℃', color: 'text-accent bg-accent/15 border-accent/30' },
  4: { label: '4番 (冬用)', season: '冬季', tempRange: '17℃〜23℃', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  5: { label: '5番 (厳冬用)', season: '寒冷地・厳冬期', tempRange: '12℃〜18℃', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
};

export const ShuttleManagerView: React.FC<ShuttleManagerViewProps> = ({
  inventory,
  settings,
  members,
  onUpdateShuttle,
  onAddShuttle,
  onDeleteShuttle,
  onRestock,
  onUpdateValuationRate,
}) => {
  const valuationRate = settings.shuttleValuationRate || 80;

  // View Mode for unit emphasis: 'both'
  const [unitViewMode, setUnitViewMode] = useState<'both'>('both');

  // Modals state
  const [restockModalItem, setRestockModalItem] = useState<ShuttleStock | null>(null);
  const [restockInputMode, setRestockInputMode] = useState<'tubes' | 'balls'>('tubes');
  const [restockTubes, setRestockTubes] = useState<number | ''>('');
  const [restockLooseBalls, setRestockLooseBalls] = useState<number | ''>('');
  const [restockTotalBallsInput, setRestockTotalBallsInput] = useState<number | ''>('');
  const [restockPrice, setRestockPrice] = useState<number | ''>('');
  const [recordExpenseToLedger, setRecordExpenseToLedger] = useState<boolean>(true);
  const [restockPaymentSource, setRestockPaymentSource] = useState<PaymentSource>('club_funds');
  const [restockPayerId, setRestockPayerId] = useState<string>(members[0]?.id || '');

  const [editModalItem, setEditModalItem] = useState<(Omit<ShuttleStock, 'looseBallsInStock'> & { looseBallsInStock: number | '' }) | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ShuttleStock | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showLiquidationGuide, setShowLiquidationGuide] = useState<boolean>(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // New Shuttle Form State
  const [newBrand, setNewBrand] = useState('YONEX');
  const [newModel, setNewModel] = useState('エアロセンサ 700');
  const [newSpeed, setNewSpeed] = useState<2 | 3 | 4 | 5>(3);
  const [newMaterial, setNewMaterial] = useState<'waterfowl' | 'synthetic' | 'hybrid'>('waterfowl');
  const [newTubes, setNewTubes] = useState<number | ''>('');
  const [newLooseBalls, setNewLooseBalls] = useState<number | ''>('');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newThreshold, setNewThreshold] = useState<number>(2);
  const [newNotes, setNewNotes] = useState('');

  // Total calculations with exact balls & tubes
  const totalStats = useMemo(() => {
    let totalBalls = 0;
    let totalTubes = 0;
    let totalLoose = 0;
    let totalOriginalCost = 0;
    let lowStockCount = 0;

    inventory.forEach((s) => {
      const balls = getShuttleTotalBalls(s);
      totalBalls += balls;
      totalTubes += s.tubesInStock || 0;
      totalLoose += s.looseBallsInStock || 0;
      totalOriginalCost += getShuttleTotalOriginalCost(s);

      const thresholdBalls = s.lowStockThreshold * (s.ballsPerTube || 12);
      if (balls <= thresholdBalls) {
        lowStockCount++;
      }
    });

    const totalValuation = Math.round(totalOriginalCost * (valuationRate / 100));
    const valuationDiscount = totalOriginalCost - totalValuation;
    const totalBoxes = (totalBalls / 120).toFixed(1); // 1箱 = 10ダース = 120本

    // 売却手取り概算シミュレーション (10%手数料 + 10ダース箱あたり送料約950円)
    const boxCountForShipping = Math.max(1, Math.ceil(totalBalls / 120));
    const estimatedShippingCost = boxCountForShipping * 950;
    const mercariGross = Math.round(totalOriginalCost * 0.9); // 定価90%相場出品
    const mercariFee = Math.round(mercariGross * 0.1); // 10%
    const mercariNetPayout = Math.max(0, mercariGross - mercariFee - estimatedShippingCost);

    return {
      totalBalls,
      totalTubes,
      totalLoose,
      totalOriginalCost,
      totalValuation,
      valuationDiscount,
      totalBoxes,
      lowStockCount,
      estimatedShippingCost,
      mercariGross,
      mercariFee,
      mercariNetPayout,
    };
  }, [inventory, valuationRate]);

  // Quick Stock Adjust by Tubes (+1, -1)
  const handleQuickAdjustTubes = (shuttle: ShuttleStock, deltaTubes: number) => {
    const updated = adjustShuttleStockByTubes(shuttle, deltaTubes);
    onUpdateShuttle(updated);
  };

  // Quick Stock Adjust by Balls (+1, -1, +6, etc.)
  const handleQuickAdjustBalls = (shuttle: ShuttleStock, deltaBalls: number) => {
    const updated = adjustShuttleStockByBalls(shuttle, deltaBalls);
    onUpdateShuttle(updated);
  };

  // Open restock modal
  const openRestockModal = (shuttle: ShuttleStock) => {
    setRestockModalItem(shuttle);
    setRestockInputMode('tubes');
    setRestockTubes('');
    setRestockLooseBalls('');
    setRestockTotalBallsInput('');
    setRestockPrice(shuttle.pricePerTube ?? '');
  };

  // Restock Submit
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalItem) return;

    let finalTubes = Math.max(0, Number(restockTubes) || 0);
    let finalLoose = restockLooseBalls;

    if (restockInputMode === 'balls') {
      const bpt = restockModalItem.ballsPerTube || 12;
      const normalized = normalizeBallsToTubes(Math.max(0, Number(restockTotalBallsInput) || 0), bpt);
      finalTubes = normalized.tubes;
      finalLoose = normalized.loose;
    }

    onRestock(
      restockModalItem.id,
      finalTubes,
      Math.max(0, Number(restockPrice) || 0),
      recordExpenseToLedger,
      restockPaymentSource,
      restockPaymentSource === 'out_of_pocket' ? restockPayerId : undefined,
      Number(finalLoose) || 0
    );
    setRestockModalItem(null);
  };

  // Create Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddShuttle({
      brand: newBrand,
      modelName: newModel,
      speedNumber: newSpeed,
      material: newMaterial,
      tubesInStock: Math.max(0, Number(newTubes) || 0),
      looseBallsInStock: Math.max(0, typeof newLooseBalls === 'number' ? newLooseBalls : 0),
      ballsPerTube: 12,
      pricePerTube: Math.max(0, Number(newPrice) || 0),
      lowStockThreshold: newThreshold,
      notes: newNotes,
    });
    setShowAddModal(false);
    // Reset form
    setNewTubes('');
    setNewLooseBalls('');
    setNewPrice('');
    setNewNotes('');
  };

  // Edit Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalItem) return;
    onUpdateShuttle({
      ...editModalItem,
      looseBallsInStock: typeof editModalItem.looseBallsInStock === 'number' ? editModalItem.looseBallsInStock : 0,
      tubesInStock: typeof editModalItem.tubesInStock === 'number' ? editModalItem.tubesInStock : 0,
      pricePerTube: typeof editModalItem.pricePerTube === 'number' ? editModalItem.pricePerTube : 0,
    });
    setEditModalItem(null);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in pb-12">
      {/* Top Header & Overview Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-2xl font-black text-text tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-accent/10 border border-accent/20 rounded-full text-accent shrink-0">
                <Package className="w-6 h-6" />
              </span>
              <span>シャトル管理</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl leading-relaxed">
            シャトルをリアルタイム在庫管理。練習消費の自動減算・仕入れ記帳・80%棚卸資産評価を自動化
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>新規銘柄を登録</span>
          </button>
        </div>
      </div>

      {/* Main Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">

        {/* Left 8 Cols: Valuation & Stock Overview */}
        <div className="md:col-span-8 bg-surface border border-border rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-accent uppercase tracking-wider flex items-center gap-1">
                  <Scale className="w-4 h-4" />
                  <span>棚卸資産評価額</span>
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                  {valuationRate}% 掛け
                </span>
              </div>
              <div className="text-2xl sm:text-4xl font-black text-text tracking-tight tabular-nums mt-1">
                {formatCurrency(totalStats.totalValuation)}
              </div>
            </div>

            {/* Valuation Rate Slider */}
            <div className="bg-surface-subtle p-3 rounded-xl border border-border text-xs sm:w-60">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-text-muted" />
                  <span>評価レート設定</span>
                </span>
                <span className="font-black text-accent">{valuationRate}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={valuationRate}
                onChange={(e) => onUpdateValuationRate(Number(e.target.value))}
                className="w-full h-1.5 bg-surface rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[9px] text-text-muted mt-1">
                <span>保守的 (50%)</span>
                <span>標準 (80%)</span>
                <span>原価 (100%)</span>
              </div>
            </div>
          </div>

          {/* Granular Stock Counts (Tubes & Balls Breakdown) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">

            {/* Total Balls (Total Units) */}
            <div className="p-3 bg-surface-subtle rounded-xl border border-border">
              <div className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                <CircleDot className="w-3 h-3 text-accent" />
                <span>総保有シャトル数</span>
              </div>
              <div className="text-xl font-black text-text tabular-nums mt-0.5">
                {totalStats.totalBalls} <span className="text-xs font-semibold text-text-muted">本 </span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">全銘柄の合計本数</div>
            </div>

            {/* Unopened Tubes (Dozens) */}
            <div className="p-3 bg-surface-subtle rounded-xl border border-border">
              <div className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                <Package className="w-3 h-3 text-sky-400" />
                <span>未開封ダース数</span>
              </div>
              <div className="text-xl font-black text-sky-300 tabular-nums mt-0.5">
                {totalStats.totalTubes} <span className="text-xs font-semibold text-text-muted">ダース</span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">({totalStats.totalTubes * 12} 本相当)</div>
            </div>

            {/* Loose Balls */}
            <div className="p-3 bg-surface-subtle rounded-xl border border-border">
              <div className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" />
                <span>開封済みバラ本</span>
              </div>
              <div className="text-xl font-black text-amber-400 tabular-nums mt-0.5">
                {totalStats.totalLoose} <span className="text-xs font-semibold text-text-muted">本 </span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">端数・練習使用中</div>
            </div>

            {/* Boxes (10 Dozen per carton) */}
            <div className="p-3 bg-surface-subtle rounded-xl border border-border">
              <div className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                <Boxes className="w-3 h-3 text-indigo-400" />
                <span>箱数換算 (10ダース/箱)</span>
              </div>
              <div className="text-xl font-black text-indigo-300 tabular-nums mt-0.5">
                {totalStats.totalBoxes} <span className="text-xs font-semibold text-text-muted">箱</span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">1箱 = 120本換算</div>
            </div>

          </div>

          {/* Asset Valuation Context Note */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-text-muted pt-2 border-t border-border gap-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-accent shrink-0" />
              <span>
                購入原価総額 <strong className="text-text">{formatCurrency(totalStats.totalOriginalCost)}</strong> から
                <strong className="text-amber-400 font-bold ml-1">-{formatCurrency(totalStats.valuationDiscount)}</strong> ({100 - valuationRate}%減損)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLiquidationGuide(!showLiquidationGuide)}
              className="text-[11px] text-accent hover:text-accent-hover font-bold underline cursor-pointer self-start sm:self-auto"
            >
              {showLiquidationGuide ? '清算解説を閉じる' : '売却・解散清算シミュレーションとは？'}
            </button>
          </div>

          {/* Collapsible Liquidation Guide */}
          {showLiquidationGuide && (
            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-3 text-xs animate-fade-in">
              <div className="flex items-center gap-2 text-text font-bold">
                <Store className="w-4 h-4 text-amber-400" />
                <span>社会人サークル解散時のシャトル棚卸資産清算ルール</span>
              </div>
              <p className="text-text-muted leading-relaxed">
                サークルが解散する場合や年度末の決算時、購入した未開封シャトルや残存シャトルは<strong className="text-text">「クラブの共有棚卸資産」</strong>として扱われます。
                購入原価のままではなく、等での売却相場（90%前後）、手数料（10%）、送料を考慮した<strong className="text-accent">80%評価</strong>を資産計上することで、部員への余剰金返還時に過大分配となるトラブルを防止できます。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border text-[11px]">
                <div className="p-2 bg-surface rounded-xl">
                  <span className="text-text-muted">① 想定売上(90%):</span>
                  <div className="font-bold text-text">{formatCurrency(totalStats.mercariGross)}</div>
                </div>
                <div className="p-2 bg-surface rounded-xl">
                  <span className="text-text-muted">② 手数料10% + 送料({totalStats.estimatedShippingCost}円):</span>
                  <div className="font-bold text-rose-400">-{formatCurrency(totalStats.mercariFee + totalStats.estimatedShippingCost)}</div>
                </div>
                <div className="p-2 bg-surface rounded-xl">
                  <span className="text-text-muted">③ 現金化可能・純手取概算:</span>
                  <div className="font-bold text-accent">{formatCurrency(totalStats.mercariNetPayout)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Quick Order Status & Action */}
        <div className="md:col-span-4 flex flex-col justify-between gap-4">

          {/* Mercari Cashout Quick Card */}
          <div className="bg-surface p-5 rounded-2xl border border-border shadow-md flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400" />
                <span>売却現金化 概算手取額</span>
              </span>
              <span className="text-[10px] text-text-muted font-semibold">相場</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-black text-amber-400 tracking-tight tabular-nums">
                {formatCurrency(totalStats.mercariNetPayout)}
              </div>
              <div className="text-[11px] text-text-muted mt-0.5">
                手数料・送料控除後の予想手取額
              </div>
            </div>
            <div className="pt-2 border-t border-border text-[11px] text-text-muted flex items-center justify-between">
              <span>発送想定: {Math.ceil(totalStats.totalBalls / 120)}箱</span>
              <span className="text-amber-300 font-semibold">清算準備OK</span>
            </div>
          </div>

          {/* Low Stock Alert Box */}
          <div className="bg-surface p-5 rounded-2xl border border-border shadow-md flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                <span>要発注アラート</span>
                <AlertCircle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400 mt-1 tabular-nums flex items-baseline gap-1.5">
                <span>{totalStats.lowStockCount}</span>
                <span className="text-xs font-semibold text-text-muted">銘柄が発注ライン以下</span>
              </div>
            </div>
            <div className="text-[11px] text-text-muted mt-2 border-t border-border pt-2">
              {totalStats.lowStockCount > 0 ? (
                <span className="text-amber-300 font-medium">次回練習前に発注を推奨</span>
              ) : (
                <span className="text-accent font-medium">全銘柄の在庫が潤沢です</span>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Season & Speed Number Recommendation Strip */}
      <div className="p-4 bg-surface rounded-2xl border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {([2, 3, 4, 5] as const).map((spd) => {
          const info = SPEED_NUMBER_LABELS[spd];
          const shuttlesOfSpeed = inventory.filter(s => s.speedNumber === spd);
          const totalBallsOfSpeed = shuttlesOfSpeed.reduce((sum, s) => sum + getShuttleTotalBalls(s), 0);
          const totalTubesOfSpeed = shuttlesOfSpeed.reduce((sum, s) => sum + (s.tubesInStock || 0), 0);
          const totalLooseOfSpeed = shuttlesOfSpeed.reduce((sum, s) => sum + (s.looseBallsInStock || 0), 0);

          return (
            <div key={spd} className="p-2.5 bg-surface-subtle rounded-xl border border-border flex items-center justify-between">
              <div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${info.color}`}>
                  {spd}番 ({info.season})
                </span>
                <div className="text-[10px] text-text-muted mt-1">{info.tempRange}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-text tabular-nums">
                  {totalBallsOfSpeed} <span className="text-[10px] text-text-muted">本</span>
                </div>
                <div className="text-[10px] text-text-muted">
                  ({totalTubesOfSpeed}ダース{totalLooseOfSpeed > 0 ? `+${totalLooseOfSpeed}本` : ''})
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shuttle Inventory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {inventory.map((shuttle) => {
          const totalBalls = getShuttleTotalBalls(shuttle);
          const tubes = shuttle.tubesInStock || 0;
          const loose = shuttle.looseBallsInStock || 0;
          const ballsPerTube = shuttle.ballsPerTube || 12;
          const thresholdBalls = shuttle.lowStockThreshold * ballsPerTube;
          const isLow = totalBalls <= thresholdBalls;

          const costPerBall = getShuttleCostPerBall(shuttle);
          const speedInfo = SPEED_NUMBER_LABELS[shuttle.speedNumber];
          const itemOriginalValue = getShuttleTotalOriginalCost(shuttle);
          const itemValuation = getShuttleValuationAmount(shuttle, valuationRate);

          return (
            <div
              key={shuttle.id}
              className={`bg-surface rounded-2xl border p-5 shadow-md flex flex-col justify-between transition-all relative ${isLow ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-border'
                }`}
            >
              <div className="space-y-3.5">
                {/* Brand & Speed Tag */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-subtle text-text-muted border border-border">
                      {shuttle.brand}
                    </span>
                    <h3 className="text-base font-bold text-text mt-1 min-w-0 truncate" title={shuttle.modelName}>
                      {shuttle.modelName}
                    </h3>
                  </div>

                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${speedInfo.color}`}>
                    {speedInfo.label}
                  </span>
                </div>

                {/* Stock Level & Dual Display (Tubes & Balls) */}
                <div className="p-3.5 bg-surface-subtle rounded-xl border border-border space-y-3">

                  {/* Highlighted Stock Counts */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-text-muted font-semibold flex items-center gap-1">
                        <Package className="w-3 h-3 text-accent" />
                        <span>現在保有数</span>
                      </div>

                      {(
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-2xl font-black text-text tabular-nums">
                            {tubes} <span className="text-xs font-normal text-text-muted">ダース</span>
                          </span>
                          <span className="text-sm font-black text-amber-400 tabular-nums">
                            + {loose} <span className="text-[10px] font-normal text-text-muted">本</span>
                          </span>
                          <span className="text-xs font-bold text-text-muted tabular-nums">
                            (計{totalBalls}本)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-text-muted font-medium">評価額 ({valuationRate}%):</span>
                      <div className="text-base font-black text-accent tabular-nums">
                        {formatCurrency(itemValuation)}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Price specs */}
                <div className="text-xs text-text-muted space-y-1.5 p-1">
                  <div className="flex justify-between">
                    <span>1本あたり原価 (加重平均):</span>
                    <span className="font-bold text-accent tabular-nums">約 {costPerBall} 円 /本</span>
                  </div>
                  <div className="flex justify-between">
                    <span>在庫総原価 (取得価額):</span>
                    <span className="font-bold text-text tabular-nums">{formatCurrency(itemOriginalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>最新仕入れ単価:</span>
                    <span className="font-semibold text-text-muted tabular-nums">{formatCurrency(shuttle.pricePerTube)} /ダース</span>
                  </div>
                  <div className="flex justify-between">
                    <span>発注目安:</span>
                    <span className="font-semibold text-text-muted">
                      {shuttle.lowStockThreshold} ダース以下 ({shuttle.lowStockThreshold * 12} 本以下)
                    </span>
                  </div>
                  {shuttle.purchaseHistory && shuttle.purchaseHistory.length > 0 && (
                    <div className="pt-1.5 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(expandedHistoryId === shuttle.id ? null : shuttle.id)}
                        className="text-[11px] font-semibold text-text-muted hover:text-text flex items-center justify-between w-full cursor-pointer py-0.5"
                      >
                        <span className="flex items-center gap-1">
                          <History className="w-3 h-3 text-accent" />
                          <span>仕入れロット履歴 ({shuttle.purchaseHistory.length}件)</span>
                        </span>
                        <span className="text-[10px] text-text-muted">{expandedHistoryId === shuttle.id ? '閉じる ▲' : '表示 ▼'}</span>
                      </button>

                      {expandedHistoryId === shuttle.id && (
                        <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto bg-surface-subtle p-2 rounded-xl border border-border text-[11px]">
                          {shuttle.purchaseHistory.map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between border-b border-border pb-1 last:border-0 last:pb-0">
                              <div>
                                <span className="text-text-muted">{lot.date}</span>
                                <span className="ml-1.5 text-text font-bold">{lot.tubes}ダース{lot.loose ? `+${lot.loose}本` : ''} ({lot.totalBalls}本)</span>
                              </div>
                              <div className="text-right">
                                <span className="text-text-muted font-bold">{formatCurrency(lot.pricePerTube)}/筒</span>
                                <span className="text-[10px] text-text-muted ml-1">({formatCurrency(lot.totalCost)})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {shuttle.notes && (
                    <div className="pt-1 text-[11px] text-text-muted border-t border-border">
                      📝 {shuttle.notes}
                    </div>
                  )}
                </div>

                {isLow && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>在庫（残り{totalBalls}本 / {tubes}ダース{loose > 0 ? `+${loose}本` : ''}）補充を推奨</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 pt-4 mt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => openRestockModal(shuttle)}
                  className="flex-1 py-2.5 min-h-[44px] bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>箱買い・入荷記帳</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditModalItem(shuttle)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent text-text-muted hover:text-accent rounded-xl transition-colors cursor-pointer"
                  title="シャトル情報・在庫数を編集"
                  aria-label="シャトル情報・在庫数を編集"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(shuttle)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-rose-500 text-text-muted hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                  title="シャトル銘柄を削除"
                  aria-label="シャトル銘柄を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Restock & Purchase Modal (Supports Tubes & Balls) */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6 shrink-0 bg-surface">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-accent" />
                <span>シャトル仕入れ記帳</span>
              </h3>
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 sm:p-6 space-y-3 sm:space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
                <div className="p-3.5 bg-surface-subtle rounded-xl border border-border">
                  <div className="text-[10px] font-bold text-text-muted">{restockModalItem.brand}</div>
                  <div className="text-sm font-bold text-text">{restockModalItem.modelName} ({SPEED_NUMBER_LABELS[restockModalItem.speedNumber].label})</div>
                  <div className="text-xs text-text-muted mt-1">
                    現在在庫: <strong className="text-text">{restockModalItem.tubesInStock}ダース{restockModalItem.looseBallsInStock ? ` + ${restockModalItem.looseBallsInStock}本` : ''}</strong> (計{getShuttleTotalBalls(restockModalItem)}本)
                  </div>
                </div>

                {/* Mode switch for Restock Input: Tubes vs Total Balls */}
                <div>
                  <label className="block font-bold text-text mb-1">入荷数量の指定方法</label>
                  <div className="grid grid-cols-2 gap-2 bg-surface-subtle p-1 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setRestockInputMode('tubes');
                      }}
                      className={`py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${restockInputMode === 'tubes'
                          ? 'bg-accent text-accent-text shadow-sm'
                          : 'text-text-muted hover:text-text'
                        }`}
                    >
                      ダース数で指定
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRestockInputMode('balls');
                      }}
                      className={`py-2 rounded-xl font-bold text-xs transition-all cursor-pointer ${restockInputMode === 'balls'
                          ? 'bg-accent text-accent-text shadow-sm'
                          : 'text-text-muted hover:text-text'
                        }`}
                    >
                      本数で指定
                    </button>
                  </div>
                </div>

                {restockInputMode === 'tubes' ? (
                  <div>
                    <label className="block font-bold text-text mb-1">入荷ダース数</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        min="1"
                        value={restockTubes}
                        onChange={(e) => setRestockTubes(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                        className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold text-xs focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      ＝ 合計 <strong className="text-accent">{(Number(restockTubes) || 0) * 12} 本 </strong> 入荷
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-text mb-1">入荷本数 </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0"
                        min="1"
                        value={restockTotalBallsInput}
                        onChange={(e) => setRestockTotalBallsInput(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                        className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold text-xs focus:outline-none focus:border-accent"
                        required
                      />
                    </div>
                    <div className="text-[11px] text-text-muted mt-1">
                      ＝ <strong className="text-accent">
                        {Math.floor((Number(restockTotalBallsInput) || 0) / 12)} ダース + {(Number(restockTotalBallsInput) || 0) % 12} 本
                      </strong> 入荷換算
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-text mb-1">1ダース(12本)あたりの購入単価 (円)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={restockPrice}
                    onChange={(e) => setRestockPrice(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold text-xs focus:outline-none focus:border-accent"
                    required
                  />
                  <div className="text-[11px] text-text-muted mt-0.5">
                    1本あたり原価: 約 <strong className="text-accent">{Math.round((Number(restockPrice) || 0) / 12)} 円</strong>
                  </div>
                </div>

                {/* Total Purchase Amount Preview */}
                <div className="p-3.5 bg-accent/10 rounded-xl border border-accent/20 flex justify-between items-center">
                  <span className="font-bold text-accent text-xs">仕入れ購入総額:</span>
                  <span className="text-base font-black text-accent tabular-nums">
                    {formatCurrency(
                      restockInputMode === 'tubes'
                        ? (Number(restockTubes) || 0) * (Number(restockPrice) || 0)
                        : Math.round((Number(restockTotalBallsInput) || 0) * ((Number(restockPrice) || 0) / 12))
                    )}
                  </span>
                </div>

                {/* 在庫加重平均方式 シミュレーション */}
                {restockModalItem && (() => {
                  const bpt = restockModalItem.ballsPerTube || 12;
                  const tubesNum = Number(restockTubes) || 0;
                  const ballsInput = Number(restockTotalBallsInput) || 0;
                  const priceNum = Number(restockPrice) || 0;
                  const addBalls = restockInputMode === 'tubes'
                    ? (tubesNum * bpt + (Number(restockLooseBalls) || 0))
                    : ballsInput;
                  const addCost = Math.round(addBalls * (priceNum / bpt));
                  const currBalls = getShuttleTotalBalls(restockModalItem);
                  const currCost = getShuttleTotalOriginalCost(restockModalItem);
                  const currAvg = currBalls > 0 ? (currCost / currBalls) : (restockModalItem.pricePerTube / bpt);
                  const newBalls = currBalls + addBalls;
                  const newCost = currCost + addCost;
                  const newAvg = newBalls > 0 ? (newCost / newBalls) : 0;

                  return (
                    <div className="p-3.5 bg-surface-subtle rounded-xl border border-accent/30 text-xs space-y-2.5">
                      <div className="font-bold text-accent flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span>在庫加重平均原価シミュレーション</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 py-1.5 text-center border-y border-border">
                        <div>
                          <div className="text-[10px] text-text-muted">現在庫</div>
                          <div className="font-bold text-text tabular-nums">{currBalls}本</div>
                          <div className="text-[10px] text-text-muted tabular-nums">@{Math.round(currAvg)}円</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-accent">今回仕入れ</div>
                          <div className="font-bold text-accent tabular-nums">+{addBalls}本</div>
                          <div className="text-[10px] text-accent tabular-nums">@{Math.round(priceNum / bpt)}円</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-amber-300">仕入れ後加重平均</div>
                          <div className="font-bold text-amber-200 tabular-nums">{newBalls}本</div>
                          <div className="text-[10px] font-bold text-amber-300 tabular-nums">約 {Math.round(newAvg)}円/本</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-text-muted leading-relaxed">
                        ※在庫加重平均方式により、既存在庫({currBalls}本)の原価は上書きされず、新旧在庫の総額から適正に計算されます。
                      </div>
                    </div>
                  );
                })()}

                {/* 出納帳連動スイッチ */}
                <div className="p-3.5 bg-surface-subtle rounded-xl border border-border space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={recordExpenseToLedger}
                      onChange={(e) => setRecordExpenseToLedger(e.target.checked)}
                      className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                    />
                    <span className="font-bold text-text">クラブ出納帳に支出として自動記帳する</span>
                  </label>

                  {recordExpenseToLedger && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div>
                        <label className="block font-bold text-text mb-1">資金の出所</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRestockPaymentSource('club_funds')}
                            className={`p-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${restockPaymentSource === 'club_funds'
                                ? 'bg-accent/20 border-accent text-accent'
                                : 'bg-surface-subtle border-border text-text-muted hover:text-text'
                              }`}
                          >
                            クラブ資金
                          </button>
                          <button
                            type="button"
                            onClick={() => setRestockPaymentSource('out_of_pocket')}
                            className={`p-2.5 rounded-xl font-bold text-xs border transition-all cursor-pointer ${restockPaymentSource === 'out_of_pocket'
                                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                : 'bg-surface-subtle border-border text-text-muted hover:text-text'
                              }`}
                          >
                            個人立替
                          </button>
                        </div>
                      </div>

                      {restockPaymentSource === 'out_of_pocket' && (
                        <div>
                          <label className="block font-bold text-text mb-1">立替者 (後で返済精算)</label>
                          <select
                            value={restockPayerId}
                            onChange={(e) => setRestockPayerId(e.target.value)}
                            className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold text-xs focus:outline-none focus:border-accent"
                          >
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.role === 'leader' ? '代表' : m.role === 'officer' ? '役員' : '部員'})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Footer: Cancel & Submit Buttons */}
              <div className="flex gap-2.5 p-4 sm:p-5 border-t border-border bg-surface shrink-0">
                <button
                  type="button"
                  onClick={() => setRestockModalItem(null)}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  記帳する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Shuttle Modal (Supports tubes and loose balls) */}
      {(showAddModal || editModalItem) && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Package className="w-4 h-4 text-accent" />
                <span>{showAddModal ? '新規シャトル銘柄の登録' : 'シャトル情報の編集'}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditModalItem(null);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={showAddModal ? handleCreateSubmit : handleEditSubmit} className="space-y-3 sm:space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text mb-1">メーカー / ブランド</label>
                  <input
                    type="text"
                    value={showAddModal ? newBrand : (editModalItem?.brand ?? '')}
                    onChange={(e) => showAddModal ? setNewBrand(e.target.value) : setEditModalItem(prev => prev ? { ...prev, brand: e.target.value } : null)}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                    placeholder="YONEX, GOSEN等"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-text mb-1">モデル・銘柄名</label>
                  <input
                    type="text"
                    value={showAddModal ? newModel : (editModalItem?.modelName ?? '')}
                    onChange={(e) => showAddModal ? setNewModel(e.target.value) : setEditModalItem(prev => prev ? { ...prev, modelName: e.target.value } : null)}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                    placeholder="エアロセンサ 700等"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text mb-1">番手 (スピード番号)</label>
                  <select
                    value={showAddModal ? newSpeed : editModalItem?.speedNumber}
                    onChange={(e) => {
                      const val = Number(e.target.value) as 2 | 3 | 4 | 5;
                      showAddModal ? setNewSpeed(val) : setEditModalItem(prev => prev ? { ...prev, speedNumber: val } : null);
                    }}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                  >
                    <option value={2}>2番 (夏季 27℃〜33℃)</option>
                    <option value={3}>3番 (春秋 22℃〜28℃)</option>
                    <option value={4}>4番 (冬季 17℃〜23℃)</option>
                    <option value={5}>5番 (寒冷地 12℃〜18℃)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-text mb-1">素材種別</label>
                  <select
                    value={showAddModal ? newMaterial : editModalItem?.material}
                    onChange={(e) => {
                      const val = e.target.value as 'waterfowl' | 'synthetic' | 'hybrid';
                      showAddModal ? setNewMaterial(val) : setEditModalItem(prev => prev ? { ...prev, material: val } : null);
                    }}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                  >
                    <option value="waterfowl">水鳥羽根 (フェザー)</option>
                    <option value="hybrid">ハイブリッド</option>
                    <option value="synthetic">人工羽 / ナイロン</option>
                  </select>
                </div>
              </div>

              {/* Stock Input: Unopened Tubes + Loose Balls */}
              <div className="p-3 bg-surface-subtle rounded-xl border border-border space-y-3">
                <div className="font-bold text-text flex items-center justify-between">
                  <span>保有在庫数 (ダース + バラ本数)</span>
                  <span className="text-[11px] text-accent font-normal">
                    合計保有数: <strong className="font-bold">
                      {showAddModal
                        ? (Number(newTubes || 0) * 12 + Number(newLooseBalls || 0))
                        : ((editModalItem?.tubesInStock || 0) * 12 + (editModalItem?.looseBallsInStock || 0))} 本
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-text-muted mb-1">未開封 (ダース)</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={showAddModal ? (newTubes ?? '') : (editModalItem?.tubesInStock ?? '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                        showAddModal ? setNewTubes(val) : setEditModalItem(prev => prev ? { ...prev, tubesInStock: Number(val) || 0 } : null);
                      }}
                      className="w-full py-1.5 px-2.5 sm:p-2 bg-surface border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-text-muted mb-1">開封済バラ (0〜11本)</label>
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={showAddModal ? (newLooseBalls ?? '') : (editModalItem?.looseBallsInStock ?? '')}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, Math.min(11, Number(e.target.value)));
                        showAddModal ? setNewLooseBalls(val) : setEditModalItem(prev => prev ? { ...prev, looseBallsInStock: val } : null);
                      }}
                      placeholder="0"
                      className="w-full py-1.5 px-2.5 sm:p-2 bg-surface border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-text mb-1">単価/ダース (円)</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="50"
                    value={showAddModal ? (newPrice ?? '') : (editModalItem?.pricePerTube ?? '')}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      showAddModal ? setNewPrice(val) : setEditModalItem(prev => prev ? { ...prev, pricePerTube: Number(val) || 0 } : null);
                    }}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                    required
                  />
                  <div className="text-[10px] text-text-muted mt-0.5">
                    1本: 約 {Math.round((Number(showAddModal ? newPrice : (editModalItem?.pricePerTube || 0)) || 0) / 12)} 円
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-text mb-1">発注目安ライン (ダース)</label>
                  <input
                    type="number"
                    min="1"
                    value={showAddModal ? (newThreshold ?? '') : (editModalItem?.lowStockThreshold ?? '')}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      showAddModal ? setNewThreshold(val) : setEditModalItem(prev => prev ? { ...prev, lowStockThreshold: val } : null);
                    }}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-bold focus:outline-none focus:border-accent"
                    required
                  />
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {(showAddModal ? newThreshold : (editModalItem?.lowStockThreshold || 0)) * 12} 本以下で警告
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-text mb-1">備考・用途メモ (任意)</label>
                <input
                  type="text"
                  value={showAddModal ? newNotes : (editModalItem?.notes ?? '')}
                  onChange={(e) => showAddModal ? setNewNotes(e.target.value) : setEditModalItem(prev => prev ? { ...prev, notes: e.target.value } : null)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-semibold focus:outline-none focus:border-accent"
                  placeholder="大会用、ゲーム練習用など"
                />
              </div>

              <div className="flex gap-2 pt-2">
                {editModalItem && (
                  <button
                    type="button"
                    onClick={() => {
                      const itemToDelete = editModalItem;
                      setEditModalItem(null);
                      setDeleteConfirmItem(itemToDelete);
                    }}
                    className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>銘柄削除</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditModalItem(null);
                  }}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {showAddModal ? '登録する' : '保存する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">シャトル銘柄の削除</h3>
                <p className="text-xs text-text-muted">この銘柄を在庫管理一覧から削除します</p>
              </div>
            </div>

            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">メーカー / 銘柄:</span>
                <span className="font-bold text-text">{deleteConfirmItem.brand} {deleteConfirmItem.modelName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">番手 (スピード):</span>
                <span className="font-bold text-text">
                  {SPEED_NUMBER_LABELS[deleteConfirmItem.speedNumber]?.label || `${deleteConfirmItem.speedNumber}番`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">現在保有数:</span>
                <span className="font-bold text-amber-400">
                  {deleteConfirmItem.tubesInStock} ダース{deleteConfirmItem.looseBallsInStock ? ` + ${deleteConfirmItem.looseBallsInStock}本` : ''}
                  (計 {getShuttleTotalBalls(deleteConfirmItem)} 本)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">資産評価額 ({valuationRate}%):</span>
                <span className="font-black text-accent">
                  {formatCurrency(getShuttleValuationAmount(deleteConfirmItem, valuationRate))}
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              シャトル「<strong className="text-text font-bold">{deleteConfirmItem.brand} {deleteConfirmItem.modelName}</strong>」を削除してよろしいですか？
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteShuttle(deleteConfirmItem.id);
                  setDeleteConfirmItem(null);
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除する</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
