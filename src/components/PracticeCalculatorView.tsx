import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calculator, 
  PlusCircle, 
  CheckCircle2, 
  Package, 
  MapPin, 
  Users,
  ShieldCheck,
  TrendingUp,
  Plus,
  Minus,
  Layers,
  ArrowRight,
  Clock,
  UserCheck,
  Building2,
  RotateCcw,
  Sparkles,
  History,
  Edit3,
  Swords
} from 'lucide-react';
import { ShuttleStock, PracticeSessionRecord, Member, TimeSlotType, PaymentSource, Transaction } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { getShuttleTotalBalls, getShuttleCostPerBall } from '../utils/shuttleUtils';
import { getTodayString } from '../utils/dateUtils';

interface PracticeCalculatorViewProps {
  shuttleInventory?: ShuttleStock[];
  shuttles?: ShuttleStock[];
  practiceSessions?: PracticeSessionRecord[];
  pastSessions?: PracticeSessionRecord[];
  members?: Member[];
  transactions?: Transaction[];
  initialCarriedOverAttendeeIds?: string[] | null;
  initialSessionDate?: string | null;
  onClearCarriedOver?: () => void;
  onNavigateToDoubles?: () => void;
  onSaveSessionToLedger: (session: PracticeSessionRecord, selectedMemberIds?: string[], paymentSource?: PaymentSource, payerMemberId?: string) => void;
  onUpdateSession?: (session: PracticeSessionRecord) => void;
  onDeleteSession?: (sessionId: string, restoreShuttles: boolean) => void;
}

