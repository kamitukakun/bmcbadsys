import React, { useMemo, useState } from 'react';
import { Printer, X, Download, FileText, CheckSquare } from 'lucide-react';
import { AppState } from '../types';
import { ALL_CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../data/categories';
import { formatCurrency, formatDate, getFiscalYear } from '../utils/formatters';
import { 
  getShuttleTotalBalls, 
  getShuttleTotalOriginalCost, 
  getShuttleValuationAmount,
  normalizeBallsToTubes 
} from '../utils/shuttleUtils';
import { calculateFinancialSummary } from '../utils/accountingUtils';
import { getTodayString } from '../utils/dateUtils';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  state,
}) => {
  if (!isOpen) return null;

  const { settings, transactions, shuttleInventory } = state;
  const todayStr = getTodayString();
  const currentFiscalYear = getFiscalYear(todayStr);

  const [selectedYear, setSelectedYear] = useState<number>(currentFiscalYear);

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => getFiscalYear(t.date)));
    if (years.size === 0) years.add(currentFiscalYear);
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [transactions, currentFiscalYear]);

  // Filter transactions by selected fiscal year
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => getFiscalYear(t.date) === selectedYear);
  }, [transactions, selectedYear]);

  // Previous transactions (before selected year) for carry-over balance
  const previousTransactions = useMemo(() => {
    return transactions.filter(t => getFiscalYear(t.date) < selectedYear);
  }, [transactions, selectedYear]);

  const previousBalance = useMemo(() => {
    if (previousTransactions.length === 0) return 0;
    const summary = calculateFinancialSummary(previousTransactions);
    return summary.currentBalance;
  }, [previousTransactions]);

  // Group transactions by category (一元計算ヘルパーを活用)
  const { incomeByCategory, expenseByCategory, totalIncome, totalExpense, currentBalance: fiscalNetBalance, unreimbursedDebtAmount } = useMemo(() => {
    return calculateFinancialSummary(filteredTransactions);
  }, [filteredTransactions]);

  // Next carry-over balance = previous carry-over balance + fiscal net balance
  const nextCarryOverBalance = previousBalance + fiscalNetBalance;

  // Shuttle total valuation
  const shuttleValuation = useMemo(() => {
    let totalBalls = 0;
    let totalTubes = 0;
    let totalLoose = 0;
    let totalVal = 0;
    const rate = settings.shuttleValuationRate || 80;

    shuttleInventory.forEach((s) => {
      totalBalls += getShuttleTotalBalls(s);
      totalTubes += s.tubesInStock || 0;
      totalLoose += s.looseBallsInStock || 0;
      totalVal += getShuttleValuationAmount(s, rate);
    });

    return { totalBalls, totalTubes, totalLoose, totalVal, rate };
  }, [shuttleInventory, settings.shuttleValuationRate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex flex-col items-center overflow-y-auto p-2 no-print">
      <div className="bg-surface rounded-2xl max-w-4xl w-full my-4 p-5 sm:p-7 shadow-2xl border border-border space-y-5">
        
        {/* Top Modal Controls */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="text-base font-bold text-text">クラブ収支決算報告書（総会・監査提出用）</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-text-muted text-xs font-bold">対象年度:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-surface-subtle text-text text-xs font-bold py-2 px-3 rounded-xl border border-border focus:outline-none focus:border-accent"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}年度</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>印刷する (Print / PDF)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
              aria-label="閉じる"
            >
              ✕
            </button>
          </div>
        </div>
        </div>

        {/* Printable Document Area (Clean paper-white card) */}
        <div className="bg-white rounded-2xl border border-slate-200 space-y-6 text-slate-900 p-6 sm:p-8 print:p-0 shadow-lg">
          
          {/* Document Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              {settings.logoUrl && (
                settings.logoUrl.startsWith('data:') || settings.logoUrl.startsWith('http') ? (
                  <img 
                    src={settings.logoUrl} 
                    alt={settings.clubName} 
                    className="w-12 h-12 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <span className="text-3xl">{settings.logoUrl}</span>
                )
              )}
              <div className="text-left">
                <h1 className="text-xl sm:text-2xl font-bold tracking-wider">
                  {selectedYear}年度 {settings.clubName} 収支決算報告書
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  自 {selectedYear}年4月1日 至 {selectedYear + 1}年3月31日
                </p>
              </div>
            </div>
            {!settings.logoUrl && (
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-xl">
                🏸
              </div>
            )}
          </div>

          {/* Metadata Block */}
          <div className="flex justify-between text-xs border-b border-slate-200 pb-3">
            <div>
              <div>クラブ名: <strong>{settings.clubName}</strong></div>
              <div>作成日: {formatDate(todayStr)}</div>
            </div>
            <div className="text-right">
              <div>会計担当者: <strong>{settings.treasurerName || '未定'}</strong> 印</div>
              <div>代表者: <strong>　　　　　　</strong> 印</div>
            </div>
          </div>

          {/* Main Statement Tables: Income & Expense in 2 Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Income Section */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm bg-slate-100 p-2 border-l-4 border-teal-600">
                【 収入の部 】
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 font-bold">
                    <th className="p-2 text-left border-r border-slate-300">科目・内訳</th>
                    <th className="p-2 text-right">金額 (円)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.values(INCOME_CATEGORIES).map((cat) => {
                    const amt = incomeByCategory[cat.key] || 0;
                    if (amt === 0) return null;
                    return (
                      <tr key={cat.key}>
                        <td className="p-2 border-r border-slate-300">{cat.label}</td>
                        <td className="p-2 text-right font-bold tabular-nums">{formatCurrency(amt)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-teal-50/60 font-bold border-t-2 border-slate-400">
                    <td className="p-2 border-r border-slate-300">収入合計</td>
                    <td className="p-2 text-right text-teal-800 font-black tabular-nums">{formatCurrency(totalIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expense Section */}
            <div className="space-y-2">
              <h3 className="font-bold text-sm bg-slate-100 p-2 border-l-4 border-rose-600">
                【 支出の部 】
              </h3>
              <table className="w-full text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 font-bold">
                    <th className="p-2 text-left border-r border-slate-300">科目・内訳</th>
                    <th className="p-2 text-right">金額 (円)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.values(EXPENSE_CATEGORIES).map((cat) => {
                    const amt = expenseByCategory[cat.key] || 0;
                    if (amt === 0) return null;
                    return (
                      <tr key={cat.key}>
                        <td className="p-2 border-r border-slate-300">{cat.label}</td>
                        <td className="p-2 text-right font-bold tabular-nums">{formatCurrency(amt)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-rose-50/60 font-bold border-t-2 border-slate-400">
                    <td className="p-2 border-r border-slate-300">支出合計</td>
                    <td className="p-2 text-right text-rose-800 font-black tabular-nums">{formatCurrency(totalExpense)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* Financial Summary & Balance Strip */}
          <div className="p-4 bg-slate-50 border-2 border-slate-400 rounded-xl space-y-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-slate-600 font-bold">総収入額 (A)</div>
                <div className="text-base font-extrabold text-teal-700">{formatCurrency(totalIncome)}</div>
              </div>
              <div>
                <div className="text-slate-600 font-bold">総支出額 (B)</div>
                <div className="text-base font-extrabold text-rose-700">{formatCurrency(totalExpense)}</div>
              </div>
              <div className="border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0">
                <div className="text-slate-900 font-black">クラブ実残高・次期繰越金</div>
                <div className="text-lg font-black text-slate-900">{formatCurrency(nextCarryOverBalance)}</div>
                <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                  (前年度繰越: {formatCurrency(previousBalance)} ＋ 当年度収支: {formatCurrency(fiscalNetBalance)})
                </div>
                {unreimbursedDebtAmount > 0 && (
                  <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                    (未精算立替金: {formatCurrency(unreimbursedDebtAmount)})
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between">
              <span>
                【参考】期末シャトル在庫資産: <strong>{shuttleValuation.totalTubes} ダース{shuttleValuation.totalLoose > 0 ? ` + ${shuttleValuation.totalLoose} 本` : ''}</strong> (計 {shuttleValuation.totalBalls} 本 / 評価額 約 <strong>{formatCurrency(shuttleValuation.totalVal)}</strong>)
              </span>
              <span>現品・残高一致確認済</span>
            </div>
          </div>

          {/* Auditor Seal & Certification Block */}
          <div className="border border-slate-300 p-4 rounded-xl text-xs space-y-3">
            <h4 className="font-bold text-slate-900">【 会計監査報告 】</h4>
            <p className="text-slate-700 leading-relaxed">
              {selectedYear}年度における{settings.clubName}の会計帳簿、領収書、通帳残高およびシャトル在庫の現品を監査した結果、収支決算報告書は適正かつ正確に記録されていることを認めます。
            </p>
            
            <div className="flex justify-between items-end pt-4">
              <div>監査日: 令和&emsp;&emsp;年&emsp;&emsp;月&emsp;&emsp;日</div>
              <div className="flex items-center gap-8">
                <div>会計監査役: ____________________ 印</div>
                <div>会計監査役: ____________________ 印</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
