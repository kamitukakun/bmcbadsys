import { IncomeCategoryKey, ExpenseCategoryKey, PaymentMethod, PaymentSource } from '../types';

export interface CategoryMeta {
  key: string;
  label: string;
  icon: string;
  iconName?: string;
  color: string;
  bgColor?: string;
  bgLight: string;
  description: string;
}

export const INCOME_CATEGORIES: Record<IncomeCategoryKey, CategoryMeta> = {
  event_fee: {
    key: 'event_fee',
    label: 'イベント・練習会参加費',
    icon: 'Users',
    iconName: 'Users',
    color: 'text-accent',
    bgColor: 'bg-accent/15 border-accent/30 text-accent',
    bgLight: 'bg-accent/15 border-accent/30 text-accent',
    description: '練習会やイベントでの都度参加費・会費集金',
  },
  tournament_fee_collect: {
    key: 'tournament_fee_collect',
    label: '大会参加費集金',
    icon: 'Trophy',
    iconName: 'Trophy',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    description: '大会・オープン戦エントリー代の実費集金',
  },
  uniform_goods: {
    key: 'uniform_goods',
    label: '用具・ウェア集金',
    icon: 'Shirt',
    iconName: 'Shirt',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    bgLight: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    description: 'チームウェア・グリップ等の共同購入集金',
  },
  subsidy_sponsor: {
    key: 'subsidy_sponsor',
    label: '助成金・協賛金',
    icon: 'Award',
    iconName: 'Award',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    bgLight: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    description: '体育協会助成金・スポンサー協賛金など',
  },
  carried_over: {
    key: 'carried_over',
    label: '前期繰越金',
    icon: 'Archive',
    iconName: 'Archive',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    bgLight: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    description: '前年度からの繰越金・初期残高',
  },
  other_income: {
    key: 'other_income',
    label: 'その他収入',
    icon: 'PlusCircle',
    iconName: 'PlusCircle',
    color: 'text-slate-300',
    bgColor: 'bg-slate-800 text-slate-300',
    bgLight: 'bg-slate-800 text-slate-300',
    description: '臨時収入・利息など',
  },
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategoryKey, CategoryMeta> = {
  shuttle: {
    key: 'shuttle',
    label: 'シャトル購入費',
    icon: 'Activity',
    iconName: 'Activity',
    color: 'text-accent',
    bgColor: 'bg-accent/15 border-accent/30 text-accent',
    bgLight: 'bg-accent/15 border-accent/30 text-accent',
    description: '練習球・公式戦用シャトル箱買い等',
  },
  court_rental: {
    key: 'court_rental',
    label: '体育館・施設利用料',
    icon: 'Landmark',
    iconName: 'Landmark',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    bgLight: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    description: '市民体育館・学校体育館等の利用料',
  },
  lighting_hvac: {
    key: 'lighting_hvac',
    label: '照明・空調費',
    icon: 'Zap',
    iconName: 'Zap',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    description: '体育館の夜間照明代・冷暖房費',
  },
  tournament_entry: {
    key: 'tournament_entry',
    label: '大会参加費 (支払)',
    icon: 'Trophy',
    iconName: 'Trophy',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    bgLight: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    description: '大会主催者へのエントリー料一括支払',
  },
  federation_reg: {
    key: 'federation_reg',
    label: '協会・連盟登録料',
    icon: 'FileBadge',
    iconName: 'FileBadge',
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    bgLight: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    description: '市バドミントン協会等の年間登録費',
  },
  equipment: {
    key: 'equipment',
    label: '備品・救急用品',
    icon: 'Wrench',
    iconName: 'Wrench',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    bgLight: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
    description: 'ネット・ポール・救急用品・ホワイトボード等',
  },
  insurance: {
    key: 'insurance',
    label: 'スポーツ安全保険料',
    icon: 'ShieldCheck',
    iconName: 'ShieldCheck',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    bgLight: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    description: '名簿の年間スポーツ安全保険料',
  },
  social_event: {
    key: 'social_event',
    label: '懇親会・イベント費',
    icon: 'Sparkles',
    iconName: 'Sparkles',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    bgLight: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    description: '総会・親睦会・納会などの補助費',
  },
  admin_supplies: {
    key: 'admin_supplies',
    label: '事務費・振込手数料',
    icon: 'FileText',
    iconName: 'FileText',
    color: 'text-slate-400',
    bgColor: 'bg-slate-800 text-slate-300',
    bgLight: 'bg-slate-800 text-slate-300',
    description: '銀行振込手数料・文具・領収書用紙など',
  },
  reimbursement_payout: {
    key: 'reimbursement_payout',
    label: '立替金返済・精算',
    icon: 'CircleDollarSign',
    iconName: 'CircleDollarSign',
    color: 'text-accent',
    bgColor: 'bg-accent/15 border-accent/30 text-accent',
    bgLight: 'bg-accent/15 border-accent/30 text-accent',
    description: '名簿への個人立替金のクラブ残高からの返済出金',
  },
  other_expense: {
    key: 'other_expense',
    label: 'その他支出',
    icon: 'MinusCircle',
    iconName: 'MinusCircle',
    color: 'text-slate-300',
    bgColor: 'bg-slate-800 text-slate-300',
    bgLight: 'bg-slate-800 text-slate-300',
    description: '予備費・雑支出など',
  },
};

export const ALL_CATEGORIES: Record<string, CategoryMeta> = {
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
};

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string }> = {
  cash: { label: '現金', icon: 'Coins' },
  paypay: { label: 'PayPay (電子決済)', icon: 'Smartphone' },
  bank_transfer: { label: '銀行振込 (クラブ口座)', icon: 'Landmark' },
  line_pay: { label: 'LINE Pay', icon: 'Smartphone' },
  other: { label: 'その他', icon: 'CreditCard' },
};

export const PAYMENT_SOURCES: Record<PaymentSource, { label: string; description: string }> = {
  club_funds: { label: 'クラブ資金 (口座・手元現金)', description: 'クラブの共有残高から直接支出' },
  out_of_pocket: { label: '個人ポケットマネー立替', description: '後でクラブ残高から返済精算' },
};

export const TRANSACTION_QUICK_PRESETS = [
  {
    type: 'expense' as const,
    category: 'court_rental' as const,
    amount: 1800,
    paymentMethod: 'cash' as const,
    description: '市民体育館 夜間コート利用料',
  },
  {
    type: 'expense' as const,
    category: 'court_rental' as const,
    amount: 800,
    paymentMethod: 'cash' as const,
    description: '市民体育館 午前コート利用料',
  },
  {
    type: 'expense' as const,
    category: 'shuttle' as const,
    amount: 4300,
    paymentMethod: 'bank_transfer' as const,
    description: 'シャトル 1箱(10ダース)購入',
  },
  {
    type: 'income' as const,
    category: 'event_fee' as const,
    amount: 6400,
    paymentMethod: 'paypay' as const,
    description: '練習会 参加費集金 (8名分)',
  },
];
