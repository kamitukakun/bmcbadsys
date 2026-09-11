import React, { useState, useMemo } from 'react';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Trash2, 
  Edit3, 
  ArrowUpDown, 
  FileText, 
  Calendar,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Tag,
  Receipt,
  Store,
  AlertCircle,
  CircleDollarSign
} from 'lucide-react';
import { Transaction, TransactionType, PaymentMethod, IncomeCategoryKey, ExpenseCategoryKey } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_SOURCES } from '../data/categories';
import { formatCurrency, formatDate, downloadCsv } from '../utils/formatters';
import { getTodayString, parseDateString } from '../utils/dateUtils';
import { CategoryIcon } from './CategoryIcon';

interface LedgerViewProps {
  transactions: Transaction[];
  onOpenTransactionModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenReport: () => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  onOpenTransactionModal,
  onEditTransaction,
  onDeleteTransaction,
  onOpenReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all' | 'out_of_pocket_unpaid' | 'out_of_pocket_all' | 'club_funds'
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  // Available unique months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      if (t.date) months.add(t.date.substring(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Combined Category Meta Lookup
  const getCategoryMeta = (catKey: string, type: TransactionType) => {
    if (type === 'income') {
      return (INCOME_CATEGORIES as any)[catKey] || { label: catKey, icon: 'PlusCircle', color: 'text-emerald-400' };
    }
    return (EXPENSE_CATEGORIES as any)[catKey] || { label: catKey, icon: 'MinusCircle', color: 'text-rose-400' };
  };

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      // Category
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
      // Payment
      if (paymentFilter !== 'all' && tx.paymentMethod !== paymentFilter) return false;
      // Month
      if (monthFilter !== 'all' && !tx.date.startsWith(monthFilter)) return false;
      
