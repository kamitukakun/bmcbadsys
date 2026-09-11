export type TransactionType = 'income' | 'expense';

export type IncomeCategoryKey = 
  | 'event_fee' // イベント・練習会参加費 / 会費
  | 'tournament_fee_collect' // 大会参加費集金
  | 'uniform_goods' // 用具・ウェア集金
  | 'subsidy_sponsor' // 助成金・協賛金
  | 'carried_over' // 前期繰越金
  | 'other_income'; // その他収入

export type ExpenseCategoryKey =
  | 'shuttle' // シャトル購入費
  | 'court_rental' // 体育館・施設利用料
  | 'lighting_hvac' // 照明・空調費
  | 'tournament_entry' // 大会参加費
  | 'federation_reg' // 協会・連盟登録料
  | 'equipment' // 備品・ネット・ポール
  | 'insurance' // スポーツ安全保険料
  | 'social_event' // 懇親会・イベント費
  | 'admin_supplies' // 事務費・振込手数料・雑費
  | 'reimbursement_payout' // 立替金返済・精算
  | 'other_expense'; // その他支出

export type PaymentMethod = 'cash' | 'paypay' | 'bank_transfer' | 'line_pay' | 'other';
export type PaymentSource = 'club_funds' | 'out_of_pocket'; // クラブ口座・資金 vs ポケットマネー立替

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category: IncomeCategoryKey | ExpenseCategoryKey;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
  recordedBy: string;
  
  // 支出先（購入先・納入先・体育館など）
  vendor?: string;

  // ポケットマネー立替管理
  paymentSource?: PaymentSource; // 'club_funds' | 'out_of_pocket'
  payerMemberId?: string; // ポケットマネーで立替えた名簿のID
  payerName?: string; // 立替者の名前 (例: 加美山 代表")
  isReimbursed?: boolean; // 立替金がクラブから返済・精算されたか
  reimbursedAt?: string; // 返済された日付
  reimbursementId?: string; // 関連する返済記録ID

  receiptNote?: string;
  memberId?: string;
  sessionId?: string;
  createdAt: string;
}

export type MemberRole = 'leader' | 'officer' | 'member' | 'student' | 'visitor' | 'inactive';
export type Gender = 'male' | 'female' | 'other' | 'unspecified';

export interface EmergencyContact {
  name: string; // 氏名
  relation: string; // 続柄 (例: 配偶者, 母, 父, 兄弟, 親戚)
  phone: string; // 電話番号
}

export interface MemberParticipationLog {
  sessionId: string;
  date: string;
  eventName: string;
  feePaid: number;
  notes?: string;
}

export interface Member {
  id: string;
  name: string;
  kana: string;
  gender: Gender;
  birthDate?: string; // YYYY-MM-DD (年齢は自動計算)
  role: MemberRole;
  joinDate: string; // YYYY-MM-DD
  phone?: string;
  email?: string;
  emergencyContact?: EmergencyContact;
  isActive: boolean;
  notes?: string;
  
  // 各イベント参加記録ログ
  participationLogs?: MemberParticipationLog[];
  isDeleted?: boolean;
}

export interface ShuttlePurchaseLot {
  id: string; // 例: "lot-1712345678"
  date: string; // YYYY-MM-DD
  tubes: number; // 入荷筒数 (ダース)
  loose?: number; // 入荷端数 (本)
  totalBalls: number; // 入荷合計本数
  pricePerTube: number; // 1ダースあたり仕入れ単価 (円)
  totalCost: number; // 仕入れ総額 (円)
  createdAt: string; // ISO String
}

export interface ShuttleStock {
  id: string;
  brand: string; // 例: YONEX, GOSEN, VICTOR, etc.
  modelName: string; // 例: エアロセンサ700, エアロセンサ600, ニューオフィシャル
  speedNumber: 2 | 3 | 4 | 5; // 2番(夏), 3番(春秋), 4番(冬), 5番(厳冬)
  material: 'waterfowl' | 'synthetic' | 'hybrid'; // 水鳥, ナイロン/人工, ハイブリッド
  tubesInStock: number; // 未開封在庫筒数 (1ダース/筒)
  looseBallsInStock?: number; // 開封済み・端数のバラ本数/球数 (0〜11本)
  ballsPerTube: number; // 通常12球
  pricePerTube: number; // 1筒あたりの購入単価 (円)（最新仕入れ単価または標準単価）
  lowStockThreshold: number; // 発注目安筒数 (例: 5筒)
  notes?: string;
  totalCostInStock?: number; // 在庫全体の総原価 (円) ★在庫加重平均管理用
  purchaseHistory?: ShuttlePurchaseLot[]; // 仕入れ履歴 (ロット別記録)
}

export type TimeSlotType = 'morning' | 'afternoon' | 'evening' | 'full_day' | 'custom';

export interface SessionAttendeeItem {
  memberId?: string;
  name: string;
  feePaid: number;
}

