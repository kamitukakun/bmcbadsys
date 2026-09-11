import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Package, 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  PlusCircle,
  Calendar,
  Activity,
  Award,
  CreditCard,
  Calculator,
  CircleDollarSign,
  AlertTriangle,
  HeartHandshake,
  Store,
  Clock,
  Swords
} from 'lucide-react';
import { AppState, Transaction } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../data/categories';
import { formatCurrency, formatDate, calculateAge } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { 
  getShuttleTotalBalls, 
  getShuttleTotalOriginalCost, 
  getShuttleValuationAmount,
  normalizeBallsToTubes
} from '../utils/shuttleUtils';
import { calculateFinancialSummary } from '../utils/accountingUtils';
import { parseDateString } from '../utils/dateUtils';

interface DashboardViewProps {
  state: AppState;
  onNavigateTab: (tab: 'doubles' | 'calculator' | 'shuttles' |  'reimbursements' | 'ledger' | 'members' | 'budget') => void;
  onOpenNewTransaction: () => void;
  onOpenNewSession: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigateTab,
  onOpenNewTransaction,
  onOpenNewSession,
}) => {
  const { transactions, members, shuttleInventory, practiceSessions, settings, reimbursements } = state;

  // 1. Total Income, Expense, Balance (一元計算ヘルパーを活用)
  const { totalIncome, totalExpense, currentBalance, expenseByCategory, incomeByCategory } = useMemo(() => {
    return calculateFinancialSummary(transactions);
  }, [transactions]);

  // 2. ポケットマネー未精算立替金集計
  const { unreimbursedDebtAmount, unreimbursedCount, unreimbursedList } = useMemo(() => {
    const list = transactions.filter(tx => tx.type === 'expense' && tx.paymentSource === 'out_of_pocket' && !tx.isReimbursed);
    const amount = list.reduce((sum, tx) => sum + tx.amount, 0);
    return {
      unreimbursedDebtAmount: amount,
      unreimbursedCount: list.length,
      unreimbursedList: list,
    };
  }, [transactions]);

  // 3. 直近6回未参加メンバー判定
  const { recent6Sessions, inactive6Members } = useMemo(() => {
    const sortedSessions = [...practiceSessions].sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime()).slice(0, 6);
    const sessionIds = new Set(sortedSessions.map(s => s.id));

    if (sortedSessions.length === 0) {
      return { recent6Sessions: [], inactive6Members: [] };
    }

    const inactives = members.filter(m => {
      const logs = m.participationLogs || [];
      const attended = logs.some(l => sessionIds.has(l.sessionId));
      // 修正: これまでに一度も参加したことがないメンバーはアラート対象外とする
      const hasEverAttended = logs.length > 0;
      return hasEverAttended && !attended;
    });

    return { recent6Sessions: sortedSessions, inactive6Members: inactives };
  }, [practiceSessions, members]);

  // 4. シャトル在庫 & 80%資産評価額 (本数・バラ球を含む正確な計算)
  const shuttleStats = useMemo(() => {
    let totalBalls = 0;
    let totalTubes = 0;
    let totalLoose = 0;
    let purchaseCostTotal = 0;
    let lowStockCount = 0;

    const rate = (settings.shuttleValuationRate || 80) / 100;

    shuttleInventory.forEach((s) => {
      const balls = getShuttleTotalBalls(s);
      totalBalls += balls;
      totalTubes += s.tubesInStock || 0;
      totalLoose += s.looseBallsInStock || 0;
      purchaseCostTotal += getShuttleTotalOriginalCost(s);
      
      const thresholdBalls = s.lowStockThreshold * (s.ballsPerTube || 12);
      if (balls <= thresholdBalls) {
        lowStockCount++;
      }
    });

    const assetValuationTotal = Math.round(purchaseCostTotal * rate);

    return { 
      totalTubes, 
      totalLoose, 
      totalBalls, 
      purchaseCostTotal, 
      assetValuationTotal, 
      lowStockCount, 
      rate: settings.shuttleValuationRate || 80 
    };
  }, [shuttleInventory, settings.shuttleValuationRate]);

  // 5. Recent 5 transactions
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime())
      .slice(0, 5);
  }, [transactions]);

  // Sorted expense categories
  const sortedExpenses = useMemo(() => {
    return (Object.entries(expenseByCategory) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([catKey, amount]) => {
        const catInfo = (EXPENSE_CATEGORIES as any)[catKey] || {
          label: catKey,
          color: 'text-slate-400',
          icon: 'MinusCircle',
        };
        const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
        return { catKey, label: catInfo.label, amount, percentage, color: catInfo.color, icon: catInfo.icon };
      });
  }, [expenseByCategory, totalExpense]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Bento Grid - Financial Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Current Balance Bento Card */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">クラブ残高</span>
            <div className="p-2 bg-accent/10 border border-accent/20 rounded-full text-accent">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-3xl font-black text-text tracking-tight tabular-nums">
              {formatCurrency(currentBalance)}
            </div>
            <div className="text-[11px] text-accent font-semibold mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>プール残高 (健全運営中)</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
            <span>累計収入: {formatCurrency(totalIncome)}</span>
            <span>累計支出: {formatCurrency(totalExpense)}</span>
          </div>
        </div>

        {/* Shuttle Asset Value Bento Card (80% Valuation) */}
        <div 
          onClick={() => onNavigateTab('shuttles')}
          className="bg-surface border border-border hover:border-accent/40 rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Package className="w-4 h-4 text-accent" />
              <span>シャトル資産評価額 ({shuttleStats.rate}%)</span>
            </span>
            <span className="text-[10px] text-text-muted font-bold">在庫管理 →</span>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-3xl font-black text-accent tracking-tight tabular-nums">
              {formatCurrency(shuttleStats.assetValuationTotal)}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              購入原価 {formatCurrency(shuttleStats.purchaseCostTotal)} の {shuttleStats.rate}% 評価
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle text-[11px] text-text-muted flex items-center justify-between">
            <span>
              在庫: <strong className="text-text">{shuttleStats.totalTubes}ダース{shuttleStats.totalLoose > 0 ? `+${shuttleStats.totalLoose}本` : ''}</strong> (計{shuttleStats.totalBalls}本)
            </span>
            {shuttleStats.lowStockCount > 0 ? (
              <span className="text-rose-400 font-bold">⚠️ 要補充あり</span>
            ) : (
              <span className="text-accent font-semibold">在庫十分</span>
            )}
          </div>
        </div>

        {/* Pocket Money Debt Alert Bento Card */}
        <div 
          onClick={() => onNavigateTab('reimbursements')}
          className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all cursor-pointer ${
            unreimbursedDebtAmount > 0 
              ? 'bg-surface border-amber-500/50 hover:border-amber-400' 
              : 'bg-surface border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <CircleDollarSign className="w-4 h-4 text-amber-400" />
              <span>個人立替金 (要返済)</span>
            </span>
            <span className="text-[10px] text-text-muted font-bold">精算画面 →</span>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-3xl font-black text-amber-400 tracking-tight tabular-nums">
              {formatCurrency(unreimbursedDebtAmount)}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {unreimbursedCount > 0 ? `${unreimbursedCount}件の立替が返済待ちです` : '未精算の立替金はありません'}
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle text-[11px] text-amber-300/90 flex items-center justify-between">
            <span>クラブ残高より返済可能</span>
            <span className="underline font-bold">返済を実行</span>
          </div>
        </div>

        {/* 6 Times Missing Members Alert Bento Card */}
        <div 
          onClick={() => onNavigateTab('members')}
          className={`border rounded-2xl p-5 shadow-md flex flex-col justify-between transition-all cursor-pointer ${
            inactive6Members.length > 0 
              ? 'bg-surface border-amber-500/40 hover:border-amber-400' 
              : 'bg-surface border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>直近未参加アラート</span>
            </span>
            <span className="text-[10px] text-text-muted font-bold">名簿確認 →</span>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-3xl font-black text-amber-400 tracking-tight tabular-nums">
              {inactive6Members.length} <span className="text-xs font-normal text-text-muted">名</span>
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              直近参加されてない部員
            </div>
          </div>
          <div className="pt-2 border-t border-border-subtle text-[11px] text-text-muted flex items-center justify-between">
            <span>登録総数: {members.length}名</span>
            <span className="text-accent font-semibold">出欠ログ管理</span>
          </div>
        </div>

      </div>

      {/* Middle Bento Grid - Practice Calculator Quick Banner & Main Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Practice Calculator Feature Bento Card (Left 7 cols) */}
        <div className="lg:col-span-7 bg-surface border border-border rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/15 border border-accent/30 rounded-full text-accent">
                  <Calculator className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text">
                  参加費計算ツール
                </h3>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              <strong>シャトル利用本数</strong> と <strong>参加人数</strong> を入力するだけで、体育館利用料とシャトル単価から <strong className="text-accent">赤字にならない参加費目安</strong> を自動算出します。
            </p>
          </div>

          {/* Quick preset tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-surface-subtle rounded-xl border border-border text-xs">
            <div className="text-center p-2.5 rounded-xl bg-surface-muted">
              <div className="text-[10px] text-text-muted font-bold">夜間 (18:00-21:30)</div>
              <div className="text-sm font-black text-text mt-0.5">会場費 ¥1,800</div>
              <div className="text-[10px] text-text-subtle">シャトル6本 / 8名</div>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-surface-muted">
              <div className="text-[10px] text-text-muted font-bold">午前 (09:00-12:00)</div>
              <div className="text-sm font-black text-text mt-0.5">会場費 ¥800</div>
              <div className="text-[10px] text-text-subtle">シャトル4本 / 6名</div>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-surface-muted">
              <div className="text-[10px] text-text-muted font-bold">午後 (13:00-17:00)</div>
              <div className="text-sm font-black text-text mt-0.5">会場費 ¥1,200</div>
              <div className="text-[10px] text-text-subtle">シャトル5本 / 8名</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-2">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('doubles')}
                className="px-3.5 py-2 bg-surface-subtle hover:bg-surface-hover text-text border border-border font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5 text-accent" />
                <span>ダブルス組合せ</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('calculator')}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>参加費計算</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Expense Category Breakdown (Right 5 cols) */}
        <div className="lg:col-span-5 bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                <span>費目別 年間予算</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('budget')}
                className="text-xs font-bold text-accent hover:opacity-80 flex items-center gap-1 cursor-pointer"
              >
                <span>予算計画 →</span>
              </button>
            </div>

            <div className="space-y-2.5 mt-3">
              {sortedExpenses.length === 0 ? (
                <div className="text-center py-8 text-text-subtle text-xs">まだ支出データはありません</div>
              ) : (
                sortedExpenses.slice(0, 4).map((item) => (
                  <div key={item.catKey} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted font-semibold">{item.label}</span>
                      <span className="font-bold text-text tabular-nums">
                        {formatCurrency(item.amount)}{' '}
                        <span className="text-[10px] text-text-muted">({item.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-subtle rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end">
            <button
              type="button"
              onClick={() => onNavigateTab('budget')}
              className="px-3 py-1.5 bg-surface-subtle hover:bg-surface-hover border border-border text-text font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>年間予算計画 →</span>
              <ArrowRight className="w-3 h-3 text-accent" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Bento Row - Recent Transactions & Inactive Member Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Transactions List (8 cols) */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                <span>直近の収支取引</span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">最新5件の出納帳レコード</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('ledger')}
              className="text-xs font-bold text-accent hover:opacity-80 flex items-center gap-1 cursor-pointer"
            >
              <span>出納帳</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const isOutOfPocket = tx.type === 'expense' && tx.paymentSource === 'out_of_pocket';

              return (
                <div 
                  key={tx.id} 
                  className="p-3.5 bg-surface-subtle rounded-xl border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="text-[11px] text-text-muted font-semibold tabular-nums shrink-0 pt-0.5 sm:pt-0 w-16">
                      {formatDate(tx.date)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text truncate max-w-full" title={tx.description}>
                          {tx.description}
                        </span>
                        {tx.vendor && (
                          <span className="px-1.5 py-0.5 bg-surface-muted text-text-muted rounded-full text-[10px] flex items-center gap-1 shrink-0">
                            <Store className="w-2.5 h-2.5 text-text-muted" />
                            <span>{tx.vendor}</span>
                          </span>
                        )}
                        {isOutOfPocket && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                            tx.isReimbursed ? 'bg-accent/15 text-accent border-accent/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}>
                            {tx.isReimbursed ? '立替精算済' : `立替未精算: ${tx.payerName || '個人'}`}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-subtle mt-0.5 truncate">
                        決済: {PAYMENT_METHODS[tx.paymentMethod]?.label || tx.paymentMethod} • 記帳者: {tx.recordedBy}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t border-border/40 sm:border-t-0">
                    <span className="text-[10px] text-text-muted sm:hidden">金額:</span>
                    <div className={`text-sm sm:text-base font-black tabular-nums ${
                      isIncome ? 'text-accent' : 'text-rose-400'
                    }`}>
                      {isIncome ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Member & Attendance Snapshot (4 cols) */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-text flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <span>部員状況</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('members')}
              className="text-xs font-bold text-accent hover:opacity-80 cursor-pointer"
            >
              名簿 →
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-surface-subtle rounded-xl border border-border flex justify-between items-center">
              <span className="text-text-muted font-semibold">名簿登録者数</span>
              <span className="text-base font-black text-text">{members.length} 名</span>
            </div>

            {inactive6Members.length > 0 ? (
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl space-y-1.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>直近未参加者 ({inactive6Members.length}名)</span>
                </div>
                <div className="text-[11px] text-text-muted">
                  {inactive6Members.map(m => m.name).join(', ')}
                </div>
                <div className="text-[10px] text-amber-400/80 pt-1">
                  名簿画面で連絡先や参加ログを確認できます
                </div>
              </div>
            ) : (
              <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-[11px] text-accent flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>直近の未参加者はいません。</span>
              </div>
            )}

            <div className="p-3 bg-surface-subtle rounded-xl border border-border flex justify-between items-center text-text-muted">
              <span>過去の練習会開催数</span>
              <span className="font-bold text-text">{practiceSessions.length} 回</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
