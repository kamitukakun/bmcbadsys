import React, { useState, useMemo } from 'react';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  PieChart, 
  Save, 
  RotateCcw, 
  Calendar, 
  DollarSign, 
  Activity, 
  HelpCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  Printer
} from 'lucide-react';
import { AppState, AnnualBudgetPlan, CategoryBudget, Transaction, ClubSettings } from '../types';
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/categories';
import { formatCurrency } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { parseDateString } from '../utils/dateUtils';

interface BudgetPlanViewProps {
  budgetPlans: Record<number, AnnualBudgetPlan>;
  transactions: Transaction[];
  settings: ClubSettings;
  onUpdateBudgetPlan: (fiscalYear: number, plan: AnnualBudgetPlan) => void;
}

// サンプル用モデル予算テンプレート（年40回練習・会員20名想定）
const MODEL_BUDGET_TEMPLATES: Record<string, { label: string; description: string; plan: AnnualBudgetPlan }> = {
  standard: {
    label: '標準社会人クラブ (月3〜4回練習)',
    description: '年間40回練習・名簿20名前後の一般的なクラブの標準予算モデル',
    plan: {
      fiscalYear: 2026,
      targetSurplus: 50000,
      incomeBudgets: {
        event_fee: { planned: 320000, notes: '練習会参加費 (800円×10名×40回)' },
        tournament_fee_collect: { planned: 60000, notes: '市民大会エントリー費集金' },
        uniform_goods: { planned: 30000, notes: 'チームTシャツ等' },
        subsidy_sponsor: { planned: 20000, notes: '市体育協会活動助成金' },
        carried_over: { planned: 120000, notes: '前年度からの繰越金' },
        other_income: { planned: 0, notes: '' },
      },
      expenseBudgets: {
        shuttle: { planned: 180000, notes: 'シャトル箱買い (年間約4箱/40ダース)' },
        court_rental: { planned: 72000, notes: '体育館利用料 (1,800円×40回)' },
        lighting_hvac: { planned: 24000, notes: '夜間照明・夏季エアコン代' },
        tournament_entry: { planned: 60000, notes: '大会主催者への参加料支払' },
        federation_reg: { planned: 25000, notes: '市バドミントン協会登録費' },
        equipment: { planned: 15000, notes: '救急用品・ネット・備品' },
        insurance: { planned: 37000, notes: 'スポーツ安全保険 (1,850円×20名)' },
        social_event: { planned: 30000, notes: '総会・納会補助' },
        admin_supplies: { planned: 5000, notes: '振込手数料・文具' },
        reimbursement_payout: { planned: 0, notes: '精算出金' },
        other_expense: { planned: 10000, notes: '予備費' },
      },
    },
  },
};

const ALLOWED_EXPENSE_KEYS = ['shuttle', 'court_rental', 'lighting_hvac', 'other_expense'];
const ALLOWED_INCOME_KEYS = ['event_fee', 'carried_over', 'other_income'];

