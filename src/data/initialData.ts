import { 
  AppState, 
  Member, 
  Transaction, 
  ShuttleStock, 
  PracticeSessionRecord, 
  ReimbursementRecord,
  AnnualBudgetPlan 
} from '../types';

export const INITIAL_MEMBERS: Member[] = [];

export const INITIAL_SHUTTLES: ShuttleStock[] = [];

export const INITIAL_PRACTICE_SESSIONS: PracticeSessionRecord[] = [];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_REIMBURSEMENTS: ReimbursementRecord[] = [];

export const INITIAL_BUDGET_PLAN_2026: AnnualBudgetPlan = {
  fiscalYear: 2026,
  incomeBudgets: {},
  expenseBudgets: {},
};

export const INITIAL_APP_STATE: AppState = {
  settings: {
    clubName: 'シャトルズ',
    fiscalStartMonth: 4,
    treasurerName: 'バド太郎',
    shuttleValuationRate: 80, // メルカリ等売却を考慮した評価額 80% (設定変更可)
  },
  transactions: INITIAL_TRANSACTIONS,
  members: INITIAL_MEMBERS,
  shuttleInventory: INITIAL_SHUTTLES,
  practiceSessions: INITIAL_PRACTICE_SESSIONS,
  reimbursements: INITIAL_REIMBURSEMENTS,
  budgetPlans: {
    2026: INITIAL_BUDGET_PLAN_2026,
  },
};
