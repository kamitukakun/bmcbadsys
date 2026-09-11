import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit3, Receipt, Tag, DollarSign, Calendar, CreditCard, User, Building, Landmark, Sparkles } from 'lucide-react';
import { Transaction, TransactionType, PaymentMethod, PaymentSource, Member } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_SOURCES } from '../data/categories';
import { formatCurrency } from '../utils/formatters';
import { getTodayString } from '../utils/dateUtils';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt'>, id?: string) => void;
  initialTransaction?: Transaction | null;
  treasurerName: string;
  members: Member[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTransaction,
  treasurerName,
  members,
}) => {
  const today = getTodayString();

  const [type, setType] = useState<TransactionType>('expense');
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<string>('shuttle');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [vendor, setVendor] = useState(''); // 支出先
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('club_funds'); // クラブ資金 vs 立替
  const [payerMemberId, setPayerMemberId] = useState<string>(members[0]?.id || '');
  const [description, setDescription] = useState('');
  const [recordedBy, setRecordedBy] = useState(treasurerName || '会計係');
  const [receiptNote, setReceiptNote] = useState('');

  useEffect(() => {
    if (initialTransaction) {
      setType(initialTransaction.type);
      setDate(initialTransaction.date);
      setCategory(initialTransaction.category);
      setAmount(initialTransaction.amount);
      setPaymentMethod(initialTransaction.paymentMethod);
      setVendor(initialTransaction.vendor || '');
      setPaymentSource(initialTransaction.paymentSource || 'club_funds');
      setPayerMemberId(initialTransaction.payerMemberId || members[0]?.id || '');
      setDescription(initialTransaction.description);
      setRecordedBy(initialTransaction.recordedBy);
      setReceiptNote(initialTransaction.receiptNote || '');
    } else {
      setType('expense');
      setDate(today);
      setCategory('shuttle');
      setAmount('');
      setPaymentMethod('cash');
      setVendor('');
      setPaymentSource('club_funds');
      setPayerMemberId(members[0]?.id || '');
      setDescription('');
      setRecordedBy(treasurerName || '会計係');
      setReceiptNote('');
    }
  }, [initialTransaction, isOpen, treasurerName, members, today]);

  if (!isOpen) return null;

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'income') {
      setCategory('event_fee');
      setPaymentSource('club_funds');
    } else {
      setCategory('shuttle');
    }
  };

  const activeCategories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    const payerMember = members.find(m => m.id === payerMemberId);

    onSave({
      date,
      type,
      category: category as any,
      amount: Number(amount),
      paymentMethod,
      vendor: vendor.trim() || undefined,
      paymentSource: type === 'expense' ? paymentSource : 'club_funds',
      payerMemberId: type === 'expense' && paymentSource === 'out_of_pocket' ? payerMemberId : undefined,
      payerName: type === 'expense' && paymentSource === 'out_of_pocket' ? (payerMember ? payerMember.name : undefined) : undefined,
      isReimbursed: initialTransaction?.isReimbursed || false,
      reimbursedAt: initialTransaction?.reimbursedAt,
      description: description.trim() || (activeCategories as any)[category]?.label || '収支記帳',
      recordedBy,
      receiptNote: receiptNote.trim() || undefined,
    }, initialTransaction?.id);

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full shadow-2xl border border-border flex flex-col max-h-[85vh] my-auto relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
            {initialTransaction ? (
              <>
                <Edit3 className="w-4 h-4 text-accent" />
                <span>出納記録の編集</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4 text-accent" />
                <span>収支の記帳</span>
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-3 sm:space-y-4 text-xs overflow-y-auto flex-1">
          
          {/* Type Toggle: 支出 vs 収入 */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-surface-subtle border border-border rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              支出
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2.5 rounded-xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer ${
                type === 'income'
                  ? 'bg-accent text-accent-text shadow-md font-black'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              収入
            </button>
          </div>

          {/* 支出の場合: 支払元（クラブ資金 vs ポケットマネー立替）の選択 */}
          {type === 'expense' && (
            <div className="p-3.5 bg-surface-subtle rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-text">支払元の選択 (立替)</label>
                {paymentSource === 'out_of_pocket' && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                    要返済・債務として記録
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentSource('club_funds')}
                  className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    paymentSource === 'club_funds'
                      ? 'bg-accent/20 border-accent/50 text-accent'
                      : 'bg-surface border-border text-text-muted'
                  }`}
                >
                  <div className="text-xs">クラブ資金から出金</div>
                  <div className="text-[10px] font-normal text-text-muted mt-0.5">口座・手元現金から直接支払</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource('out_of_pocket')}
                  className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    paymentSource === 'out_of_pocket'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-surface border-border text-text-muted'
                  }`}
                >
                  <div className="text-xs">個人立替</div>
                  <div className="text-[10px] font-normal text-text-muted mt-0.5">後でクラブ残高から返済精算</div>
                </button>
              </div>

              {paymentSource === 'out_of_pocket' && (
                <div className="pt-2">
                  <label className="block text-text-muted font-bold mb-1">立替者</label>
                  <select
                    value={payerMemberId}
                    onChange={(e) => setPayerMemberId(e.target.value)}
                    className="w-full py-2 px-2.5 sm:p-2.5 bg-surface border border-amber-500/50 rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    required
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id} className="bg-surface text-text">
                        {m.name} ({m.role === 'leader' ? '代表' : m.role === 'officer' ? '役員' : '部員'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block font-bold text-text mb-1">取引日付 *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>

            <div className="min-w-0">
              <label className="block font-bold text-text mb-1">勘定科目 *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              >
                {Object.values(activeCategories).map((c: any) => (
                  <option key={c.key} value={c.key} className="bg-surface text-text">
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 支出先 (Vendor) / 納入先 */}
          {type === 'expense' && (
            <div>
              <label className="block font-bold text-text mb-1">支出先</label>
              <input
                type="text"
                placeholder="例: ラケットショップ、体育館、バドミントン協会"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text placeholder-text-subtle focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Amount & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">金額 *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-text-subtle">¥</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  required
                  min="1"
                  step="1"
                  value={amount ?? ''}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-7 pr-3 py-2 sm:py-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-black text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-text mb-1">決済方法</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-semibold sm:leading-normal focus:outline-none focus:border-accent"
              >
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-surface text-text">
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-text mb-1">摘要</label>
            <input
              type="text"
              placeholder="例: AS-700シャトル 1箱購入、夜間枠利用料"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text placeholder-text-subtle focus:outline-none focus:border-accent"
            />
          </div>

          {/* Receipt Note & Recorded By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">領収書メモ</label>
              <input
                type="text"
                placeholder="例: 領収証あり(番号: 1234)"
                value={receiptNote}
                onChange={(e) => setReceiptNote(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text placeholder-text-subtle focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block font-bold text-text mb-1">記帳担当者</label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          </div>

          <div className="flex gap-2.5 p-4 sm:p-5 border-t border-border bg-surface shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              {initialTransaction ? '保存する' : '記帳する'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