export const PracticeCalculatorView: React.FC<PracticeCalculatorViewProps> = ({
  shuttleInventory: propShuttleInventory,
  shuttles: propShuttles,
  practiceSessions: propPracticeSessions,
  pastSessions: propPastSessions,
  members = [],
  transactions = [],
  initialCarriedOverAttendeeIds,
  initialSessionDate,
  onClearCarriedOver,
  onNavigateToDoubles,
  onSaveSessionToLedger,
  onUpdateSession,
  onDeleteSession,
}) => {
  const shuttleInventory = propShuttleInventory || propShuttles || [];
  const practiceSessions = propPracticeSessions || propPastSessions || [];
  const today = getTodayString();

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deleteTargetSessionId, setDeleteTargetSessionId] = useState<string | null>(null);

  // 前回登録された最新の練習会レコードを取得
  const latestSession = useMemo(() => {
    if (!practiceSessions || practiceSessions.length === 0) return null;
    const sorted = [...practiceSessions].sort((a, b) => 
      (b.date || '').localeCompare(a.date || '') || (b.id || '').localeCompare(a.id || '')
    );
    return sorted[0] || null;
  }, [practiceSessions]);

  // 1. 【必須項目 1】当日利用したシャトルの本数 (前回登録値があれば参照)
  const [shuttlesUsedCount, setShuttlesUsedCount] = useState<number>(() => {
    return latestSession?.shuttleUsedCount ?? latestSession?.shuttlesUsedCount ?? 16;
  });

  // 2. 【必須項目 2】参加した人数 (前回登録値があれば参照)
  const [totalAttendees, setTotalAttendees] = useState<number>(() => {
    return latestSession?.totalAttendeesCount ?? 12;
  });

  // 3. 【シャトル原価設定】 (前回選択のシャトルまたは先頭在庫)
  const [selectedShuttleId, setSelectedShuttleId] = useState<string>(() => {
    if (latestSession?.shuttleModelId && shuttleInventory.some(s => s.id === latestSession.shuttleModelId)) {
      return latestSession.shuttleModelId;
    }
    if (latestSession?.shuttleId && shuttleInventory.some(s => s.id === latestSession.shuttleId)) {
      return latestSession.shuttleId;
    }
    return shuttleInventory[0]?.id || 'custom';
  });
  const [customBallCost, setCustomBallCost] = useState<number>(() => {
    return latestSession?.shuttleCostPerBall ?? 500;
  });

  // 4. 【施設＆体育館利用料 (会場費)】 (前回登録値があれば参照)
  const [includeFacilityCost, setIncludeFacilityCost] = useState<boolean>(() => {
    if (!latestSession) return true;
    return (latestSession.facilityFee > 0) || ((latestSession.lightingHvacFee || 0) > 0);
  });
  const [facilityFee, setFacilityFee] = useState<number>(() => {
    return latestSession?.facilityFee ?? 1800;
  });
  const [lightingHvacFee, setLightingHvacFee] = useState<number | ''>(() => {
    return (latestSession?.lightingHvacFee && latestSession.lightingHvacFee > 0)
      ? latestSession.lightingHvacFee
      : '';
  });
  const [location, setLocation] = useState<string>(() => {
    return latestSession?.location ?? '';
  });
  const [date, setDate] = useState<string>(today);

  // 支払元設定 (会場費: 開催日までの事前決済が標準のため初期値はクラブ残高から)
  const [venuePaymentSource, setVenuePaymentSource] = useState<PaymentSource>(() => {
    return latestSession?.feePaymentSource ?? 'club_funds';
  });
  const [venuePayerMemberId, setVenuePayerMemberId] = useState<string>(() => {
    if (latestSession?.feePayerMemberId && members.some(m => m.id === latestSession.feePayerMemberId)) {
      return latestSession.feePayerMemberId;
    }
    return members[0]?.id || '';
  });

  // 参加名簿選択 (オプション: ダブルス組合せからの引き継ぎまたは前回参加者リストがあれば反映、削除済み名簿は除外)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    if (initialCarriedOverAttendeeIds && initialCarriedOverAttendeeIds.length > 0) {
      return initialCarriedOverAttendeeIds.filter(id => members.some(m => m.id === id && !m.isDeleted));
    }
    if (latestSession?.attendeeMemberIds && latestSession.attendeeMemberIds.length > 0) {
      const validIds = latestSession.attendeeMemberIds.filter(id => {
        const m = members.find(mem => mem.id === id);
        return m && !m.isDeleted;
      });
      if (validIds.length > 0) return validIds;
    }
    return members.filter(m => !m.isDeleted).slice(0, 10).map(m => m.id);
  });
  const [isSelectingMembers, setIsSelectingMembers] = useState<boolean>(() => {
    return Boolean(initialCarriedOverAttendeeIds && initialCarriedOverAttendeeIds.length > 0);
  });

  // ダブルス連携からの参加者自動反映エフェクト
  useEffect(() => {
    if (initialCarriedOverAttendeeIds && initialCarriedOverAttendeeIds.length > 0) {
      const validIds = initialCarriedOverAttendeeIds.filter(id => members.some(m => m.id === id && !m.isDeleted));
      setSelectedMemberIds(validIds);
      setTotalAttendees(validIds.length);
      setIsSelectingMembers(true);
      if (initialSessionDate) {
        setDate(initialSessionDate);
      }
    }
  }, [initialCarriedOverAttendeeIds, initialSessionDate, members]);

  // 適用する徴収金額 (カスタム入力、未入力時は自動推奨値)
  const [customAppliedFee, setCustomAppliedFee] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>(() => {
    return latestSession?.notes ?? '';
  });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 過去のセッションの設定をフォームに適用
  const applySessionSettings = (session: PracticeSessionRecord, showToast = true) => {
    if (session.shuttleUsedCount || session.shuttlesUsedCount) {
      setShuttlesUsedCount(session.shuttleUsedCount || session.shuttlesUsedCount || 18);
    }
    if (session.totalAttendeesCount) {
      setTotalAttendees(session.totalAttendeesCount);
    }
    if (session.shuttleModelId && shuttleInventory.some(s => s.id === session.shuttleModelId)) {
      setSelectedShuttleId(session.shuttleModelId);
    } else if (session.shuttleId && shuttleInventory.some(s => s.id === session.shuttleId)) {
      setSelectedShuttleId(session.shuttleId);
    }
    if (session.shuttleCostPerBall) {
      setCustomBallCost(session.shuttleCostPerBall);
    }
    if (session.facilityFee !== undefined) {
      setFacilityFee(session.facilityFee);
    }
    if (session.lightingHvacFee !== undefined) {
      setLightingHvacFee(session.lightingHvacFee);
    }
    setLocation(session.location ?? '');
    setIncludeFacilityCost((session.facilityFee > 0) || ((session.lightingHvacFee || 0) > 0));
    if (session.feePaymentSource) {
      setVenuePaymentSource(session.feePaymentSource);
    } else {
      setVenuePaymentSource('club_funds');
    }
    if (session.feePayerMemberId) {
      setVenuePayerMemberId(session.feePayerMemberId);
    }
    if (session.attendeeMemberIds && session.attendeeMemberIds.length > 0) {
      setSelectedMemberIds(session.attendeeMemberIds);
    }
    if (showToast) {
      setToastMessage(`${formatDate(session.date)}の登録設定を反映しました`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // 1本あたりのシャトル原価 (在庫加重平均方式)
  const shuttleCostPerBall = useMemo(() => {
    if (selectedShuttleId === 'custom') {
      return customBallCost;
    }
    const found = shuttleInventory.find(s => s.id === selectedShuttleId);
    if (found) {
      return getShuttleCostPerBall(found);
    }
    return customBallCost;
  }, [shuttleInventory, selectedShuttleId, customBallCost]);

  // 実効参加人数 (名簿選択モード時は選択数、通常時は入力人数)
  const effectiveAttendees = isSelectingMembers ? selectedMemberIds.length : totalAttendees;

  // 赤字回避・100円単位切り上げ計算
  const calc = useMemo(() => {
    // 1. シャトル総費用
    const totalShuttleCost = shuttlesUsedCount * shuttleCostPerBall;

    // 2. 体育館施設費用 (利用料 + 照明空調)
    const totalFacilityCost = facilityFee + (typeof lightingHvacFee === 'number' ? lightingHvacFee : 0);

    // 3. 総費用
    const totalCost = totalShuttleCost + totalFacilityCost;

    // 4. 厳密原価 (シャトル代のみ)
    const exactShuttleCostPerPerson = effectiveAttendees > 0 
      ? totalShuttleCost / effectiveAttendees 
      : 0;

    // 5. 【赤字回避】シャトル代のみ 100円単位切り上げ目安
    const breakEvenShuttleFee100 = effectiveAttendees > 0 
      ? Math.ceil(exactShuttleCostPerPerson / 100) * 100 
      : 0;

    // 6. 厳密原価 (体育館利用料込み)
    const exactTotalCostPerPerson = effectiveAttendees > 0 
      ? totalCost / effectiveAttendees 
      : 0;

    // 7. 【赤字回避】体育館代込み 100円単位切り上げ目安
    const breakEvenTotalFee100 = effectiveAttendees > 0 
      ? Math.ceil(exactTotalCostPerPerson / 100) * 100 
      : 0;
      

    // 8. 推奨目安金額
    const recommendedFee100 = includeFacilityCost ? breakEvenTotalFee100 : breakEvenShuttleFee100;
    const exactCostRef = includeFacilityCost ? exactTotalCostPerPerson : exactShuttleCostPerPerson;

    // 9. 適用参加費
    const activeFee = customAppliedFee !== null ? customAppliedFee : recommendedFee100;

    // 10. 収支・黒字シミュレーション
    const projectedIncome = effectiveAttendees * activeFee;
    const projectedProfitLoss = projectedIncome - totalCost;

    return {
      totalShuttleCost,
      totalFacilityCost,
      totalCost,
      exactShuttleCostPerPerson,
      breakEvenShuttleFee100,
      exactTotalCostPerPerson,
      breakEvenTotalFee100,
      recommendedFee100,
      exactCostRef,
      activeFee,
      projectedIncome,
      projectedProfitLoss,
    };
  }, [
    shuttlesUsedCount,
    shuttleCostPerBall,
    effectiveAttendees,
    includeFacilityCost,
    facilityFee,
    lightingHvacFee,
    customAppliedFee,
  ]);

  const handleStartEditSession = (session: PracticeSessionRecord) => {
    setEditingSessionId(session.id);
    if (session.date) setDate(session.date);
    if (session.location) setLocation(session.location);
    const balls = session.shuttleUsedCount !== undefined ? session.shuttleUsedCount : session.shuttlesUsedCount;
    if (balls !== undefined) setShuttlesUsedCount(balls);
    if (session.shuttleModelId && shuttleInventory.some(s => s.id === session.shuttleModelId)) {
      setSelectedShuttleId(session.shuttleModelId);
    } else if (session.shuttleId && shuttleInventory.some(s => s.id === session.shuttleId)) {
      setSelectedShuttleId(session.shuttleId);
    }
    if (session.shuttleCostPerBall) {
      setCustomBallCost(session.shuttleCostPerBall);
    }
    if (session.totalAttendeesCount) {
      setTotalAttendees(session.totalAttendeesCount);
    }
    if (session.facilityFee !== undefined) {
      setIncludeFacilityCost(session.facilityFee > 0 || ((session.lightingHvacFee || 0) > 0));
      setFacilityFee(session.facilityFee);
    }
    if (session.lightingHvacFee !== undefined) setLightingHvacFee(session.lightingHvacFee);
    if (session.notes) setNotes(session.notes);
    const fee = session.feePerPerson ?? session.roundedFeePerPerson ?? session.participationFeePerPerson;
    if (fee !== undefined) setCustomAppliedFee(fee);
    if (session.attendeeMemberIds && session.attendeeMemberIds.length > 0) {
      setSelectedMemberIds(session.attendeeMemberIds);
      setIsSelectingMembers(true);
    } else {
      setIsSelectingMembers(false);
    }

    // 既存の tx-facility-${session.id} を transactions から検索して立替情報を復元
    const facilityTx = (transactions || []).find(t => 
      t.id === `tx-facility-${session.id}` || 
      (t.sessionId === session.id && t.category === 'court_rental')
    );
    if (facilityTx && facilityTx.payerMemberId) {
      setVenuePaymentSource('out_of_pocket');
      setVenuePayerMemberId(facilityTx.payerMemberId);
    } else {
      setVenuePaymentSource('club_funds');
      setVenuePayerMemberId('');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 出納帳への記帳＆名簿参加履歴への反映
  const handleSaveToLedger = () => {
    const payer = members.find(m => m.id === venuePayerMemberId);
    const sessionRecord: PracticeSessionRecord = {
      id: editingSessionId || `ps-${Date.now()}`,
      date,
      timeSlot: 'custom',
      timeSlotLabel: location ? location : '体育館利用',
      location: location || '体育館',
      facilityFee: includeFacilityCost ? facilityFee : 0,
      lightingHvacFee: includeFacilityCost ? (typeof lightingHvacFee === 'number' ? lightingHvacFee : 0) : 0,
      feePaymentSource: includeFacilityCost ? venuePaymentSource : 'club_funds',
      feePayerMemberId: includeFacilityCost && venuePaymentSource === 'out_of_pocket' ? venuePayerMemberId : undefined,
      feePayerName: includeFacilityCost && venuePaymentSource === 'out_of_pocket' ? payer?.name : undefined,
      shuttleModelId: selectedShuttleId !== 'custom' ? selectedShuttleId : undefined,
      shuttleUsedCount: shuttlesUsedCount,
      shuttlesUsedCount: shuttlesUsedCount,
      shuttleCostPerBall,
      totalAttendeesCount: effectiveAttendees,
      visitorCount: isSelectingMembers ? Math.max(0, effectiveAttendees - selectedMemberIds.length) : Math.max(0, totalAttendees - (selectedMemberIds?.length || 0)),
      participationFeePerPerson: calc.activeFee,
      feePerPerson: calc.activeFee,
      roundedFeePerPerson: calc.activeFee,
      totalCollectedAmount: calc.projectedIncome,
      totalCost: calc.totalCost,
      totalIncome: calc.projectedIncome,
      netProfitLoss: calc.projectedProfitLoss,
      notes: notes || ``,
      syncedToLedger: true,
      attendeeMemberIds: isSelectingMembers ? selectedMemberIds : undefined,
    };

    if (editingSessionId && onUpdateSession) {
      onUpdateSession(sessionRecord);
      setEditingSessionId(null);
    } else {
      onSaveSessionToLedger(
        sessionRecord, 
        isSelectingMembers ? selectedMemberIds : undefined,
        includeFacilityCost ? venuePaymentSource : undefined,
        includeFacilityCost && venuePaymentSource === 'out_of_pocket' ? venuePayerMemberId : undefined
      );
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(mId => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-40 lg:pb-6">
      
      {/* Delete Confirmation Modal */}
      {deleteTargetSessionId && (() => {
        const hasReimbursedExpense = transactions.some(tx => 
          (tx.sessionId === deleteTargetSessionId || tx.id === `tx-facility-${deleteTargetSessionId}`) &&
          tx.paymentSource === 'out_of_pocket' &&
          tx.isReimbursed
        );

        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4">
              <h3 className="text-base font-bold text-text">開催ログを削除</h3>
              {hasReimbursedExpense ? (
                <div className="space-y-4">
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs leading-relaxed space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-rose-400">
                      <span>精算済みの立替金が存在するため削除できません</span>
                    </p>
                    <p>
                      この練習会に紐づく会場費は、既に立替者への返済・精算（出金記帳）が完了しています。
                    </p>
                    <p className="text-text-muted">
                      削除する場合は、先に「立替・精算」タブから該当の精算履歴を取り消してください。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetSessionId(null)}
                    className="w-full py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border text-text font-bold rounded-xl transition-all cursor-pointer text-xs"
                  >
                    閉じる
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-text-muted leading-relaxed">
                    この練習会ログを削除しますか？<br/>
                    消費したシャトル残高を在庫に戻しますか？
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (onDeleteSession) onDeleteSession(deleteTargetSessionId, true);
                        setDeleteTargetSessionId(null);
                      }}
                      className="w-full py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold rounded-xl shadow-md transition-all cursor-pointer text-xs"
                    >
                      削除してシャトルを戻す
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onDeleteSession) onDeleteSession(deleteTargetSessionId, false);
                        setDeleteTargetSessionId(null);
                      }}
                      className="w-full py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border text-text font-bold rounded-xl transition-all cursor-pointer text-xs"
                    >
                      削除してシャトルは戻さない
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetSessionId(null)}
                      className="w-full py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border text-text-muted font-bold rounded-xl transition-colors cursor-pointer text-xs"
                    >
                      キャンセル
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {editingSessionId && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between text-xs text-amber-300">
          <span className="font-bold flex items-center gap-2">
            <Edit3 className="w-4 h-4" />
            <span>過去の練習会ログを編集中です。変更後、「この練習会実績を出納帳に記帳する」を押すと内容が更新されます。</span>
          </span>
          <button
            type="button"
            onClick={() => setEditingSessionId(null)}
            className="px-3 py-1 bg-surface hover:bg-surface-hover text-text rounded-xl font-bold cursor-pointer"
          >
            キャンセル
          </button>
        </div>
      )}

      {/* ダブルス組合せ機能からの参加者引き継ぎ連携バナー */}
      {initialCarriedOverAttendeeIds && initialCarriedOverAttendeeIds.length > 0 && (
        <div className="bg-accent/15 border border-accent/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-accent shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent/20 border border-accent/30 rounded-full text-accent shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm text-text flex items-center gap-2">
                <span>ダブルス組合せから参加者 {initialCarriedOverAttendeeIds.length} 名を自動反映しました！</span>
              </div>
              <p className="text-text-muted text-xs mt-0.5">
                ビジターや途中参加・退出者を含む実参加者が選択されています。開催日・シャトル使用数・会場費を確認して登録してください。
              </p>
            </div>
          </div>
          {onClearCarriedOver && (
            <button
              type="button"
              onClick={onClearCarriedOver}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text border border-border rounded-xl font-bold text-xs cursor-pointer self-end sm:self-auto transition-colors shrink-0"
            >
              連携通知を閉じる
            </button>
          )}
        </div>
      )}
      
{/* Header Bento Card */}
<div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 lg:p-6 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
  <div className="min-w-0">
    <div className="flex items-center gap-2">
      <div className="p-1.5 sm:p-2 bg-accent/15 border border-accent/30 rounded-full text-accent shrink-0">
        <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>

      <h2 className="text-base sm:text-xl font-bold text-text tracking-tight">
        {editingSessionId ? '練習会を編集' : '練習会を登録'}
      </h2>
    </div>

    <p className="text-[10px] sm:text-xs lg:text-sm text-text-subtle leading-snug mt-1.5 sm:mt-2">
      「<strong className="text-accent">当日利用したシャトル本数</strong>」と「<strong className="text-accent">参加人数</strong>」から、赤字を出さない目安金額を<strong className="text-accent">100円単位</strong>で自動算出します。
    </p>
  </div>

  {/* Quick Mode Toggle */}
  <div className="w-full lg:w-auto shrink-0">
    <div className="flex items-center w-full lg:w-auto bg-surface-subtle border border-border rounded-xl p-1">
      <button
        type="button"
        onClick={() => setIncludeFacilityCost(true)}
        className={`flex-1 lg:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
          includeFacilityCost
            ? 'bg-accent text-accent-text shadow-md'
            : 'text-text-muted hover:text-text'
        }`}
      >
        <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span>施設利用料＋シャトル</span>
      </button>

      <button
        type="button"
        onClick={() => setIncludeFacilityCost(false)}
        className={`flex-1 lg:flex-none px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
          !includeFacilityCost
            ? 'bg-accent text-accent-text shadow-md'
            : 'text-text-muted hover:text-text'
        }`}
      >
        <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
        <span>シャトル代のみ</span>
      </button>
    </div>
  </div>
</div>

      {/* Latest Session Reference Banner */}
      {latestSession && (
        <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-center gap-2.5 text-text-muted">
            <span className="p-1.5 bg-accent/20 text-accent rounded-full shrink-0">
              <History className="w-4 h-4" />
            </span>
            <div>
              <span className="font-bold text-text">前回の登録内容を初期値としてセット中:</span>{' '}
              <span className="text-text-muted">
                {formatDate(latestSession.date)}{latestSession.location ? ` (${latestSession.location})` : ''} / 参加 {latestSession.totalAttendeesCount}名 / シャトル {latestSession.shuttleUsedCount}本 / 会場費 ¥{latestSession.facilityFee.toLocaleString()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => applySessionSettings(latestSession)}
            className="self-end sm:self-auto px-3 py-1.5 bg-surface-muted hover:bg-surface-hover text-accent font-bold rounded-xl border border-border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px]"
            title="前回の登録内容を再読み込み"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>前回設定を再反映</span>
          </button>
        </div>
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 bg-accent/20 border border-accent/40 rounded-xl text-center text-xs font-bold text-accent flex items-center justify-center gap-2 animate-fade-in shadow-md">
          <Sparkles className="w-4 h-4 text-accent" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Inputs Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Bento Card 1: 必須項目 ① 当日利用したシャトルの本数 */}
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-6 shadow-lg space-y-5 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-accent text-accent-text font-black text-[11px] rounded-full tracking-wider">
                  ①
                </span>
                <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-accent" />
                  <span>本数 & 単価</span>
                </h3>
              </div>
              <span className="text-xs font-bold text-accent tabular-nums">
                計 {calc.totalShuttleCost.toLocaleString()} 円
              </span>
            </div>

            {/* Shuttle Count Main Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-text flex items-center gap-1.5">
                  <span>シャトル本数</span>
                  <span className="text-[10px] text-text-muted font-normal">
                    ({Math.floor(shuttlesUsedCount / 12)}ダース+{shuttlesUsedCount % 12}本)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShuttlesUsedCount(prev => Math.max(1, prev - 1))}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent text-text rounded-xl transition-colors cursor-pointer"
                    title="1本減らす"
                    aria-label="シャトル本数を1本減らす"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="px-3 py-1.5 bg-surface-subtle border border-accent/40 rounded-xl text-center min-w-[70px] min-h-[44px] flex items-center justify-center">
                    <span className="text-lg font-black text-accent tabular-nums">{shuttlesUsedCount}</span>
                    <span className="text-xs text-text-muted ml-1 font-semibold">本</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShuttlesUsedCount(prev => prev + 1)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent text-text rounded-xl transition-colors cursor-pointer"
                    title="1本増やす"
                    aria-label="シャトル本数を1本増やす"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Slider for smooth selection */}
              <input
                type="range"
                min="1"
                max="60"
                step="1"
                value={shuttlesUsedCount}
                onChange={(e) => setShuttlesUsedCount(Number(e.target.value))}
                className="w-full accent-accent h-2.5 bg-surface-subtle rounded-lg cursor-pointer border border-border"
              />
            </div>

            {/* Shuttle Brand & 1本あたりの原価 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border text-xs">
              <div>
                <label className="block font-bold text-text-muted mb-1.5">シャトル銘柄 (在庫連動)</label>
                <select
                  value={selectedShuttleId}
                  onChange={(e) => setSelectedShuttleId(e.target.value)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-semibold sm:leading-normal focus:outline-none focus:ring-2 focus:ring-accent/50"
                >
                  {shuttleInventory.map((s) => {
                    const totalBalls = getShuttleTotalBalls(s);
                    const tubes = s.tubesInStock || 0;
                    const loose = s.looseBallsInStock || 0;
                    const stockLabel = loose > 0 ? `${tubes}ダース+${loose}本` : `${tubes}ダース`;
                    const avgCost = getShuttleCostPerBall(s);
                    return (
                      <option key={s.id} value={s.id} className="bg-surface text-text">
                        {s.modelName} ({s.speedNumber}番) [残:{stockLabel}/計{totalBalls}本] ({avgCost}円/本)
                      </option>
                    );
                  })}
                  <option value="custom" className="bg-surface text-text">カスタム手動単価</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-text-muted mb-1.5">1本あたりの原価</label>
                {selectedShuttleId === 'custom' ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-text-subtle">¥</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      step="10"
                      value={customBallCost}
                      onChange={(e) => setCustomBallCost(Math.max(1, Number(e.target.value)))}
                      className="w-full pl-7 pr-3 py-2 sm:py-2.5 bg-surface-subtle border border-accent/40 rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                ) : (
                  <div className="p-2.5 bg-surface-subtle border border-border rounded-xl font-bold text-text flex items-center justify-between">
                    <span className="text-text-muted">1本当たり(加重平均):</span>
                    <span className="text-accent font-black text-sm tabular-nums">
                      {shuttleCostPerBall} 円 <span className="text-xs font-normal text-text-muted">/本</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bento Card 2: 必須項目 ② 参加した人数 */}
          <div className="bg-surface border-2 border-accent/40 rounded-2xl p-6 shadow-lg space-y-5 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-accent text-accent-text font-black text-[11px] rounded-full tracking-wider">
                  ②
                </span>
                <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-accent" />
                  <span>参加人数</span>
                </h3>
              </div>

              {/* Toggle Simple / Member Select */}
              <button
                type="button"
                onClick={() => setIsSelectingMembers(!isSelectingMembers)}
                className="text-[11px] font-bold text-text-muted hover:text-accent flex items-center gap-1 transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{isSelectingMembers ? '人数数値入力へ' : '参加者個別選択へ'}</span>
              </button>
            </div>

            {!isSelectingMembers ? (
              /* Simple Mode: Just Total Attendees */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text">
                    参加人数
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTotalAttendees(prev => Math.max(1, prev - 1))}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent text-text rounded-xl transition-colors cursor-pointer"
                      title="1名減らす"
                      aria-label="参加人数を1名減らす"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="px-4 py-1.5 bg-surface-subtle border border-accent/40 rounded-xl text-center min-w-[70px] min-h-[44px] flex items-center justify-center">
                      <span className="text-lg font-black text-accent tabular-nums">{totalAttendees}</span>
                      <span className="text-xs text-text-muted ml-1 font-semibold">名</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTotalAttendees(prev => prev + 1)}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-surface-subtle border border-border hover:border-accent text-text rounded-xl transition-colors cursor-pointer"
                      title="1名増やす"
                      aria-label="参加人数を1名増やす"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <input
                  type="range"
                  min="1"
                  max="32"
                  step="1"
                  value={totalAttendees}
                  onChange={(e) => setTotalAttendees(Math.max(1, Number(e.target.value)))}
                  className="w-full accent-accent h-2.5 bg-surface-subtle rounded-lg cursor-pointer border border-border"
                />
              </div>
            ) : (
              /* Member Checkbox Select Mode */
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-text font-bold">参加名簿選択</span>
                    <span className="px-2 py-0.5 bg-accent/15 text-accent rounded-full font-bold text-[11px] tabular-nums">
                      参加: {selectedMemberIds.length}名 / 回収予定: {formatCurrency(selectedMemberIds.length * calc.activeFee)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (latestSession?.attendeeMemberIds && latestSession.attendeeMemberIds.length > 0) {
                          const validIds = latestSession.attendeeMemberIds.filter(id => {
                            const m = members.find(mem => mem.id === id);
                            return m && !m.isDeleted;
                          });
                          setSelectedMemberIds(validIds);
                        } else {
                          setSelectedMemberIds([]);
                        }
                      }}
                      className="px-2 py-1 bg-surface-subtle hover:bg-surface-hover text-accent font-bold text-[11px] rounded-xl border border-border transition-all cursor-pointer whitespace-nowrap"
                      title="直近練習会の参加名簿を反映"
                    >
                      前回と同じ
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds(members.filter(m => !m.isDeleted).map(m => m.id))}
                      className="px-2 py-1 bg-surface-subtle hover:bg-surface-hover text-text font-bold text-[11px] rounded-xl border border-border transition-all cursor-pointer whitespace-nowrap"
                    >
                      全員選択
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="px-2 py-1 bg-surface-subtle hover:bg-surface-hover text-text-muted font-bold text-[11px] rounded-xl border border-border transition-all cursor-pointer whitespace-nowrap"
                    >
                      全員解除
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {members.filter(m => !m.isDeleted).map(m => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMemberSelection(m.id)}
                        className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between text-xs cursor-pointer ${
                          isSelected 
                            ? 'bg-accent/15 border-accent/40 text-text font-bold'
                            : 'bg-surface-subtle border-border text-text-muted hover:text-text'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bento Card 3: 施設＆体育館利用料 (会場費) - 体育館ごとの利用料を直接入力 */}
          {includeFacilityCost && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-accent/15 border border-accent/30 rounded-full text-accent">
                    ③
                  </span>
                  <h3 className="text-sm font-bold text-text">
                    施設利用料
                  </h3>
                </div>
                <span className="text-xs font-bold text-accent tabular-nums">
                  会場費計 {calc.totalFacilityCost.toLocaleString()} 円
                </span>
              </div>

              {/* Direct Facility Fee Input & Quick Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-text text-xs">
                    利用料
                  </label>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-subtle text-sm">¥</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="100"
                    value={facilityFee}
                    onChange={(e) => setFacilityFee(Math.max(0, Number(e.target.value)))}
                    className="w-full pl-8 pr-3 py-2 sm:py-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:ring-2 focus:ring-accent/50 text-sm"
                    placeholder="例: 1500"
                  />
                </div>

              </div>

              {/* Lighting & HVAC Fee (初期値0円、必要な場合のみ入力) */}
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-text-muted text-xs">
                    照明・空調などの追加料金
                  </label>
                  {typeof lightingHvacFee === 'number' && lightingHvacFee > 0 && (
                    <span className="text-[11px] text-amber-400 font-bold">
                      +¥{lightingHvacFee.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-subtle text-sm">¥</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      step="100"
                      value={lightingHvacFee}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setLightingHvacFee('');
                        } else {
                          const num = Number(val);
                          setLightingHvacFee(isNaN(num) ? '' : Math.max(0, num));
                        }
                      }}
                      className="w-full pl-8 pr-3 py-1.5 sm:py-2 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:ring-2 focus:ring-accent/50 text-xs"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Facility Payment Source (事前決済・立替管理) */}
              <div className="p-3.5 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-text">支払元 (決済方法)</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVenuePaymentSource('club_funds')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                      venuePaymentSource === 'club_funds'
                        ? 'bg-accent/15 border-accent/50 text-accent shadow-sm'
                        : 'bg-surface border-border text-text-muted hover:text-text hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>クラブ残高から支払</span>
                      {venuePaymentSource === 'club_funds' && (
                        <span className="text-[10px] bg-accent/20 px-1.5 py-0.5 rounded-full text-accent font-bold">
                          選択中
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-normal text-text-muted mt-0.5">クラブ口座・手元資金から事前決済</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVenuePaymentSource('out_of_pocket')}
                    className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                      venuePaymentSource === 'out_of_pocket'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-surface border-border text-text-muted hover:text-text hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>個人立替</span>
                      {venuePaymentSource === 'out_of_pocket' && (
                        <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded-full text-amber-300 font-bold">
                          立替あり
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-normal text-text-muted mt-0.5">後でクラブから立替者に返済・精算</div>
                  </button>
                </div>

                {venuePaymentSource === 'out_of_pocket' && (
                  <div className="pt-1.5 border-t border-border">
                    <label className="block text-amber-300 font-bold text-[11px] mb-1">会場費を立て替えた人</label>
                    <select
                      value={venuePayerMemberId}
                      onChange={(e) => setVenuePayerMemberId(e.target.value)}
                      className="w-full py-1.5 px-2.5 sm:p-2 bg-surface border border-amber-500/40 rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-semibold sm:leading-normal focus:outline-none focus:border-amber-400 text-xs"
                    >
                      {members.filter(m => !m.isDeleted).map(m => (
                        <option key={m.id} value={m.id} className="bg-surface text-text">
                          {m.name} ({m.role === 'leader' ? '代表' : m.role === 'officer' ? '役員' : '部員'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes & Date */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-md space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-text-muted mb-1">開催日</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-semibold sm:leading-normal focus:outline-none focus:border-accent"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-text-muted mb-1">会場名</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text placeholder-text-subtle focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-text-muted mb-1">備考</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text placeholder-text-subtle focus:outline-none focus:border-accent"
              />
            </div>
          </div>

        </div>

        {/* Right 5 Cols: Main Calculated Results & 100-Yen Rounding Benchmark */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Bento Card: HERO 100-yen Rounded-up Non-Deficit Result */}
          <div className="bg-surface border-2 border-accent/80 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Top Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent/15 border border-accent/30 text-accent rounded-full text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>赤字回避 100円単位推奨金額</span>
              </div>
              <span className="text-[11px] text-text-muted font-semibold">
                参加 {effectiveAttendees} 名
              </span>
            </div>

            {/* BIG DISPLAY */}
            <div className="text-center py-2 space-y-1">
              <span className="text-xs font-bold text-text-muted block tracking-wider uppercase">
                1人あたりの集金金額 (最終適用額)
              </span>
              <div className="text-4xl sm:text-5xl font-black text-accent tracking-tight tabular-nums flex items-center justify-center gap-1">
                <span className="text-2xl sm:text-3xl text-accent/80 font-bold">¥</span>
                <span>{calc.activeFee.toLocaleString()}</span>
                <span className="text-xs sm:text-sm font-bold text-text-muted ml-1">/ 人</span>
              </div>

              {/* シンプル設定エリア */}
              <div className="mt-3 p-3 bg-surface-subtle border border-border rounded-xl text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-text-muted">
                    💡 集金金額の設定
                  </span>
                  {customAppliedFee !== null && (
                    <button
                      type="button"
                      onClick={() => setCustomAppliedFee(null)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer"
                    >
                      自動値に戻す(¥{calc.recommendedFee100})
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle font-bold text-xs">¥</span>
                    <input
                      type="number"
                      step="50"
                      value={customAppliedFee !== null ? customAppliedFee : calc.recommendedFee100}
                      onChange={(e) => setCustomAppliedFee(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-1.5 bg-surface border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                  <span className="text-xs text-text-muted font-semibold whitespace-nowrap">円/人</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1 px-3 py-1 bg-surface-subtle border border-border rounded-xl text-xs text-text-muted mt-2 text-center">
                <span>自動推奨原価: {formatCurrency(calc.recommendedFee100)}</span>
                {customAppliedFee !== null ? (
                  <span className="text-amber-400 font-bold">✨ カスタム設定中</span>
                ) : (
                  <span className="text-accent font-bold">📌 推奨赤字回避額</span>
                )}
              </div>
            </div>

            {/* Comparison Bento Sub-Cards: Shuttle Only vs Total */}
            <div className="grid grid-cols-2 gap-3 pt-2">

              {/* Full cost with courts */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                includeFacilityCost 
                  ? 'bg-accent/15 border-accent/40 text-accent' 
                  : 'bg-surface-subtle border-border text-text-muted'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  体育館利用料込み
                </div>
                <div className="text-lg font-black mt-1 tabular-nums">
                  ¥{calc.breakEvenTotalFee100.toLocaleString()}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  原価 ¥{Math.round(calc.exactTotalCostPerPerson).toLocaleString()} /人
                </div>
              </div>
              
              {/* Shuttle only */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                !includeFacilityCost 
                  ? 'bg-accent/15 border-accent/40 text-accent' 
                  : 'bg-surface-subtle border-border text-text-muted'
              }`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  シャトル代のみ
                </div>
                <div className="text-lg font-black mt-1 tabular-nums">
                  ¥{calc.breakEvenShuttleFee100.toLocaleString()}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  原価 ¥{Math.round(calc.exactShuttleCostPerPerson).toLocaleString()} /人
                </div>
              </div>
            </div>

            {/* Cost Breakdown Details */}
            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2.5 text-xs">
              <div className="font-bold text-text flex items-center justify-between border-b border-border pb-2">
                <span>開催原価の内訳</span>
                <span className="text-rose-400 font-extrabold">{formatCurrency(calc.totalCost)}</span>
              </div>
              
              <div className="flex justify-between text-text-muted">
                <span>シャトル消費 ({shuttlesUsedCount}本 × @{shuttleCostPerBall}円):</span>
                <span className="font-semibold text-text">{formatCurrency(calc.totalShuttleCost)}</span>
              </div>

              {includeFacilityCost && (
                <>
                  <div className="flex justify-between text-text-muted">
                    <span>体育館利用料 ({facilityFee.toLocaleString()}円):</span>
                    <span className="font-semibold text-text">{formatCurrency(facilityFee)}</span>
                  </div>
                  {typeof lightingHvacFee === 'number' && lightingHvacFee > 0 && (
                    <div className="flex justify-between text-text-muted">
                      <span>夜間照明・空調費:</span>
                      <span className="font-semibold text-text">{formatCurrency(lightingHvacFee)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="pt-2 border-t border-border flex justify-between text-text-muted">
                <span>参加人数:</span>
                <span className="font-bold text-accent">{effectiveAttendees} 名</span>
              </div>
            </div>

            {/* Simulation Balance Result */}
            <div className="p-4 bg-accent/10 border border-accent/20 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-accent flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <span>回収見込・収支結果</span>
                </span>
                <span className={`font-black text-sm tabular-nums ${
                  calc.projectedProfitLoss >= 0 ? 'text-accent' : 'text-rose-400'
                }`}>
                  {calc.projectedProfitLoss >= 0 ? `+${calc.projectedProfitLoss.toLocaleString()} 円 (黒字)` : `${calc.projectedProfitLoss.toLocaleString()} 円 (赤字)`}
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                1人あたり <strong className="text-accent">{calc.recommendedFee100}円</strong> 徴収した場合、総回収額は <strong className="text-text">{calc.projectedIncome.toLocaleString()}円</strong> となり、<strong className="text-accent">赤字を出さずに +{Math.max(0, calc.projectedProfitLoss).toLocaleString()}円</strong> がクラブ残高にプールされます。
              </p>
            </div>

            {/* Action: Log to Ledger (Desktop: inside hero card) */}
            <div className="hidden lg:block space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSaveToLedger}
                className={`w-full py-3.5 ${editingSessionId ? 'bg-amber-500 hover:bg-amber-400 text-white' : 'bg-accent hover:bg-accent-hover text-accent-text'} font-black text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[48px] active:scale-98`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{editingSessionId ? '更新する' : '記帳する'}</span>
              </button>

              {savedSuccess && (
                <div className="p-2.5 bg-accent/20 border border-accent/40 rounded-xl text-center text-xs font-bold text-accent flex items-center justify-center gap-1.5 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <span>出納帳に練習会収支を記録し、名簿参加ログを更新しました！</span>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Mobile / Tablet Sticky Footer (Rendered via Portal to document.body to ensure it attaches to viewport regardless of ancestor constraints) */}
      {typeof document !== 'undefined' && createPortal(
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border px-3 sm:px-6 lg:px-8 py-3 pb-safe shadow-2xl">
          <div className="w-full max-w-7xl mx-auto">
            <button
              type="button"
              onClick={handleSaveToLedger}
              className={`w-full min-h-[48px] py-3 mb-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer active:scale-[0.98] ${
                editingSessionId
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-accent hover:bg-accent-hover text-accent-text'
              }`}
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>
                {editingSessionId
                  ? '練習会ログを更新する'
                  : effectiveAttendees > 0
                    ? `出納帳に記帳する (1人 ¥${calc.activeFee.toLocaleString()})`
                    : '出納帳に記帳する'}
              </span>
            </button>

            {savedSuccess && (
              <div className="mt-2 p-2 bg-accent/20 border border-accent/40 rounded-xl text-center text-xs font-bold text-accent flex items-center justify-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>出納帳に記帳しました！</span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Past Practice Logs Bento Card */}
      <div className="bg-surface border border-border rounded-2xl p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <h3 className="text-sm font-bold text-text flex items-center gap-2 whitespace-nowrap">
            <Clock className="w-4 h-4 text-accent shrink-0" />
            <span>過去の練習会 開催ログ</span>
          </h3>
          <span className="text-xs text-text-muted whitespace-nowrap">計 {practiceSessions.length} 回開催</span>
        </div>

        {practiceSessions.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-xs">
            まだ記録された練習会はありません。
          </div>
        ) : (
          <div className="space-y-3">
            {practiceSessions.map((session) => (
              <div key={session.id} className="p-3.5 sm:p-4 rounded-xl border border-border bg-surface-subtle text-xs space-y-2.5 hover:border-border transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text whitespace-nowrap">{formatDate(session.date)}</span>
                    {session.timeSlotLabel && session.timeSlotLabel !== session.location && (
                      <span className="px-2 py-0.5 bg-accent/10 text-accent border border-accent/20 rounded-full font-semibold text-[11px] whitespace-nowrap">
                        {session.timeSlotLabel}
                      </span>
                    )}
                    <span className="text-text-muted font-medium">{session.location}</span>
                  </div>
                  <div className="flex items-center gap-x-3 gap-y-1 text-xs flex-wrap">
                    <span className="text-rose-400 font-bold whitespace-nowrap">総原価: {formatCurrency(session.totalCost)}</span>
                    <span className="text-teal-400 font-bold whitespace-nowrap">参加費回収: +{formatCurrency(session.totalIncome)}</span>
                    <span className={`font-bold whitespace-nowrap ${session.netProfitLoss >= 0 ? 'text-accent' : 'text-amber-400'}`}>
                      収支: {session.netProfitLoss >= 0 ? `+${formatCurrency(session.netProfitLoss)}` : formatCurrency(session.netProfitLoss)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-text-muted">
                  <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap text-[11px] sm:text-xs">
                    <span className="whitespace-nowrap">参加人数: <strong className="text-text font-semibold">{session.totalAttendeesCount}名</strong> (@{session.feePerPerson}円)</span>
                    <span className="whitespace-nowrap">シャトル消費: <strong className="text-text font-semibold">{session.shuttleUsedCount}本</strong></span>
                    {session.facilityFee > 0 && <span className="whitespace-nowrap">体育館料: <strong className="text-text font-semibold">{formatCurrency(session.facilityFee)}</strong></span>}
                    {(session.lightingHvacFee || 0) > 0 && <span className="whitespace-nowrap">(照明・空調: +{formatCurrency(session.lightingHvacFee || 0)})</span>}
                    {session.notes && <span className="text-text-subtle italic">({session.notes})</span>}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-border">
                    <button
                      type="button"
                      onClick={() => handleStartEditSession(session)}
                      className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-sky-400 hover:text-sky-300 font-bold text-[11px] rounded-xl border border-border transition-all cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                      title="この練習会ログを編集"
                    >
                      <Edit3 className="w-3 h-3 shrink-0" />
                      <span>編集</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applySessionSettings(session);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover text-accent hover:text-accent font-bold text-[11px] rounded-xl border border-border transition-all cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                      title="この練習会の設定をシミュレーターにコピー"
                    >
                      <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                      <span>この設定を反映</span>
                    </button>
                    {onDeleteSession && (() => {
                      const isReimbursed = transactions.some(tx => 
                        (tx.sessionId === session.id || tx.id === `tx-facility-${session.id}`) &&
                        tx.paymentSource === 'out_of_pocket' &&
                        tx.isReimbursed
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTargetSessionId(session.id);
                          }}
                          className={`px-2.5 py-1.5 font-bold text-[11px] rounded-xl border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            isReimbursed
                              ? 'bg-surface text-text-subtle border-border'
                              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                          }`}
                          title={isReimbursed ? '精算済み立替金が存在するため削除できません' : 'この練習会ログを削除'}
                        >
                          削除{isReimbursed && ' (精算済)'}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
