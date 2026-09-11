import React, { useState, useMemo } from 'react';
import { 
  CircleDollarSign, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  User, 
  AlertCircle, 
  History, 
  ArrowRight,
  ShieldCheck,
  Building,
  Store,
  DollarSign,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { Transaction, ReimbursementRecord, Member, PaymentMethod } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PAYMENT_METHODS } from '../data/categories';
import { getTodayString } from '../utils/dateUtils';

interface ReimbursementsViewProps {
  transactions: Transaction[];
  reimbursements: ReimbursementRecord[];
  members: Member[];
  onExecuteReimbursement: (
    memberId: string,
    memberName: string,
    amount: number,
    transactionIds: string[],
    paymentMethod: PaymentMethod,
    notes: string,
    date: string
  ) => void;
  onDeleteReimbursement?: (reimbId: string) => void;
  onDismissTransaction?: (txId: string, reason?: string) => void;
  onDeleteTransaction?: (txId: string) => void;
}

export const ReimbursementsView: React.FC<ReimbursementsViewProps> = ({
  transactions,
  reimbursements,
  members,
  onExecuteReimbursement,
  onDeleteReimbursement,
  onDismissTransaction,
  onDeleteTransaction,
}) => {
  const today = getTodayString();

  const [selectedMemberKey, setSelectedMemberKey] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [payoutMode, setPayoutMode] = useState<'single' | 'batch'>('batch');
  const [payoutDate, setPayoutDate] = useState(today);
  const [payoutMethod, setPayoutMethod] = useState<PaymentMethod>('cash');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [reimbToDelete, setReimbToDelete] = useState<ReimbursementRecord | null>(null);
  const [txToDismiss, setTxToDismiss] = useState<Transaction | null>(null);
  const [dismissReason, setDismissReason] = useState<string>('');

  // 1. ポケットマネー立替の支出取引を抽出
  const outOfPocketTransactions = useMemo(() => {
    return transactions.filter(tx => tx.type === 'expense' && tx.paymentSource === 'out_of_pocket');
  }, [transactions]);

  // 未精算の立替一覧
  const unreimbursedTransactions = useMemo(() => {
    return outOfPocketTransactions.filter(tx => !tx.isReimbursed);
  }, [outOfPocketTransactions]);

  // 精算済みの立替一覧
  const reimbursedTransactions = useMemo(() => {
    return outOfPocketTransactions.filter(tx => tx.isReimbursed);
  }, [outOfPocketTransactions]);

  // 2. クラブが名簿に返すべき未精算立替金総額
  const totalUnreimbursedAmount = useMemo(() => {
    return unreimbursedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [unreimbursedTransactions]);

  // 3. 名簿別の未精算立替金残高集計
  const memberDebtSummary = useMemo(() => {
    const summaryMap: Record<string, { key: string; memberId: string; name: string; totalDebt: number; txList: Transaction[] }> = {};

    unreimbursedTransactions.forEach(tx => {
      const key = tx.payerMemberId || tx.payerName || 'unknown';
      const name = tx.payerName || members.find(m => m.id === tx.payerMemberId)?.name || '未設定';
      
      if (!summaryMap[key]) {
        summaryMap[key] = {
          key,
          memberId: tx.payerMemberId || '',
          name,
          totalDebt: 0,
          txList: [],
        };
      }
      summaryMap[key].totalDebt += tx.amount;
      summaryMap[key].txList.push(tx);
    });

    return Object.values(summaryMap);
  }, [unreimbursedTransactions, members]);

  // 返済モーダルを開く (個別返済: specificTxId を指定、一括返済: specificTxId なし)
  const handleOpenPayoutModal = (memberKeyOrId: string, specificTxId?: string | null) => {
    const targetDebt = memberDebtSummary.find(d => d.key === memberKeyOrId || d.memberId === memberKeyOrId || d.name === memberKeyOrId);
    if (!targetDebt) return;

    setSelectedMemberKey(targetDebt.key);
    setPayoutDate(today);
    setPayoutMethod('cash');
    setPayoutNotes('');

    if (specificTxId) {
      setPayoutMode('single');
      setSelectedTxId(specificTxId);
    } else {
      setPayoutMode(targetDebt.txList.length > 1 ? 'batch' : 'single');
      setSelectedTxId(targetDebt.txList[0]?.id || null);
    }
    setShowPayoutModal(true);
  };

  const selectedDebtData = useMemo(() => {
    if (!selectedMemberKey) return null;
    return memberDebtSummary.find(d => d.key === selectedMemberKey) || null;
  }, [selectedMemberKey, memberDebtSummary]);

  // 個別返済時に選択されている取引
  const selectedSingleTx = useMemo(() => {
    if (!selectedDebtData) return null;
    if (selectedTxId) {
      return selectedDebtData.txList.find(t => t.id === selectedTxId) || selectedDebtData.txList[0] || null;
    }
    return selectedDebtData.txList[0] || null;
  }, [selectedDebtData, selectedTxId]);

  // 今回の返済対象取引リスト
  const targetTxList = useMemo(() => {
    if (!selectedDebtData) return [];
    if (payoutMode === 'single') {
      return selectedSingleTx ? [selectedSingleTx] : [];
    }
    return selectedDebtData.txList;
  }, [selectedDebtData, payoutMode, selectedSingleTx]);

  // 今回の返済金額
  const currentPayoutAmount = useMemo(() => {
    if (!selectedDebtData) return 0;
    if (payoutMode === 'single') {
      return selectedSingleTx ? selectedSingleTx.amount : 0;
    }
    return selectedDebtData.totalDebt;
  }, [selectedDebtData, payoutMode, selectedSingleTx]);

  // 返済処理実行
  const handleConfirmPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtData || targetTxList.length === 0) return;

    const txIds = targetTxList.map(t => t.id);
    const amount = currentPayoutAmount;

    const defaultNotes = targetTxList.length === 1
      ? `${selectedDebtData.name} 様への立替返済 (${formatDate(targetTxList[0].date)} ${targetTxList[0].description})`
      : `${selectedDebtData.name} 様への立替金一括精算 (${txIds.length}件分)`;

    onExecuteReimbursement(
      selectedDebtData.memberId,
      selectedDebtData.name,
      amount,
      txIds,
      payoutMethod,
      payoutNotes.trim() || defaultNotes,
      payoutDate
    );

    setShowPayoutModal(false);
    setSelectedMemberKey(null);
    setSelectedTxId(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header Bento Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-400">
              <CircleDollarSign className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text tracking-tight">
              立替金・借入精算管理
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            個人で立替えた支払いの債務追跡とクラブ残高からの返済・精算台帳
          </p>
        </div>

        {totalUnreimbursedAmount > 0 ? (
          <div className="px-4 py-2 bg-amber-500/15 border border-amber-500/30 rounded-full flex items-center gap-2.5 self-start sm:self-auto">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] font-bold uppercase text-amber-300">未精算の立替債務</div>
              <div className="text-sm font-black text-amber-400 tabular-nums">
                クラブ要返済: {formatCurrency(totalUnreimbursedAmount)}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2 bg-accent/15 border border-accent/30 rounded-full flex items-center gap-2 text-xs font-bold text-accent self-start sm:self-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span>すべての立替金は精算済みです</span>
          </div>
        )}
      </div>

      {/* Member Debt Cards Grid (誰にいくら返さなきゃいけないか) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            <span>立替者別の未精算債務 (返済待ち)</span>
          </h3>
          <span className="text-xs text-text-muted">{memberDebtSummary.length} 名の立替待ち</span>
        </div>

        {memberDebtSummary.length === 0 ? (
          <div className="p-8 bg-surface border border-border rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-accent mx-auto" />
            <p className="text-text font-bold text-sm">現在、未返済の個人立替金はありません</p>
            <p className="text-text-muted text-xs">
              「収支の記帳」で支払元を「個人立替」に指定すると、ここに自動集計されます。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberDebtSummary.map((debt) => (
              <div 
                key={debt.key} 
                className="bg-surface border border-amber-500/40 rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">立替者</div>
                      <h4 className="text-base font-bold text-text">{debt.name}</h4>
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 font-bold text-xs rounded-full border border-amber-500/30">
                      {debt.txList.length} 件 未精算
                    </span>
                  </div>

                  <div className="p-3 bg-surface-subtle rounded-xl border border-border space-y-1">
                    <div className="text-[10px] text-text-muted font-semibold">クラブから返済すべき金額 (未精算合計)</div>
                    <div className="text-2xl font-black text-amber-400 tabular-nums">
                      {formatCurrency(debt.totalDebt)}
                    </div>
                  </div>

                  {/* Transaction breakdown previews with individual 返済 buttons */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-muted px-0.5">
                      <span>未精算の内訳 ({debt.txList.length}件):</span>
                      <span className="text-text-muted font-normal">個別返済可</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {debt.txList.map(tx => (
                        <div key={tx.id} className="p-2.5 bg-surface-subtle rounded-xl border border-border flex items-center justify-between text-[11px] gap-2 hover:border-accent transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-text">{formatDate(tx.date)}</span>
                              {tx.vendor && (
                                <span className="text-[10px] text-text-muted truncate max-w-[120px]">[{tx.vendor}]</span>
                              )}
                            </div>
                            <div className="text-text-muted truncate font-medium">{tx.description}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-extrabold text-amber-400 tabular-nums">
                              {formatCurrency(tx.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenPayoutModal(debt.key, tx.id)}
                              className="px-3 min-h-[40px] bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 hover:text-amber-200 border border-amber-500/40 rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1 shrink-0 active:scale-95"
                              title="この立替のみ個別返済"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>返済</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Batch Payout Action */}
                <div className="pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => handleOpenPayoutModal(debt.key, null)}
                    className="w-full py-3 sm:py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                  >
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                    <span>
                      {debt.txList.length > 1
                        ? `全${debt.txList.length}件を一括返済 (${formatCurrency(debt.totalDebt)})`
                        : `返済する (${formatCurrency(debt.totalDebt)})`}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unreimbursed Detail Table Bento Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>未精算の立替明細一覧</span>
          </h3>
          <span className="text-xs text-text-muted">計 {unreimbursedTransactions.length} 件</span>
        </div>

        {unreimbursedTransactions.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-xs">
            未精算の立替明細はありません。
          </div>
        ) : (
          <div className="space-y-2.5">
            {unreimbursedTransactions.map(tx => (
              <div key={tx.id} className="p-3.5 bg-surface-subtle rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text">{formatDate(tx.date)}</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full font-bold text-[10px]">
                      立替者: {tx.payerName || '未設定'}
                    </span>
                    {tx.vendor && (
                      <span className="px-2 py-0.5 bg-surface-hover text-text-muted rounded-full font-medium text-[10px] flex items-center gap-1 border border-border">
                        <Store className="w-3 h-3 text-text-muted" />
                        <span>支出先: {tx.vendor}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-text font-semibold">{tx.description}</div>
                  {tx.receiptNote && (
                    <div className="text-[11px] text-text-muted italic">{tx.receiptNote}</div>
                  )}
                </div>

                <div className="text-right justify-end shrink-0 flex items-center gap-2.5">
                  <div className="mr-1">
                    <div className="text-base font-black text-amber-400 tabular-nums">
                      {formatCurrency(tx.amount)}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      立替時決済: {PAYMENT_METHODS[tx.paymentMethod]?.label || tx.paymentMethod}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenPayoutModal(tx.payerMemberId || tx.payerName || 'unknown', tx.id)}
                    className="px-3 min-h-[40px] bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="この立替のみ返済"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>返済</span>
                  </button>
                  {(onDismissTransaction || onDeleteTransaction) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onDismissTransaction) {
                          setTxToDismiss(tx);
                          setDismissReason('');
                        } else if (onDeleteTransaction) {
                          onDeleteTransaction(tx.id);
                        }
                      }}
                      className="px-3 min-h-[40px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl border border-rose-500/30 transition-all cursor-pointer flex items-center justify-center"
                      title="返済せずに削除（履歴として保存され復元可能）"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reimbursement Payout History Log Bento Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <History className="w-4 h-4 text-accent" />
            <span>精算・返済完了の履歴台帳</span>
          </h3>
          <div className="text-xs text-text-muted flex items-center gap-2">
            <span>計 {reimbursements.length} 件</span>
            {reimbursements.some(r => r.status === 'dismissed_without_payout') && (
              <span className="text-[11px] px-2 py-0.5 bg-surface-subtle text-rose-300 rounded-full border border-rose-500/20 font-medium">
                返済せず削除: {reimbursements.filter(r => r.status === 'dismissed_without_payout').length}件
              </span>
            )}
          </div>
        </div>

        {reimbursements.length === 0 ? (
          <div className="text-center py-6 text-text-muted text-xs">
            まだ返済精算の履歴はありません。
          </div>
        ) : (
          <div className="space-y-2.5">
            {reimbursements.map(rb => {
              const isDismissed = rb.status === 'dismissed_without_payout';
              return (
                <div 
                  key={rb.id} 
                  className={`p-3.5 bg-surface-subtle rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                    isDismissed ? 'border-border' : 'border-accent/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text">{formatDate(rb.date)}</span>
                      {isDismissed ? (
                        <span className="px-2 py-0.5 bg-surface text-text-muted border border-border rounded-full font-bold text-[10px]">
                          立替者: {rb.memberName}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full font-bold text-[10px]">
                          返済先: {rb.memberName}
                        </span>
                      )}

                      {isDismissed ? (
                        <span className="px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full font-bold text-[10px] flex items-center gap-1">
                          <span>返済せず削除</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded-full font-bold text-[10px] flex items-center gap-1">
                          <span>返済完了</span>
                        </span>
                      )}

                      {!isDismissed && (
                        <span className="px-2 py-0.5 bg-surface text-text-muted rounded-full text-[10px] border border-border">
                          返済方法: {PAYMENT_METHODS[rb.paymentMethod]?.label || rb.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="text-text-muted text-[11px] font-medium">{rb.notes}</div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div>
                      {isDismissed ? (
                        <>
                          <div className="text-base font-bold text-text-muted tabular-nums">
                            対象額: {formatCurrency(rb.amount)}
                          </div>
                          <div className="text-[10px] text-text-muted flex items-center justify-end gap-1">
                            <span>出納帳の出金なし (精算除外)</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-base font-black text-accent tabular-nums">
                            精算済: {formatCurrency(rb.amount)}
                          </div>
                          <div className="text-[10px] text-text-muted flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3 h-3 text-accent" />
                            <span>クラブ出納帳に出金記帳済</span>
                          </div>
                        </>
                      )}
                    </div>
                    {onDeleteReimbursement && (
                      <button
                        type="button"
                        onClick={() => setReimbToDelete(rb)}
                        className={`px-3 min-h-[40px] font-bold text-xs rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isDismissed
                            ? 'bg-amber-400/15 hover:bg-amber-400/30 text-amber-300 border-amber-500/30'
                            : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}
                        title={isDismissed ? "この履歴を削除し、元の未精算状態に復元" : "精算を取り消す"}
                      >
                        {isDismissed ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>未精算に戻す</span>
                          </>
                        ) : (
                          <span>削除</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payout Execution Modal */}
      {showPayoutModal && selectedDebtData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0 bg-surface">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <CircleDollarSign className="w-5 h-5 text-amber-400" />
                <span>立替金の返済・精算実行</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1 min-h-0">
                {/* Mode Selector (Only if multiple unsettled transactions) */}
                {selectedDebtData.txList.length > 1 && (
                  <div>
                    <label className="block font-bold text-text mb-1.5">精算方式</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-surface-subtle rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutMode('single');
                          if (!selectedTxId && selectedDebtData.txList.length > 0) {
                            setSelectedTxId(selectedDebtData.txList[0].id);
                          }
                        }}
                        className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          payoutMode === 'single'
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        <span>個別返済</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutMode('batch');
                          setSelectedTxId(null);
                        }}
                        className={`py-2 px-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          payoutMode === 'batch'
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        <span>全件一括返済</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* If Single Mode with multiple items: Transaction Selector */}
                {payoutMode === 'single' && selectedDebtData.txList.length > 1 && (
                  <div>
                    <label className="block font-bold text-text mb-1.5">返済する立替明細を選択 *</label>
                    <select
                      value={selectedSingleTx?.id || ''}
                      onChange={(e) => setSelectedTxId(e.target.value)}
                      className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text font-bold focus:outline-none focus:border-amber-400"
                    >
                      {selectedDebtData.txList.map(tx => (
                        <option key={tx.id} value={tx.id}>
                          {formatDate(tx.date)} - {tx.description} ({formatCurrency(tx.amount)}) {tx.vendor ? `[${tx.vendor}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Debt Summary Box */}
                <div className="p-4 bg-surface-subtle rounded-xl border border-amber-500/30 space-y-2.5">
                  <div className="flex justify-between items-center text-text-muted">
                    <span>返済先名簿:</span>
                    <span className="font-bold text-text text-sm">{selectedDebtData.name} 様</span>
                  </div>
                  <div className="flex justify-between items-center text-text-muted">
                    <span>返済対象:</span>
                    <span className="font-semibold text-text">
                      {payoutMode === 'single' ? '個別返済 (1件のみ)' : `全件一括返済 (全 ${selectedDebtData.txList.length} 件)`}
                    </span>
                  </div>

                  {payoutMode === 'single' && selectedSingleTx && (
                    <div className="p-2.5 bg-surface rounded-xl border border-border text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-text">
                        <span>{formatDate(selectedSingleTx.date)} {selectedSingleTx.description}</span>
                        <span className="text-amber-400 tabular-nums">{formatCurrency(selectedSingleTx.amount)}</span>
                      </div>
                      {selectedSingleTx.vendor && (
                        <div className="text-[10px] text-text-muted">支出先: {selectedSingleTx.vendor}</div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex justify-between items-center">
                    <span className="font-bold text-text">今回の返済額:</span>
                    <span className="text-xl font-black text-amber-400 tabular-nums">
                      {formatCurrency(currentPayoutAmount)}
                    </span>
                  </div>

                  {payoutMode === 'single' && selectedDebtData.txList.length > 1 && (
                    <div className="flex justify-between items-center text-[10px] text-text-muted pt-0.5">
                      <span>返済後の未精算残高:</span>
                      <span className="font-bold text-text tabular-nums">
                        {formatCurrency(selectedDebtData.totalDebt - currentPayoutAmount)} (残り {selectedDebtData.txList.length - 1} 件)
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-text mb-1">返済日 (出金日) *</label>
                  <input
                    type="date"
                    required
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block font-bold text-text mb-1">クラブ残高からの返済方法 *</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value as PaymentMethod)}
                    className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="cash">現金</option>
                    <option value="paypay">PayPay送金</option>
                    <option value="bank_transfer">銀行振込</option>
                    <option value="line_pay">LINE Pay</option>
                    <option value="other">その他</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-text mb-1">備考 (任意)</label>
                  <input
                    type="text"
                    placeholder={payoutMode === 'single' && selectedSingleTx 
                      ? `例: ${selectedSingleTx.description}の返済完了` 
                      : "例: PayPayにて送金返済完了"}
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text placeholder-text-muted focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-[11px] text-text leading-relaxed">
                  {payoutMode === 'single' ? (
                    <>
                      ※ この立替明細（<strong className="text-amber-400">{formatCurrency(currentPayoutAmount)}</strong>）のみを「精算済み」とし、クラブ出納帳に出金（立替精算）を自動記帳します。他の立替は未精算のまま残ります。
                    </>
                  ) : (
                    <>
                      ※ 対象の全 {selectedDebtData.txList.length} 件（合計 <strong className="text-amber-400">{formatCurrency(currentPayoutAmount)}</strong>）を一括で「精算済み」とし、クラブ出納帳に出金（立替精算）を自動記帳します。
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 p-4 sm:p-5 border-t border-border bg-surface shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4 shrink-0" />
                  <span>一括返済する</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Restore Reimbursement Confirmation Modal */}
      {reimbToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            {reimbToDelete.status === 'dismissed_without_payout' ? (
              <>
                <div className="flex items-center gap-3 text-amber-400 border-b border-border pb-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <RotateCcw className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text">立替明細を未精算に戻す (復元)</h3>
                    <p className="text-xs text-text-muted">履歴から削除し、元の未精算立替として復元します</p>
                  </div>
                </div>

                <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">記録日:</span>
                    <span className="font-bold text-text">{formatDate(reimbToDelete.date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">立替者:</span>
                    <span className="font-bold text-amber-400">{reimbToDelete.memberName} 様</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">立替金額:</span>
                    <span className="font-black text-sm text-amber-400 tabular-nums">
                      {formatCurrency(reimbToDelete.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">備考:</span>
                    <span className="font-medium text-text truncate max-w-[200px]">{reimbToDelete.notes}</span>
                  </div>
                </div>

                <p className="text-xs text-text leading-relaxed">
                  この履歴を削除して、元の立替明細を未精算一覧に戻しますか？<br />
                  <span className="text-text-muted">
                    復元後は未精算一覧および立替者別カードに再び表示され、個別に返済・精算できるようになります。
                  </span>
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReimbToDelete(null)}
                    className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteReimbursement) {
                        onDeleteReimbursement(reimbToDelete.id);
                      }
                      setReimbToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>未精算に戻す (復元)</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
                    <Trash2 className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text">立替精算の取り消し</h3>
                    <p className="text-xs text-text-muted">精算記録を削除し、取引状態を復元します</p>
                  </div>
                </div>

                <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">精算日:</span>
                    <span className="font-bold text-text">{formatDate(reimbToDelete.date)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">精算相手 (立替者):</span>
                    <span className="font-bold text-amber-400">{reimbToDelete.memberName} 様</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted font-semibold">精算金額:</span>
                    <span className="font-black text-sm text-accent tabular-nums">
                      {formatCurrency(reimbToDelete.amount)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-text leading-relaxed">
                  この精算を取り消しますか？<br />
                  <span className="text-text-muted">
                    元の立替取引は未精算に戻り、精算時に作成された出金取引は削除されます。
                  </span>
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReimbToDelete(null)}
                    className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onDeleteReimbursement) {
                        onDeleteReimbursement(reimbToDelete.id);
                      }
                      setReimbToDelete(null);
                    }}
                    className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>精算を取り消す</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dismiss Unreimbursed Transaction Modal (返済せず削除・履歴化) */}
      {txToDismiss && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">立替明細の削除 (返済なし)</h3>
                <p className="text-xs text-text-muted">返済せずに一覧から削除し、履歴台帳に保存します</p>
              </div>
            </div>

            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">立替日:</span>
                <span className="font-bold text-text">{formatDate(txToDismiss.date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">立替者:</span>
                <span className="font-bold text-amber-400">{txToDismiss.payerName || '未設定'} 様</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">立替金額:</span>
                <span className="font-black text-sm text-amber-400 tabular-nums">
                  {formatCurrency(txToDismiss.amount)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">内容:</span>
                <span className="font-medium text-text truncate max-w-[200px]">{txToDismiss.description}</span>
              </div>
              {txToDismiss.vendor && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-semibold">支出先:</span>
                  <span className="text-text">{txToDismiss.vendor}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1.5">備考 (任意)</label>
              <input
                type="text"
                placeholder="例: 自己負担のため精算不要、誤記取消など"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="w-full p-2.5 bg-surface-subtle border border-border rounded-xl text-text placeholder-text-muted text-xs focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-text leading-relaxed">
              ※ この立替明細をクラブからの返済を行わずに削除します。<br />
              削除した記録は「精算・返済完了の履歴台帳」に【返済せず削除】として安全に保持され、いつでも未精算状態に戻す（復元する）ことができます。
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setTxToDismiss(null);
                  setDismissReason('');
                }}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDismissTransaction) {
                    onDismissTransaction(txToDismiss.id, dismissReason);
                  } else if (onDeleteTransaction) {
                    onDeleteTransaction(txToDismiss.id);
                  }
                  setTxToDismiss(null);
                  setDismissReason('');
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>返済せずに削除</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