export const BudgetPlanView: React.FC<BudgetPlanViewProps> = ({
  budgetPlans,
  transactions,
  settings,
  onUpdateBudgetPlan,
}) => {
  const [fiscalYear, setFiscalYear] = useState<number>(2026);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'expense' | 'income' | 'monthly'>('overview');

  // Current plan for the selected year (or empty fallback)
  const currentPlan: AnnualBudgetPlan = useMemo(() => {
    return budgetPlans[fiscalYear] || {
      fiscalYear,
      targetSurplus: 50000,
      incomeBudgets: {},
      expenseBudgets: {},
    };
  }, [budgetPlans, fiscalYear]);

  const [editIncome, setEditIncome] = useState<Record<string, number | ''>>({});
  const [editExpense, setEditExpense] = useState<Record<string, number | ''>>({});
  const [editTargetSurplus, setEditTargetSurplus] = useState<number>(50000);

  // Compute actual spent and actual received for the selected fiscal year (starts from April by default)
  const { 
    actualIncomeByCategory, 
    actualExpenseByCategory, 
    totalActualIncome, 
    totalActualExpense,
    monthlyBreakdown 
  } = useMemo(() => {
    const incMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    let totInc = 0;
    let totExp = 0;

    // 4月〜翌3月の12ヶ月集計
    const months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
    const monthStats: Record<number, { income: number; expense: number }> = {};
    months.forEach(m => {
      monthStats[m] = { income: 0, expense: 0 };
    });

    transactions.forEach((tx) => {
      const d = parseDateString(tx.date);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      // 年度判定 (4月始まり)
      const txFY = m >= 4 ? y : y - 1;

      if (txFY === fiscalYear) {
        if (tx.type === 'income') {
          incMap[tx.category] = (incMap[tx.category] || 0) + tx.amount;
          totInc += tx.amount;
          if (monthStats[m]) monthStats[m].income += tx.amount;
        } else if (tx.type === 'expense' && tx.category !== 'reimbursement_payout') {
          // 立替金精算出金(reimbursement_payout)は活動支出ではないため予算実績から除外
          expMap[tx.category] = (expMap[tx.category] || 0) + tx.amount;
          totExp += tx.amount;
          if (monthStats[m]) monthStats[m].expense += tx.amount;
        }
      }
    });

    return {
      actualIncomeByCategory: incMap,
      actualExpenseByCategory: expMap,
      totalActualIncome: totInc,
      totalActualExpense: totExp,
      monthlyBreakdown: monthStats,
    };
  }, [transactions, fiscalYear]);

  // Budget totals (only allowed categories)
  const totalPlannedIncome = ALLOWED_INCOME_KEYS.reduce((sum, k) => sum + (currentPlan.incomeBudgets?.[k]?.planned || 0), 0);
  const totalPlannedExpense = ALLOWED_EXPENSE_KEYS.reduce((sum, k) => sum + (currentPlan.expenseBudgets?.[k]?.planned || 0), 0);
  const plannedNetBalance = totalPlannedIncome - totalPlannedExpense;

  // Actual net balance & forecast
  const actualNetBalance = totalActualIncome - totalActualExpense;

  // 進捗率・消化率 (%)
  const incomeProgressRate = totalPlannedIncome > 0 ? Math.round((totalActualIncome / totalPlannedIncome) * 100) : 0;
  const expenseExecutionRate = totalPlannedExpense > 0 ? Math.round((totalActualExpense / totalPlannedExpense) * 100) : 0;
  const remainingExpenseBudget = Math.max(0, totalPlannedExpense - totalActualExpense);

  const startEdit = () => {
    const inc: Record<string, number | ''> = {};
    ALLOWED_INCOME_KEYS.forEach((k) => {
      const p = currentPlan.incomeBudgets?.[k]?.planned;
      inc[k] = p !== undefined ? p : '';
    });

    const exp: Record<string, number | ''> = {};
    ALLOWED_EXPENSE_KEYS.forEach((k) => {
      const p = currentPlan.expenseBudgets?.[k]?.planned;
      exp[k] = p !== undefined ? p : '';
    });

    setEditIncome(inc);
    setEditExpense(exp);
    setEditTargetSurplus(currentPlan.targetSurplus || 50000);
    setIsEditing(true);
  };

  const handleSaveBudget = () => {
    const newIncomeBudgets: Record<string, CategoryBudget> = {};
    Object.entries(editIncome).forEach(([k, val]) => {
      newIncomeBudgets[k] = { 
        planned: typeof val === 'number' ? val : 0,
        notes: currentPlan.incomeBudgets?.[k]?.notes || ''
      };
    });

    const newExpenseBudgets: Record<string, CategoryBudget> = {};
    Object.entries(editExpense).forEach(([k, val]) => {
      newExpenseBudgets[k] = { 
        planned: typeof val === 'number' ? val : 0,
        notes: currentPlan.expenseBudgets?.[k]?.notes || ''
      };
    });

    onUpdateBudgetPlan(fiscalYear, {
      fiscalYear,
      targetSurplus: Number(editTargetSurplus) || 0,
      incomeBudgets: newIncomeBudgets,
      expenseBudgets: newExpenseBudgets,
    });
    setIsEditing(false);
  };

  const [templateConfirm, setTemplateConfirm] = useState<string | null>(null);

  const applyModelTemplate = (templateKey: string) => {
    const tpl = MODEL_BUDGET_TEMPLATES[templateKey];
    if (!tpl) return;
    setTemplateConfirm(templateKey);
  };

  const handleConfirmTemplate = () => {
    if (templateConfirm) {
      const tpl = MODEL_BUDGET_TEMPLATES[templateConfirm];
      onUpdateBudgetPlan(fiscalYear, {
        ...tpl.plan,
        fiscalYear,
      });
      setShowTemplateMenu(false);
      setIsEditing(false);
    }
    setTemplateConfirm(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {templateConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-border p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-text text-center">予算テンプレート適用</h3>
            <p className="text-text-muted text-xs text-center leading-relaxed">
              「{MODEL_BUDGET_TEMPLATES[templateConfirm].label}」を適用しますか？現在のデータは上書きされます。
            </p>
            <div className="flex gap-2 pt-1">
              <button 
                type="button"
                onClick={() => setTemplateConfirm(null)}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button 
                type="button"
                onClick={handleConfirmTemplate}
                className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                適用する
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-accent/10 text-accent rounded-full border border-accent/20">
              <Target className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-text tracking-tight">
              年間予算計画
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-2">
            年度活動予算に対する実績進捗率、残予算枠、期末黒字予測のシミュレーション
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {/* Fiscal Year Select */}
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="px-3.5 py-2.5 bg-surface-subtle border border-border rounded-xl text-xs sm:text-sm font-bold text-text shadow-md focus:outline-none focus:ring-2 focus:ring-accent/50 cursor-pointer"
          >
            <option value={2026} className="bg-surface">2026年度 (令和8年度)</option>
            <option value={2025} className="bg-surface">2025年度 (令和7年度)</option>
            <option value={2027} className="bg-surface">2027年度 (令和9年度)</option>
          </select>

          {/* Template presets button */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="px-3 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border text-text-muted font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>予算モデル適用</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-xl p-3 shadow-2xl z-30 space-y-2 animate-fade-in text-xs">
                <div className="font-bold text-text pb-1 border-b border-border flex justify-between items-center">
                  <span>おすすめ予算テンプレート</span>
                  <button 
                    type="button"
                    onClick={() => setShowTemplateMenu(false)} 
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </div>
                {Object.entries(MODEL_BUDGET_TEMPLATES).map(([key, tpl]) => (
                  <button
                    key={key}
                    onClick={() => applyModelTemplate(key)}
                    className="w-full text-left p-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl transition-all space-y-1 cursor-pointer"
                  >
                    <div className="font-bold text-accent">{tpl.label}</div>
                    <div className="text-[11px] text-text-muted leading-tight">{tpl.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-2.5 bg-surface-subtle border border-border text-text-muted font-bold text-xs rounded-xl hover:bg-surface-hover cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveBudget}
                className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>予算設定を保存</span>
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="px-4 py-2.5 bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>予算額を編集</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. 収入予算と進捗率 */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider">
              <span>年間総収入</span>
              <span className="p-1.5 bg-accent/15 text-accent rounded-full">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-black text-text mt-2 tabular-nums">
              {formatCurrency(totalActualIncome)}
            </div>
            <div className="text-xs text-text-muted mt-1 font-medium">
              予算目標: <strong className="text-text font-bold">{formatCurrency(totalPlannedIncome)}</strong>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-text-muted">集金進捗率</span>
              <span className="text-accent font-black tabular-nums">{incomeProgressRate}%</span>
            </div>
            <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden border border-border">
              <div 
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, incomeProgressRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. 支出予算と執行率 */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider">
              <span>年間総支出</span>
              <span className="p-1.5 bg-rose-500/15 text-rose-400 rounded-full">
                <TrendingDown className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-2xl font-black text-text mt-2 tabular-nums">
              {formatCurrency(totalActualExpense)}
            </div>
            <div className="text-xs text-text-muted mt-1 font-medium">
              予算上限: <strong className="text-text font-bold">{formatCurrency(totalPlannedExpense)}</strong>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border-subtle">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-text-muted">予算執行率</span>
              <span className={`tabular-nums font-black ${expenseExecutionRate > 100 ? 'text-rose-400' : expenseExecutionRate > 80 ? 'text-amber-400' : 'text-accent'}`}>
                {expenseExecutionRate}%
              </span>
            </div>
            <div className="w-full bg-surface-subtle h-2 rounded-full overflow-hidden border border-border">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  expenseExecutionRate > 100 ? 'bg-rose-500' : expenseExecutionRate > 80 ? 'bg-amber-400' : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, expenseExecutionRate)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. 予算残枠 (使える残額) */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider">
              <span>今年度の利用可能 残予算</span>
              <span className="p-1.5 bg-sky-500/15 text-sky-400 rounded-full">
                <DollarSign className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className={`text-2xl font-black mt-2 tabular-nums ${totalActualExpense > totalPlannedExpense ? 'text-rose-400' : 'text-sky-400'}`}>
              {formatCurrency(remainingExpenseBudget)}
            </div>
            <div className="text-xs text-text-muted mt-1 font-medium">
              {totalActualExpense > totalPlannedExpense ? (
                <span className="text-rose-400 font-bold">⚠️ 予算枠を {formatCurrency(totalActualExpense - totalPlannedExpense)} 超過</span>
              ) : (
                <span>計画予算の枠内で安全に執行中</span>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle text-xs text-text-muted flex justify-between font-medium">
            <span>残予算比率:</span>
            <span className="text-text font-bold tabular-nums">
              {totalPlannedExpense > 0 ? Math.round((remainingExpenseBudget / totalPlannedExpense) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* 4. 年間収支着地予想 */}
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider">
              <span>期末収支着地見込み</span>
              <span className="p-1.5 bg-accent/15 text-accent rounded-full">
                <Activity className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className={`text-2xl font-black mt-2 tabular-nums ${actualNetBalance >= 0 ? 'text-accent' : 'text-rose-400'}`}>
              {actualNetBalance >= 0 ? `+${formatCurrency(actualNetBalance)}` : formatCurrency(actualNetBalance)}
            </div>
            <div className="text-xs text-text-muted mt-1 font-medium">
              計画目標黒字: <strong className="text-text font-bold">+{formatCurrency(plannedNetBalance)}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-border-subtle text-xs flex justify-between items-center font-medium">
            <span className="text-text-muted">クラブ財務健全性:</span>
            <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-black text-[10px]">
              {actualNetBalance >= 0 ? '健全黒字' : '要対策 (赤字)'}
            </span>
          </div>
        </div>

      </div>

      {/* Sub navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto no-scrollbar flex-nowrap">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'overview'
              ? 'bg-surface-muted text-accent border border-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          全費目 予実対比サマリー
        </button>
        <button
          onClick={() => setActiveTab('expense')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'expense'
              ? 'bg-surface-muted text-rose-400 border border-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          支出
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'income'
              ? 'bg-surface-muted text-sky-400 border border-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          収入
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === 'monthly'
              ? 'bg-surface-muted text-amber-400 border border-border'
              : 'text-text-muted hover:text-text'
          }`}
        >
          月別推移 & 分析
        </button>
      </div>

      {/* View Content based on Tab */}
      {(activeTab === 'overview' || activeTab === 'expense') && (
        <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-full shrink-0">
                <TrendingDown className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-text whitespace-nowrap">【支出】費目別 予実対比＆予算執行率</h3>
            </div>
            <span className="text-xs text-text-muted whitespace-nowrap">
              合計予算: <strong className="text-text font-bold">{formatCurrency(totalPlannedExpense)}</strong> / 実績: <strong className="text-rose-400 font-bold">{formatCurrency(totalActualExpense)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="w-full text-left text-xs border-collapse min-w-[660px]">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-3 whitespace-nowrap">費目 (勘定科目)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">年間予算額</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">執行実績額</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">差額 (残予算)</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">執行率</th>
                  <th className="py-3 px-3 whitespace-nowrap">ステータス / 備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {ALLOWED_EXPENSE_KEYS.map((key) => {
                  const meta = EXPENSE_CATEGORIES[key as keyof typeof EXPENSE_CATEGORIES];
                  if (!meta) return null;
                  const planned = isEditing ? (typeof editExpense[key] === 'number' ? editExpense[key] : 0) : (currentPlan.expenseBudgets?.[key]?.planned || 0);
                  const actual = actualExpenseByCategory[key] || 0;
                  const diff = planned - actual;
                  const rate = planned > 0 ? Math.round((actual / planned) * 100) : 0;
                  const isOver = actual > planned && planned > 0;

                  return (
                    <tr key={key} className="hover:bg-surface-hover transition-colors">
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <CategoryIcon iconName={meta.iconName || meta.icon} className="w-4 h-4 text-rose-400 shrink-0" />
                          <div>
                            <div className="font-bold text-text whitespace-nowrap">{meta.label}</div>
                            <div className="text-[10px] text-text-muted whitespace-nowrap">{meta.description}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={editExpense[key] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setEditExpense({ ...editExpense, [key]: '' });
                              } else {
                                const num = Number(val);
                                setEditExpense({ ...editExpense, [key]: isNaN(num) ? '' : Math.max(0, num) });
                              }
                            }}
                            placeholder="0"
                            className="w-24 sm:w-28 p-1.5 bg-surface-subtle border border-border rounded-xl text-right text-text font-bold focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <span className="text-text">{formatCurrency(planned)}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-text tabular-nums whitespace-nowrap">
                        {formatCurrency(actual)}
                      </td>

                      <td className={`py-3.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${diff < 0 ? 'text-rose-400' : 'text-text-muted'}`}>
                        {diff < 0 ? `-${formatCurrency(Math.abs(diff))}` : formatCurrency(diff)}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1 min-w-[70px]">
                          <span className={`text-[11px] font-extrabold tabular-nums ${isOver ? 'text-rose-400' : rate > 80 ? 'text-amber-400' : 'text-accent'}`}>
                            {rate}%
                          </span>
                          <div className="w-16 bg-surface-subtle h-1.5 rounded-full overflow-hidden border border-border">
                            <div 
                              className={`h-full rounded-full ${isOver ? 'bg-rose-500' : rate > 80 ? 'bg-amber-400' : 'bg-accent'}`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-text-muted text-[11px] whitespace-nowrap">
                        {isOver ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                            ⚠️ 予算超過
                          </span>
                        ) : rate >= 80 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold">
                            残り僅か
                          </span>
                        ) : planned > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-bold">
                            順調執行
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-muted border border-border text-text-muted font-bold text-[10px]">
                            未設定
                          </span>
                        )}
                        {currentPlan.expenseBudgets?.[key]?.notes && (
                          <span className="ml-2 text-text-muted">({currentPlan.expenseBudgets[key].notes})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'income') && (
        <div className="bg-surface rounded-2xl border border-border p-4 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-full shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h3 className="text-sm sm:text-base font-bold text-text whitespace-nowrap">【収入】費目別 予実対比＆集金進捗率</h3>
            </div>
            <span className="text-xs text-text-muted whitespace-nowrap">
              合計目標: <strong className="text-text font-bold">{formatCurrency(totalPlannedIncome)}</strong> / 集金実績: <strong className="text-accent font-bold">{formatCurrency(totalActualIncome)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="w-full text-left text-xs border-collapse min-w-[660px]">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                  <th className="py-3 px-3 whitespace-nowrap">費目 (勘定科目)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">年間目標額</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">集金実績額</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">差額 (過不足)</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">進捗率</th>
                  <th className="py-3 px-3 whitespace-nowrap">ステータス / 備考</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {ALLOWED_INCOME_KEYS.map((key) => {
                  const meta = INCOME_CATEGORIES[key as keyof typeof INCOME_CATEGORIES];
                  if (!meta) return null;
                  const planned = isEditing ? (typeof editIncome[key] === 'number' ? editIncome[key] : 0) : (currentPlan.incomeBudgets?.[key]?.planned || 0);
                  const actual = actualIncomeByCategory[key] || 0;
                  const diff = actual - planned;
                  const rate = planned > 0 ? Math.round((actual / planned) * 100) : 0;

                  return (
                    <tr key={key} className="hover:bg-surface-hover transition-colors">
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <CategoryIcon iconName={meta.iconName || meta.icon} className="w-4 h-4 text-sky-400 shrink-0" />
                          <div>
                            <div className="font-bold text-text whitespace-nowrap">{meta.label}</div>
                            <div className="text-[10px] text-text-muted whitespace-nowrap">{meta.description}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={editIncome[key] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                setEditIncome({ ...editIncome, [key]: '' });
                              } else {
                                const num = Number(val);
                                setEditIncome({ ...editIncome, [key]: isNaN(num) ? '' : Math.max(0, num) });
                              }
                            }}
                            placeholder="0"
                            className="w-24 sm:w-28 p-1.5 bg-surface-subtle border border-border rounded-xl text-right text-text font-bold focus:outline-none focus:border-accent"
                          />
                        ) : (
                          <span className="text-text">{formatCurrency(planned)}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right font-bold text-text tabular-nums whitespace-nowrap">
                        {formatCurrency(actual)}
                      </td>

                      <td className={`py-3.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${diff >= 0 ? 'text-accent' : 'text-text-muted'}`}>
                        {diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1 min-w-[70px]">
                          <span className={`text-[11px] font-extrabold tabular-nums ${rate >= 100 ? 'text-accent' : 'text-sky-400'}`}>
                            {rate}%
                          </span>
                          <div className="w-16 bg-surface-subtle h-1.5 rounded-full overflow-hidden border border-border">
                            <div 
                              className="bg-sky-400 h-full rounded-full"
                              style={{ width: `${Math.min(100, rate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-text-muted text-[11px] whitespace-nowrap">
                        {rate >= 100 ? (
                          <span className="px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-bold">
                            達成済み
                          </span>
                        ) : planned > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400 font-bold">
                            集金中 ({rate}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-surface-muted border border-border text-text-muted font-bold text-[10px]">
                            未設定
                          </span>
                        )}
                        {currentPlan.incomeBudgets?.[key]?.notes && (
                          <span className="ml-2 text-text-muted">({currentPlan.incomeBudgets[key].notes})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Breakdown Tab */}
      {activeTab === 'monthly' && (
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-text">
                {fiscalYear}年度 月別収支推移とバドミントン特有の季節要因
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map((month) => {
              const stats = monthlyBreakdown[month] || { income: 0, expense: 0 };
              const net = stats.income - stats.expense;
              const isProfit = net >= 0;

              return (
                <div key={month} className="p-3.5 bg-surface-subtle rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-text">{month}月</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isProfit ? 'bg-accent/10 text-accent' : 'bg-rose-500/10 text-rose-400'}`}>
                      {isProfit ? '黒字' : '赤字'}
                    </span>
                  </div>

                  <div className="text-[11px] space-y-1">
                    <div className="flex justify-between text-text-muted">
                      <span>収入:</span>
                      <span className="text-accent font-bold tabular-nums">{formatCurrency(stats.income)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted">
                      <span>支出:</span>
                      <span className="text-rose-400 font-bold tabular-nums">{formatCurrency(stats.expense)}</span>
                    </div>
                    <div className="pt-1 border-t border-border-subtle flex justify-between font-extrabold text-xs">
                      <span>収支:</span>
                      <span className={`tabular-nums ${isProfit ? 'text-accent' : 'text-rose-400'}`}>
                        {isProfit ? `+${formatCurrency(net)}` : formatCurrency(net)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seasonal Badm Advice Cards */}
          <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-3 text-xs">
            <h4 className="font-bold text-text flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>バドミントンサークル 年間支出の季節変動ポイント</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-text-muted text-[11px] leading-relaxed">
              <div className="p-3 bg-surface rounded-xl border border-border">
                <strong className="text-accent block mb-1">🌱 春期 (4月〜6月)</strong>
                ・新年度の市連盟・協会登録費やスポーツ安全保険料の更新が一括で発生します。<br />
                ・新規名簿加入時の参加費徴収が集中します。
              </div>

              <div className="p-3 bg-surface rounded-xl border border-border">
                <strong className="text-amber-400 block mb-1">☀️ 夏期 (7月〜9月)</strong>
                ・冷房利用料（スポットクーラー・エアコン代）が施設費に加算されます。<br />
                ・高温時はシャトルが飛びやすいため2番（夏用）を使用し耐久性が向上します。
              </div>

              <div className="p-3 bg-surface rounded-xl border border-border">
                <strong className="text-sky-400 block mb-1">❄️ 冬期 (11月〜2月)</strong>
                ・気温低下と空気の乾燥により、シャトルの羽根が折れやすく消耗本数が1.5〜2倍に増大。<br />
                ・4番・5番（冬用・厳冬用）のシャトルまとめ買い予算を厚めに確保することが推奨されます。
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
