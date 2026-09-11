import { Transaction } from '../types';

export interface FinancialSummary {
  /** クラブ総収入 */
  totalIncome: number;
  /** 会計上の活動支出 (体育館代・シャトル代等。reimbursement_payout などの内部精算移動は除外) */
  totalExpense: number;
  /** クラブ手元実残高 (収入 - クラブ資金からの実出金) */
  currentBalance: number;
  /** 未精算立替金 (個人が立て替えており、まだ返済されていない金額) */
  unreimbursedDebtAmount: number;
  /** クラブ資金からの実出金合計 (立替返済出金を含む、手元資金からの総出金) */
  actualClubFundExpenses: number;
  /** 収入カテゴリ別集計 */
  incomeByCategory: Record<string, number>;
  /** 支出カテゴリ別集計 (活動支出のみ) */
  expenseByCategory: Record<string, number>;
}

/**
 * 取引一覧から会計サマリー（総収入・活動支出・クラブ実残高・未精算立替金等）を一元計算する
 */
export function calculateFinancialSummary(transactions: Transaction[]): FinancialSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let actualClubFundExpenses = 0;
  let unreimbursedDebtAmount = 0;
  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  transactions.forEach((tx) => {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + tx.amount;
    } else if (tx.type === 'expense') {
      // 1. クラブ実残高の計算用: クラブ資金からの実出金 (out_of_pocket でないもの)
      // 立替発生(out_of_pocket)時は手元資金が減らないため除外。
      // 精算時(reimbursement_payout / club_funds)は手元資金が出金されるため加算。
      if (tx.paymentSource !== 'out_of_pocket') {
        actualClubFundExpenses += tx.amount;
      }

      // 2. 未精算立替金の集計: 個人立替かつ未精算
      if (tx.paymentSource === 'out_of_pocket' && !tx.isReimbursed) {
        unreimbursedDebtAmount += tx.amount;
      }

      // 3. 会計上の活動支出の集計:
      // 個人立替であっても活動費用(体育館代・シャトル代等)は計上。
      // ただし、立替金返済出金(reimbursement_payout)は負債返済・内部資金移動のため活動支出からは除外。
      if (tx.category !== 'reimbursement_payout') {
        totalExpense += tx.amount;
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
      }
    }
  });

  const currentBalance = totalIncome - actualClubFundExpenses;

  return {
    totalIncome,
    totalExpense,
    currentBalance,
    unreimbursedDebtAmount,
    actualClubFundExpenses,
    incomeByCategory,
    expenseByCategory,
  };
}