      // Source & Reimbursement Filter
      if (sourceFilter === 'out_of_pocket_unpaid') {
        if (tx.type !== 'expense' || tx.paymentSource !== 'out_of_pocket' || tx.isReimbursed) return false;
      } else if (sourceFilter === 'out_of_pocket_all') {
        if (tx.type !== 'expense' || tx.paymentSource !== 'out_of_pocket') return false;
      } else if (sourceFilter === 'club_funds') {
        if (tx.type === 'expense' && tx.paymentSource === 'out_of_pocket') return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = getCategoryMeta(tx.category, tx.type).label;
        const match =
          tx.description.toLowerCase().includes(q) ||
          tx.recordedBy.toLowerCase().includes(q) ||
          (tx.vendor && tx.vendor.toLowerCase().includes(q)) ||
          (tx.payerName && tx.payerName.toLowerCase().includes(q)) ||
          (tx.receiptNote && tx.receiptNote.toLowerCase().includes(q)) ||
          cat.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    }).sort((a, b) => {
      const timeA = parseDateString(a.date).getTime();
      const timeB = parseDateString(b.date).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [transactions, typeFilter, categoryFilter, paymentFilter, sourceFilter, monthFilter, searchQuery, sortOrder]);

  // Totals for filtered records (活動支出を集計。reimbursement_payout は内部資金移動のため活動支出から除外)
  const { filteredIncome, filteredExpense, filteredNet } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'income') {
        inc += t.amount;
      } else if (t.type === 'expense' && t.category !== 'reimbursement_payout') {
        exp += t.amount;
      }
    });
    return { filteredIncome: inc, filteredExpense: exp, filteredNet: inc - exp };
  }, [filteredTransactions]);

  // Handle CSV Export
  const handleExportCsv = () => {
    const headers = ['日付', '種別', 'カテゴリー', '支出先/納入先', '金額(円)', '決済方法', '支払元/立替者', '立替精算状態', '摘要/内容', '記録者', '領収書/メモ'];
    const rows = filteredTransactions.map(t => [
      t.date,
      t.type === 'income' ? '収入' : '支出',
      getCategoryMeta(t.category, t.type).label,
      `"${(t.vendor || '').replace(/"/g, '""')}"`,
      t.amount,
      PAYMENT_METHODS[t.paymentMethod]?.label || t.paymentMethod,
      t.type === 'expense' 
        ? (t.paymentSource === 'out_of_pocket' ? `立替 (${t.payerName || '個人'})` : 'クラブ資金') 
        : 'クラブ収入',
      t.type === 'expense' && t.paymentSource === 'out_of_pocket' 
        ? (t.isReimbursed ? `精算済 (${t.reimbursedAt || ''})` : '未精算') 
        : '-',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.recordedBy || '').replace(/"/g, '""')}"`,
      `"${(t.receiptNote || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const dateStr = getTodayString();
    downloadCsv(`バドミントンクラブ_出納帳_${dateStr}.csv`, csvContent);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Header & Actions Bento Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-6 shadow-md">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-text tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <span>収支出納帳</span>
          </h2>
          <p className="text-[10px] sm:text-sm text-text-subtle leading-snug mt-1">
            支出先の記録、立替とクラブ口座資金の管理、CSV出力
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenReport}
            className="px-3.5 py-2.5 text-xs font-bold text-text-muted bg-surface-subtle border border-border hover:border-accent/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer hidden md:flex"
          >
            <Printer className="w-4 h-4 text-accent" />
            <span>印刷</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 text-xs font-bold text-text-muted bg-surface-subtle border border-border hover:border-accent/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-accent" />
            <span>CSV出力</span>
          </button>

          <button
            type="button"
            onClick={onOpenTransactionModal}
            className="px-4 py-2.5 text-xs sm:text-sm font-bold text-accent-text bg-accent hover:bg-accent-hover rounded-xl transition-all active:scale-[0.98] shadow-md flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>収支を記帳</span>
          </button>
        </div>
      </div>

      {/* Summary Bento Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">表示中の総収入</div>
          <div className="text-xl sm:text-3xl font-extrabold text-accent mt-1 tabular-nums">
            +{formatCurrency(filteredIncome)}
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">表示中の総支出</div>
          <div className="text-xl sm:text-3xl font-extrabold text-rose-400 mt-1 tabular-nums">
            -{formatCurrency(filteredExpense)}
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">表示中の収支差額</div>
          <div className={`text-xl sm:text-3xl font-extrabold mt-1 tabular-nums ${
            filteredNet >= 0 ? 'text-accent' : 'text-rose-400'
          }`}>
            {filteredNet >= 0 ? `+${formatCurrency(filteredNet)}` : formatCurrency(filteredNet)}
          </div>
        </div>
      </div>

      {/* Search & Multi-Filters Toolbar */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-md space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              placeholder="支出先・内容・記録者・立替者で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-surface-subtle border border-border rounded-xl text-text placeholder-text-subtle text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text text-xs font-bold focus:outline-none"
            >
              <option value="all">全種別 (収入・支出)</option>
              <option value="income">収入のみ</option>
              <option value="expense">支出のみ</option>
            </select>
          </div>

          {/* Payment Source / Pocket-money Debt Filter */}
          <div className="lg:col-span-3">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text text-xs font-bold focus:outline-none"
            >
              <option value="all">全支払元 (クラブ資金・立替)</option>
              <option value="out_of_pocket_unpaid">⚠️ 立替未精算のみ</option>
              <option value="out_of_pocket_all">個人立替 (精算済含む)</option>
              <option value="club_funds">クラブ資金から直接支払</option>
            </select>
          </div>

          {/* Month Filter */}
          <div className="lg:col-span-3">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text text-xs font-bold focus:outline-none"
            >
              <option value="all">全期間 (月指定なし)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m.replace('-', '年')}月
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Active Filters Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted pt-1 border-t border-border-subtle">
          <div>
            表示中: <strong className="text-text font-bold">{filteredTransactions.length}</strong> 件 / 全 {transactions.length} 件
          </div>
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text font-bold transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>日付順: {sortOrder === 'desc' ? '新しい順' : '古い順'}</span>
          </button>
        </div>
      </div>

      {/* Transactions Table / List */}
      <div className="bg-surface border border-border rounded-2xl shadow-md overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center text-text-subtle text-xs space-y-2">
            <Receipt className="w-8 h-8 opacity-60 mx-auto" />
            <p className="font-bold text-text-muted">該当する収支記録はありません</p>
            <p>検索条件を変更するか、右上の「収支を記帳」から登録してください。</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const meta = getCategoryMeta(tx.category, tx.type);
              const isOutOfPocket = tx.type === 'expense' && tx.paymentSource === 'out_of_pocket';

              return (
                <div 
                  key={tx.id} 
                  className="p-4 sm:p-5 hover:bg-surface-hover transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Left info */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    
                    {/* Category Icon */}
                    <div className={`p-2.5 rounded-full border shrink-0 ${
                      isIncome 
                        ? 'bg-accent/10 border-accent/20 text-accent' 
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      <CategoryIcon name={meta.icon} className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-text-muted">{formatDate(tx.date)}</span>
                        
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isIncome 
                            ? 'bg-accent/10 text-accent border-accent/20' 
                            : 'bg-surface-muted text-text-muted border-border'
                        }`}>
                          {meta.label}
                        </span>

                        {/* Vendor tag */}
                        {tx.vendor && (
                          <span className="px-2 py-0.5 bg-surface-subtle text-text-muted border border-border rounded-full font-medium text-[10px] flex items-center gap-1">
                            <Store className="w-3 h-3 text-text-muted" />
                            <span>{tx.vendor}</span>
                          </span>
                        )}

                        {/* Out of Pocket Debt Badge */}
                        {isOutOfPocket && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${
                            tx.isReimbursed
                              ? 'bg-accent/15 text-accent border-accent/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/40 animate-pulse'
                          }`}>
                            <CircleDollarSign className="w-3 h-3" />
                            <span>
                              {tx.isReimbursed 
                                ? `立替精算済 (${tx.payerName || '個人'})` 
                                : `立替未精算: ${tx.payerName || '個人'}`}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-text text-sm">
                        {tx.description}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-text-subtle flex-wrap">
                        <span>決済: {PAYMENT_METHODS[tx.paymentMethod]?.label || tx.paymentMethod}</span>
                        <span>記帳者: {tx.recordedBy}</span>
                        {tx.receiptNote && <span className="italic text-text-muted">({tx.receiptNote})</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right Amount & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <div className="text-left sm:text-right">
                      <div className={`text-lg sm:text-xl font-black tabular-nums ${
                        isIncome ? 'text-accent' : 'text-rose-400'
                      }`}>
                        {isIncome ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent/40 text-text-muted hover:text-accent rounded-xl transition-colors cursor-pointer"
                        title="編集"
                        aria-label="出納記録を編集"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTxToDelete(tx)}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-rose-500/50 text-text-muted hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                        title="出納記録を削除"
                        aria-label="出納記録を削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Transaction Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">出納記録の削除</h3>
                <p className="text-xs text-text-muted">会計帳簿からこの記録を削除します</p>
              </div>
            </div>

            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">日付:</span>
                <span className="font-bold text-text">{txToDelete.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">摘要・内容:</span>
                <span className="font-bold text-text">{txToDelete.description}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">金額:</span>
                <span className={`font-black text-sm tabular-nums ${
                  txToDelete.type === 'income' ? 'text-accent' : 'text-rose-400'
                }`}>
                  {txToDelete.type === 'income' ? `+${formatCurrency(txToDelete.amount)}` : `-${formatCurrency(txToDelete.amount)}`}
                </span>
              </div>
              {txToDelete.payerName && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-semibold">立替者:</span>
                  <span className="font-bold text-amber-400">{txToDelete.payerName}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              出納記録「<strong className="text-text font-bold">{txToDelete.description}</strong>」を削除してよろしいですか？
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteTransaction(txToDelete.id);
                  setTxToDelete(null);
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