export interface PracticeSessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlotType; // 午前 / 午後 / 夜間 / 終日 / カスタム
  timeSlotLabel?: string; // "夜間 (17:30〜21:30)" など
  startTime?: string;
  endTime?: string;
  location: string; // 市民総合体育館 サブアリーナ
  facilityFee: number; // 体育館・施設利用料 (例: 1,800円、800円)
  lightingHvacFee?: number; // 照明・空調費 (例: 600円)
  
  feePaymentSource?: PaymentSource;
  feePayerMemberId?: string;
  feePayerName?: string;
  feePaymentMethod?: PaymentMethod;

  shuttleId?: string;
  shuttleModelId?: string;
  shuttleUsedCount?: number; // 使用球数 (例: 18球)
  shuttlesUsedCount?: number;
  shuttleCostPerBall?: number; // 1球あたりの単価 (例: 350円)
  
  totalAttendeesCount: number; // 参加人数 (必須項目)
  visitorCount?: number;
  participationFeePerPerson?: number;
  feePerPerson?: number;
  roundedFeePerPerson?: number; // 1人あたり徴収額 (100円単位)
  totalCollectedAmount?: number;
  
  totalCost?: number; // 施設費 + シャトル代
  totalIncome?: number; // 参加費合計
  netProfitLoss?: number; // 収支差額 (黒字余剰)
  
  attendeeMemberIds?: string[];
  attendees?: SessionAttendeeItem[]; // 参加者リスト
  notes?: string;
  syncedToLedger?: boolean;
}

export type ReimbursementStatus = 'reimbursed' | 'dismissed_without_payout';

export interface ReimbursementRecord {
  id: string;
  date: string; // YYYY-MM-DD 返済日または削除日
  memberId?: string;
  memberName: string;
  amount: number; // 返済金額または立替金額 (円)
  paymentMethod: PaymentMethod; // PayPay送金, 現金手渡し, 銀行振込など
  transactionIds: string[]; // 精算・削除対象となった取引ID一覧
  payoutTransactionId?: string; // 精算出金取引ID (返済完了時のみ)
  notes?: string;
  createdAt: string;
  status?: ReimbursementStatus; // 'reimbursed' (返済完了) | 'dismissed_without_payout' (返済せず削除)
  originalTransaction?: Transaction; // 返済せず削除時の元Transaction完全データ (復元用)
}

export interface CategoryBudget {
  planned: number; // 予算額 (円)
  notes?: string;
}

export interface AnnualBudgetPlan {
  fiscalYear: number; // 例: 2026 (2026年4月〜2027年3月)
  targetSurplus?: number; // 目標期末黒字額 (円)
  incomeBudgets: Record<string, CategoryBudget>;
  expenseBudgets: Record<string, CategoryBudget>;
  notes?: string;
}

export type AppTheme = 'default' | 'clean_light' | 'pixel';

export interface ClubSettings {
  clubName: string;
  treasurerName: string;
  fiscalStartMonth: number; // 通常4月
  
  // シャトル資産評価割合 (例: 80%)
  shuttleValuationRate?: number;

  // 画面デザイン・テーマ
  theme?: AppTheme;

  // チームロゴ / 画像 (URLまたはBase64)
  logoUrl?: string;
}

export interface AppState {
  settings: ClubSettings;
  members: Member[];
  transactions: Transaction[];
  shuttleInventory: ShuttleStock[];
  practiceSessions: PracticeSessionRecord[];
  reimbursements: ReimbursementRecord[];
  budgetPlans: Record<number, AnnualBudgetPlan>;
}

// ----------------------------------------------------
// ダブルス組合せ・練習会連携用 型定義
// ----------------------------------------------------
export type PlayerParticipationStatus = 'joined' | 'late' | 'left' | 'absent';

export interface DoublesPlayer {
  playerId: string; // 組合せ内部ID
  memberId: string; // クラブ運営費管理システムの名簿ID (一意キー)
  name: string;
  gender: Gender;
  memberType: 'member' | 'visitor';
  role: MemberRole;
  status: PlayerParticipationStatus; // 'joined': 最初から参加, 'late': 途中参加, 'left': 途中退出, 'absent': 欠席
  isResting?: boolean; // 今回のラウンドで一時休憩
  matchCount: number; // 試合消化数
  restCount: number; // 休憩回数
  historyPairIds?: string[]; // これまでペアを組んだ名簿ID
  historyOpponentIds?: string[]; // これまで対戦した名簿ID
}

export interface DoublesMatch {
  id: string;
  roundNumber: number;
  courtNumber: number;
  courtName?: string;
  teamA: [DoublesPlayer, DoublesPlayer];
  teamB: [DoublesPlayer, DoublesPlayer];
  scoreA?: number;
  scoreB?: number;
  isCompleted?: boolean;
}

export interface DoublesRound {
  roundNumber: number;
  matches: DoublesMatch[];
  restingPlayers: DoublesPlayer[];
  createdAt: string;
}

export interface DoublesSessionData {
  date: string;
  courtCount: number;
  players: DoublesPlayer[];
  rounds: DoublesRound[];
  currentRound: number;
  creationMethod?: 'batch' | 'stream';
}
