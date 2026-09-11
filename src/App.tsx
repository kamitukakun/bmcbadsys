/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AppState, 
  Transaction, 
  Member, 
  ShuttleStock, 
  PracticeSessionRecord, 
  AnnualBudgetPlan, 
  ClubSettings, 
  PaymentMethod,
  PaymentSource,
  ReimbursementRecord
} from './types';
import { INITIAL_APP_STATE } from './data/initialData';
import { resetAppState } from './utils/storage';
import { getTodayString } from './utils/dateUtils';
import { formatDate } from './utils/formatters';
import { 
  getShuttleTotalBalls, 
  normalizeBallsToTubes, 
  adjustShuttleStockByBalls,
  getShuttleCostPerBall,
  getShuttleTotalOriginalCost,
  restockShuttle,
  combineTubesAndLoose
} from './utils/shuttleUtils';
import { calculateFinancialSummary } from './utils/accountingUtils';
import { Header, NavTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PracticeCalculatorView } from './components/PracticeCalculatorView';
import { DoublesMatchView } from './components/DoublesMatchView';
import { ReimbursementsView } from './components/ReimbursementsView';
import { LedgerView } from './components/LedgerView';
import { MembersAttendanceView } from './components/MembersAttendanceView';
import { ShuttleManagerView } from './components/ShuttleManagerView';
import { BudgetPlanView } from './components/BudgetPlanView';
import { TransactionModal } from './components/TransactionModal';
import { MemberModal } from './components/MemberModal';
import { SettingsModal } from './components/SettingsModal';
import { PrintReportModal } from './components/PrintReportModal';
import { AuthGate } from './components/AuthGate';

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_APP_STATE);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // ダブルス組み合わせから練習会登録への引き継ぎステート
  const [carriedOverAttendeeIds, setCarriedOverAttendeeIds] = useState<string[] | null>(null);
  const [carriedOverSessionDate, setCarriedOverSessionDate] = useState<string | null>(null);

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ダブルス組み合わせから練習会登録へのシームレス引き継ぎ
  const handleProceedFromDoublesToSession = (selectedMemberIds: string[], sessionDate: string) => {
    setCarriedOverAttendeeIds(selectedMemberIds);
    setCarriedOverSessionDate(sessionDate);
    setCurrentTab('calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Modals state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Apply theme class to document
  useEffect(() => {
    const theme = state.settings.theme || 'default';
    document.documentElement.classList.remove('theme-default', 'theme-pixel', 'theme-clean_light', 'theme-clean-light');
    document.body.classList.remove('theme-default', 'theme-pixel', 'theme-clean_light', 'theme-clean-light');
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    if (theme === 'clean_light') {
      document.documentElement.classList.add('theme-clean-light');
      document.body.classList.add('theme-clean-light');
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [state.settings.theme]);

  // Calculations for Header and Badges
  const { 
    totalIncome, 
    totalExpense, 
    currentBalance, 
    unreimbursedDebtAmount, 
    inactiveMembersCount, 
    lowStockShuttleCount 
  } = useMemo(() => {
    // 一元計算関数から総収入・活動支出・手元実残高・未精算立替金を取得
    const summary = calculateFinancialSummary(state.transactions);

    // 2. 直近6回のイベントに未参加の名簿数
    const recent6Sessions = [...state.practiceSessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
    const recent6SessionIds = new Set(recent6Sessions.map(s => s.id));

    let inactivesCount = 0;
    if (recent6Sessions.length > 0) {
      state.members.forEach(m => {
        const logs = m.participationLogs || [];
        const hasAttendedRecent6 = logs.some(l => recent6SessionIds.has(l.sessionId));
        const hasEverAttended = logs.length > 0;
        if (hasEverAttended && !hasAttendedRecent6) inactivesCount++;
      });
    }

    // 3. シャトル要補充アラート (総保有球数が発注目安ライン以下か判定)
    const lowStock = state.shuttleInventory.filter(s => {
      const totalBalls = getShuttleTotalBalls(s);
      const thresholdBalls = s.lowStockThreshold * (s.ballsPerTube || 12);
      return totalBalls <= thresholdBalls;
    }).length;

    return {
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense,
      currentBalance: summary.currentBalance,
      unreimbursedDebtAmount: summary.unreimbursedDebtAmount,
      inactiveMembersCount: inactivesCount,
      lowStockShuttleCount: lowStock,
    };
  }, [state.transactions, state.practiceSessions, state.members, state.shuttleInventory]);

  // ----------------------------------------------------
  // Transaction Handlers
  // ----------------------------------------------------
  const handleSaveTransaction = (txData: Omit<Transaction, 'id' | 'createdAt'>, id?: string) => {
    setState((prev) => {
      if (id) {
        // Edit existing
        const updated = prev.transactions.map((t) =>
          t.id === id ? { ...t, ...txData } : t
        );
        return { ...prev, transactions: updated };
      } else {
        // Create new
        const newTx: Transaction = {
          ...txData,
          id: `tx-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        return { ...prev, transactions: [newTx, ...prev.transactions] };
      }
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  // ----------------------------------------------------
  // Member Handlers
  // ----------------------------------------------------
  const handleSaveMember = (memberData: Omit<Member, 'id'>, id?: string): string => {
    const targetId = id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setState((prev) => {
      if (id) {
        const updated = prev.members.map((m) =>
          m.id === id ? { ...m, ...memberData } : m
        );
        return { ...prev, members: updated };
      } else {
        const newMember: Member = {
          ...memberData,
          id: targetId,
          participationLogs: [],
        };
        return { ...prev, members: [...prev.members, newMember] };
      }
    });
    return targetId;
  };

  const handleDeleteMember = (memberId: string) => {
    setState((prev) => ({
      ...prev,
      members: prev.members.map(m => m.id === memberId ? { ...m, isDeleted: true } : m),
    }));
  };

  // ----------------------------------------------------
  // Reimbursement Execution Handler (立替金の返済・精算)
  // ----------------------------------------------------
  const handleExecuteReimbursement = (
    memberId: string,
    memberName: string,
    amount: number,
    transactionIds: string[],
    paymentMethod: PaymentMethod,
    notes: string,
    date: string
  ) => {
    setState((prev) => {
      const nowStr = new Date().toISOString();
      const txIdSet = new Set(transactionIds);
      const reimbId = `reimb-${Date.now()}`;
      const payoutTxId = `tx-reimb-payout-${Date.now()}`;

      // 1. 対象の立替取引を「精算済」に更新
      const updatedTransactions = prev.transactions.map(tx => {
        if (txIdSet.has(tx.id)) {
          return {
            ...tx,
            isReimbursed: true,
            reimbursedAt: date,
            reimbursementId: reimbId,
          };
        }
        return tx;
      });

      // 2. クラブ出納帳に「立替金返済・精算」として出金記帳
      const payoutTx: Transaction = {
        id: payoutTxId,
        date,
        type: 'expense',
        category: 'reimbursement_payout',
        amount,
        paymentMethod,
        vendor: `${memberName} 様`,
        paymentSource: 'club_funds',
        description: transactionIds.length === 1
          ? `【立替金返済】${memberName} 様 (1件: ${notes || '個別精算'})`
          : `【立替金返済精算】${memberName} 様 (${transactionIds.length}件分)`,
        recordedBy: prev.settings.treasurerName || '会計係',
        receiptNote: notes || '',
        createdAt: nowStr,
      };

      // 3. 返済履歴レコード追加
      const newRecord: ReimbursementRecord = {
        id: reimbId,
        memberId: memberId || '',
        memberName,
        amount,
        date,
        paymentMethod,
        transactionIds,
        payoutTransactionId: payoutTxId,
        notes: notes || '',
        createdAt: nowStr,
        status: 'reimbursed',
      };

      return {
        ...prev,
        transactions: [payoutTx, ...updatedTransactions],
        reimbursements: [newRecord, ...(prev.reimbursements || [])],
      };
    });
  };

  // ----------------------------------------------------
  // Dismiss Unreimbursed Transaction (返済せず削除し履歴化)
  // ----------------------------------------------------
  const handleDismissUnreimbursedTransaction = (txId: string, reason?: string) => {
    setState((prev) => {
      const targetTx = prev.transactions.find(t => t.id === txId);
      if (!targetTx) return prev;
      if (targetTx.isReimbursed) return prev; // 既に精算済みのものは対象外

      const nowStr = new Date().toISOString();
      const today = getTodayString();
      const reimbId = `reimb-dismiss-${Date.now()}`;

      // 復元用バックアップ (undefinedプロパティを排除したTransactionコピー)
      const cleanBackupTx: Transaction = {
        ...targetTx,
        isReimbursed: false,
      };
      delete (cleanBackupTx as any).reimbursedAt;
      delete (cleanBackupTx as any).reimbursementId;

      const defaultNotes = `返済せず削除 (${formatDate(targetTx.date)} ${targetTx.description})`;

      const newRecord: ReimbursementRecord = {
        id: reimbId,
        memberId: targetTx.payerMemberId || '',
        memberName: targetTx.payerName || '立替者',
        amount: targetTx.amount,
        date: today,
        paymentMethod: targetTx.paymentMethod || 'other',
        transactionIds: [targetTx.id],
        notes: reason?.trim() || defaultNotes,
        createdAt: nowStr,
        status: 'dismissed_without_payout',
        originalTransaction: cleanBackupTx,
      };

      return {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== txId),
        reimbursements: [newRecord, ...(prev.reimbursements || [])],
      };
    });
  };

  const handleUpdatePracticeSession = (updatedSession: PracticeSessionRecord) => {
    setState((prev) => {
      const oldSession = prev.practiceSessions.find(s => s.id === updatedSession.id);
      const filteredSessions = prev.practiceSessions.map(s => s.id === updatedSession.id ? updatedSession : s);
      const filteredTransactions = prev.transactions.filter(tx => 
        tx.sessionId !== updatedSession.id && 
        tx.id !== `tx-attend-income-${updatedSession.id}` && 
        tx.id !== `tx-facility-${updatedSession.id}`
      );
      
      const today = updatedSession.date || getTodayString();
      const newTransactions: Transaction[] = [];
      const sessionSlotLabel = updatedSession.timeSlotLabel || '練習会';
      const sessionTitle = `${updatedSession.location} (${sessionSlotLabel})`;

      // 既存の会場費取引から isReimbursed などの状態を引き継ぐ
      const existingFacilityTx = prev.transactions.find(tx => 
        tx.id === `tx-facility-${updatedSession.id}` || 
        (tx.sessionId === updatedSession.id && tx.category === 'court_rental')
      );
      const isOutPocket = updatedSession.feePaymentSource === 'out_of_pocket';
      const isReimbursed = isOutPocket ? (existingFacilityTx?.isReimbursed ?? false) : undefined;
      const payer = prev.members.find(m => m.id === updatedSession.feePayerMemberId);

      if (updatedSession.facilityFee > 0) {
        newTransactions.push({
          id: `tx-facility-${updatedSession.id}`,
          date: today,
          type: 'expense',
          category: 'court_rental',
          amount: updatedSession.facilityFee,
          paymentMethod: updatedSession.feePaymentMethod || 'cash',
          vendor: updatedSession.location,
          paymentSource: updatedSession.feePaymentSource || 'club_funds',
          payerMemberId: isOutPocket ? updatedSession.feePayerMemberId : undefined,
          payerName: isOutPocket ? (updatedSession.feePayerName || payer?.name) : undefined,
          isReimbursed: isReimbursed,
          description: `${sessionTitle} 体育館利用料`,
          recordedBy: prev.settings.treasurerName || '会計係',
          sessionId: updatedSession.id,
          receiptNote: isOutPocket ? `立替者: ${updatedSession.feePayerName || payer?.name}` : undefined,
          createdAt: existingFacilityTx?.createdAt || new Date().toISOString(),
        });
      }

      const feePerPerson = updatedSession.participationFeePerPerson || updatedSession.roundedFeePerPerson || updatedSession.feePerPerson || 0;
      const totalCollected = updatedSession.totalCollectedAmount || updatedSession.totalIncome || (updatedSession.totalAttendeesCount * feePerPerson);
      if (totalCollected > 0) {
        newTransactions.push({
          id: `tx-attend-income-${updatedSession.id}`,
          date: today,
          type: 'income',
          category: 'event_fee',
          amount: totalCollected,
          paymentMethod: 'cash',
          description: `練習会 参加費集金 (${updatedSession.totalAttendeesCount}名 × ¥${feePerPerson})`,
          recordedBy: prev.settings.treasurerName || '会計係',
          sessionId: updatedSession.id,
          createdAt: new Date().toISOString(),
        });
      }

      // シャトル在庫の差分・モデル変更連動 (在庫加重平均方式)
      let nextShuttleInventory = prev.shuttleInventory;
      const oldModelId = oldSession?.shuttleModelId || oldSession?.shuttleId;
      const oldBallsUsed = oldSession?.shuttlesUsedCount ?? oldSession?.shuttleUsedCount ?? 0;
      const oldCostPerBall = oldSession?.shuttleCostPerBall;

      const newModelId = updatedSession.shuttleModelId || updatedSession.shuttleId;
      const newBallsUsed = updatedSession.shuttlesUsedCount ?? updatedSession.shuttleUsedCount ?? 0;
      const newCostPerBall = updatedSession.shuttleCostPerBall;

      if (oldModelId === newModelId) {
        if (oldModelId && newBallsUsed !== oldBallsUsed) {
          const diff = newBallsUsed - oldBallsUsed;
          nextShuttleInventory = nextShuttleInventory.map(s => {
            if (s.id === oldModelId) {
              if (diff > 0) {
                // 使用本数が増えた場合: 増加分(diff)を現在の在庫加重平均原価で消費
                const unitCost = newCostPerBall || getShuttleCostPerBall(s);
                const addConsumedCost = Math.round(diff * unitCost);
                return adjustShuttleStockByBalls(s, -diff, -addConsumedCost);
              } else {
                // 使用本数が減った場合: 差分(|diff|)本を在庫へ戻す
                // 戻す原価は「その練習会で消費した単価(oldCostPerBall)」で正確に復元
                const unitCost = oldCostPerBall || getShuttleCostPerBall(s);
                const restoredCost = Math.round(Math.abs(diff) * unitCost);
                return adjustShuttleStockByBalls(s, Math.abs(diff), restoredCost);
              }
            }
            return s;
          });
        }
      } else {
        // モデル変更時: 旧モデルを過去消費原価で返却し、新モデルから最新加重平均で消費
        nextShuttleInventory = nextShuttleInventory.map(s => {
          if (oldModelId && s.id === oldModelId && oldBallsUsed > 0) {
            // 旧モデル返却: 過去消費時の単価で在庫総原価を復元
            const unitCost = oldCostPerBall || getShuttleCostPerBall(s);
            const restoredCost = Math.round(oldBallsUsed * unitCost);
            return adjustShuttleStockByBalls(s, oldBallsUsed, restoredCost);
          }
          if (newModelId && s.id === newModelId && newBallsUsed > 0) {
            // 新モデル消費: 新モデルの加重平均原価で消費
            const unitCost = newCostPerBall || getShuttleCostPerBall(s);
            const consumedCost = Math.round(newBallsUsed * unitCost);
            return adjustShuttleStockByBalls(s, -newBallsUsed, -consumedCost);
          }
          return s;
        });
      }

      return {
        ...prev,
        practiceSessions: filteredSessions,
        transactions: [...newTransactions, ...filteredTransactions],
        shuttleInventory: nextShuttleInventory,
      };
    });
  };

  const handleUpdateParticipation = (
    memberId: string,
    sessionId: string,
    newFeePaid: number
  ) => {
    setState((prev) => {
      // 1. 当該練習会に参加している名簿の参加ログの参加費を newFeePaid に統一更新
      const updatedMembers = prev.members.map(m => {
        const hasSessionLog = m.participationLogs?.some(log => log.sessionId === sessionId);
        if (hasSessionLog) {
          return {
            ...m,
            participationLogs: m.participationLogs?.map(log => 
              log.sessionId === sessionId ? { ...log, feePaid: newFeePaid } : log
            )
          };
        }
        return m;
      });

      // 2. PracticeSessionRecord の参加費と収入を再計算（部員・ビジター同一参加費仕様）
      const updatedSessions = prev.practiceSessions.map(s => {
        if (s.id === sessionId) {
          const attendeeIds = s.attendeeMemberIds || [];
          const visitorCount = s.visitorCount !== undefined 
            ? Number(s.visitorCount) 
            : Math.max(0, (s.totalAttendeesCount || 0) - attendeeIds.length);
          const totalAttendeesCount = attendeeIds.length + visitorCount;
          const newTotalIncome = totalAttendeesCount * newFeePaid;

          return {
            ...s,
            participationFeePerPerson: newFeePaid,
            feePerPerson: newFeePaid,
            roundedFeePerPerson: newFeePaid,
            totalAttendeesCount,
            visitorCount,
            totalCollectedAmount: newTotalIncome,
            totalIncome: newTotalIncome,
            netProfitLoss: newTotalIncome - (s.totalCost || 0),
          };
        }
        return s;
      });

      // 3. Transactions を更新 (tx-attend-income- または tx-income-)
      const updatedTransactions = prev.transactions.map(tx => {
        if ((tx.sessionId === sessionId || tx.id === `tx-attend-income-${sessionId}` || tx.id === `tx-income-${sessionId}`) && tx.category === 'event_fee') {
          const targetSession = updatedSessions.find(s => s.id === sessionId);
          const newAmount = targetSession?.totalCollectedAmount ?? targetSession?.totalIncome ?? tx.amount;
          return {
            ...tx,
            amount: newAmount,
            description: `練習会 参加費集金 (${targetSession?.totalAttendeesCount || 0}名 × ¥${newFeePaid})`,
          };
        }
        return tx;
      });

      return {
        ...prev,
        members: updatedMembers,
        practiceSessions: updatedSessions,
        transactions: updatedTransactions
      };
    });
  };

  const handleDeleteParticipation = (
    memberId: string,
    sessionId: string
  ) => {
    setState((prev) => {
      // 1. 名簿の参加ログから削除
      const updatedMembers = prev.members.map(m => {
        if (m.id === memberId) {
          return {
            ...m,
            participationLogs: m.participationLogs?.filter(log => log.sessionId !== sessionId)
          };
        }
        return m;
      });

      // 2. PracticeSessionRecord の参加者・人数・収入を再計算
      const updatedSessions = prev.practiceSessions.map(s => {
        if (s.id === sessionId) {
          const updatedAttendeeIds = (s.attendeeMemberIds || []).filter(id => id !== memberId);
          const visitorCount = s.visitorCount !== undefined 
            ? Number(s.visitorCount) 
            : Math.max(0, (s.totalAttendeesCount || 0) - (s.attendeeMemberIds?.length || 0));
          const newTotalAttendeesCount = updatedAttendeeIds.length + visitorCount;
          const feePerPerson = s.participationFeePerPerson ?? s.roundedFeePerPerson ?? s.feePerPerson ?? 0;
          const newTotalIncome = newTotalAttendeesCount * feePerPerson;

          return {
            ...s,
            attendeeMemberIds: updatedAttendeeIds,
            totalAttendeesCount: newTotalAttendeesCount,
            visitorCount,
            participationFeePerPerson: feePerPerson,
            feePerPerson: feePerPerson,
            roundedFeePerPerson: feePerPerson,
            totalCollectedAmount: newTotalIncome,
            totalIncome: newTotalIncome,
            netProfitLoss: newTotalIncome - (s.totalCost || 0),
          };
        }
        return s;
      });

      // 3. Transactions を更新
      const updatedTransactions = prev.transactions.map(tx => {
        if ((tx.sessionId === sessionId || tx.id === `tx-attend-income-${sessionId}` || tx.id === `tx-income-${sessionId}`) && tx.category === 'event_fee') {
          const targetSession = updatedSessions.find(s => s.id === sessionId);
          const newAmount = targetSession?.totalCollectedAmount ?? targetSession?.totalIncome ?? tx.amount;
          return {
            ...tx,
            amount: newAmount,
            description: `練習会 参加費集金 (${targetSession?.totalAttendeesCount || 0}名 × ¥${targetSession?.feePerPerson || 0})`,
          };
        }
        return tx;
      });

      return {
        ...prev,
        members: updatedMembers,
        practiceSessions: updatedSessions,
        transactions: updatedTransactions
      };
    });
  };

  const handleDeletePracticeSession = (sessionId: string, restoreShuttles: boolean) => {
    setState((prev) => {
      const session = prev.practiceSessions.find(s => s.id === sessionId);
      if (!session) return prev;

      // 精算済みの立替取引（出金返済済み）が存在する場合は削除をブロック
      const hasReimbursedExpense = prev.transactions.some(tx => 
        (tx.sessionId === sessionId || tx.id === `tx-facility-${sessionId}`) &&
        tx.paymentSource === 'out_of_pocket' &&
        tx.isReimbursed
      );

      if (hasReimbursedExpense) {
        console.warn(`精算済み立替金が存在するため、練習会ログ(${sessionId})の削除を中止しました。`);
        return prev;
      }
      
      let nextShuttleInventory = prev.shuttleInventory;
      if (restoreShuttles && session) {
        const usedBalls = session.shuttlesUsedCount || session.shuttleUsedCount || 0;
        const targetShuttleId = session.shuttleId || session.shuttleModelId;
        if (targetShuttleId && usedBalls > 0) {
          nextShuttleInventory = prev.shuttleInventory.map(s => {
            if (s.id === targetShuttleId) {
              // 練習会削除時: その練習会で実際に消費した原価(session.shuttleCostPerBall)で在庫総原価を復元
              const unitCost = session.shuttleCostPerBall || getShuttleCostPerBall(s);
              const restoredCost = Math.round(usedBalls * unitCost);
              return adjustShuttleStockByBalls(s, usedBalls, restoredCost);
            }
            return s;
          });
        }
      }

      // Remove participationLogs from all members
      const updatedMembers = prev.members.map(m => ({
        ...m,
        participationLogs: m.participationLogs?.filter(log => log.sessionId !== sessionId)
      }));

      const filteredTransactions = prev.transactions.filter(tx => 
        tx.sessionId !== sessionId && 
        !tx.id.startsWith(`tx-attend-income-${sessionId}`)
      );
      console.log(`削除対象SessionID: ${sessionId}`);
      console.log(`削除前Transaction数: ${prev.transactions.length}`);
      console.log(`削除後Transaction数: ${filteredTransactions.length}`);

      return {
        ...prev,
        practiceSessions: prev.practiceSessions.filter(s => s.id !== sessionId),
        transactions: filteredTransactions,
        shuttleInventory: nextShuttleInventory,
        members: updatedMembers,
      };
    });
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    handleSaveTransaction(updatedTx, updatedTx.id);
  };

  const handleDeleteReimbursement = (reimbId: string) => {
    setState((prev) => {
      const targetReimb = (prev.reimbursements || []).find(r => r.id === reimbId);
      if (!targetReimb) return prev;

      // 【ケースA】「返済せず削除」された履歴を削除して元の未精算立替を復元
      if (targetReimb.status === 'dismissed_without_payout') {
        let nextTransactions = [...prev.transactions];
        const restoredTx = targetReimb.originalTransaction;

        if (restoredTx) {
          // 二重復元防止: 既に同一IDの取引が存在するか確認
          const existsIndex = nextTransactions.findIndex(t => t.id === restoredTx.id);
          if (existsIndex === -1) {
            const cleanRestored: Transaction = {
              ...restoredTx,
              isReimbursed: false,
            };
            delete (cleanRestored as any).reimbursedAt;
            delete (cleanRestored as any).reimbursementId;
            nextTransactions = [cleanRestored, ...nextTransactions];
          } else {
            // 既に存在する場合は未精算状態に戻す
            nextTransactions[existsIndex] = {
              ...nextTransactions[existsIndex],
              isReimbursed: false,
            };
          }
        }

        const updatedReimbursements = (prev.reimbursements || []).filter(r => r.id !== reimbId);
        return {
          ...prev,
          transactions: nextTransactions,
          reimbursements: updatedReimbursements,
        };
      }

      // 【ケースB】通常の返済精算レコードを取り消す場合（既存仕様を厳格に維持）
      const originalIds = new Set(targetReimb.transactionIds || (targetReimb as any).originalTransactionIds || []);
      const payoutTxId = targetReimb.payoutTransactionId;

      // 1. 精算出金取引 (payoutTransaction) を出納帳から削除
      // 2. 元取引を未精算 (isReimbursed: false) に戻す
      const updatedTransactions = prev.transactions
        .filter(tx => {
          if (payoutTxId && tx.id === payoutTxId) return false;
          // フォールバック: payoutTxId が未記録の過去データ用
          if (
            tx.category === 'reimbursement_payout' &&
            tx.amount === targetReimb.amount &&
            (tx.createdAt === targetReimb.createdAt || (tx.date === targetReimb.date && tx.vendor?.includes(targetReimb.memberName)))
          ) {
            return false;
          }
          return true;
        })
        .map(tx => {
          if (originalIds.has(tx.id) || (tx.reimbursementId && tx.reimbursementId === reimbId)) {
            const copy = {
              ...tx,
              isReimbursed: false,
            };
            delete copy.reimbursedAt;
            delete copy.reimbursementId;
            return copy;
          }
          return tx;
        });

      // 3. 精算履歴を削除
      const updatedReimbursements = (prev.reimbursements || []).filter(r => r.id !== reimbId);

      return {
        ...prev,
        transactions: updatedTransactions,
        reimbursements: updatedReimbursements,
      };
    });
  };

  // ----------------------------------------------------
  // Practice Session Save to Ledger & Attendance Logs
  // ----------------------------------------------------
  const handleSavePracticeSessionToLedger = (
    session: PracticeSessionRecord, 
    selectedMemberIds?: string[], 
    paymentSource?: PaymentSource, 
    payerMemberId?: string
  ) => {
    setState((prev) => {
      const today = session.date || getTodayString();
      const newTransactions: Transaction[] = [];
      const sessionSlotLabel = session.timeSlotLabel || (
        session.timeSlot === 'morning' ? '午前' : 
        session.timeSlot === 'afternoon' ? '午後' : 
        session.timeSlot === 'evening' ? '夜間' : '全日'
      );
      const sessionTitle = `${session.location} (${sessionSlotLabel})`;

      // Get payer name if pocket money
      const payer = prev.members.find(m => m.id === payerMemberId);

      // 1. 施設・コート利用料（会場費）の支出記帳
      if (session.facilityFee > 0) {
        newTransactions.push({
          id: `tx-facility-${session.id}`,
          date: today,
          type: 'expense',
          category: 'court_rental',
          amount: session.facilityFee,
          paymentMethod: session.feePaymentMethod || 'cash',
          vendor: session.location,
          paymentSource: paymentSource || 'club_funds',
          payerMemberId: payerMemberId,
          payerName: payer?.name,
          isReimbursed: paymentSource === 'out_of_pocket' ? false : undefined,
          description: `${sessionTitle} 体育館利用料`,
          recordedBy: prev.settings.treasurerName || '会計係',
          sessionId: session.id,
          receiptNote: paymentSource === 'out_of_pocket' ? `立替者: ${payer?.name}` : undefined,
          createdAt: new Date().toISOString(),
        });
      }

      // 2. 参加費集金（総額）の収入記帳
      const feePerPerson = session.roundedFeePerPerson || session.feePerPerson || 0;
      const totalCollected = session.totalCollectedAmount || (session.totalAttendeesCount * feePerPerson);
      if (totalCollected > 0) {
        newTransactions.push({
          id: `tx-attend-income-${session.id}`,
          date: today,
          type: 'income',
          category: 'event_fee',
          amount: totalCollected,
          paymentMethod: 'cash',
          description: `練習会 参加費集金 (${session.totalAttendeesCount}名 × ¥${feePerPerson})`,
          recordedBy: prev.settings.treasurerName || '会計係',
          sessionId: session.id,
          createdAt: new Date().toISOString(),
        });
      }

      // 3. 参加部員の participationLogs を自動更新
      const updatedMembers = prev.members.map(member => {
        const isAttended = selectedMemberIds && selectedMemberIds.includes(member.id);
        if (isAttended) {
          const newLog = {
            sessionId: session.id,
            eventName: sessionTitle,
            date: today,
            feePaid: feePerPerson,
          };
          return {
            ...member,
            participationLogs: [newLog, ...(member.participationLogs || [])],
          };
        }
        return member;
      });

      // 4. シャトル在庫の自動減算（本数/球数単位で正確に減算、加重平均原価で在庫総額を減算）
      const usedBalls = session.shuttlesUsedCount || session.shuttleUsedCount || 0;
      const targetShuttleId = session.shuttleId || session.shuttleModelId;
      const updatedShuttles = prev.shuttleInventory.map(s => {
        if (targetShuttleId && s.id === targetShuttleId && usedBalls > 0) {
          // その練習会で記録された単価、または直前の在庫加重平均原価で消費
          const costPerBall = session.shuttleCostPerBall || getShuttleCostPerBall(s);
          const consumedCost = Math.round(usedBalls * costPerBall);
          return adjustShuttleStockByBalls(s, -usedBalls, -consumedCost);
        }
        return s;
      });

      return {
        ...prev,
        practiceSessions: [session, ...prev.practiceSessions],
        transactions: [...newTransactions, ...prev.transactions],
        members: updatedMembers,
        shuttleInventory: updatedShuttles,
      };
    });
  };

  // ----------------------------------------------------
  // Shuttle Handlers
  // ----------------------------------------------------
  const handleUpdateShuttle = (updatedShuttle: ShuttleStock) => {
    setState((prev) => ({
      ...prev,
      shuttleInventory: prev.shuttleInventory.map((s) => {
        if (s.id === updatedShuttle.id) {
          // totalCostInStock が未設定なら既存原価を維持/補完
          const totalCost = updatedShuttle.totalCostInStock !== undefined
            ? updatedShuttle.totalCostInStock
            : getShuttleTotalOriginalCost(updatedShuttle);
          return {
            ...updatedShuttle,
            totalCostInStock: totalCost,
          };
        }
        return s;
      }),
    }));
  };

  const handleAddShuttle = (newShuttleData: Omit<ShuttleStock, 'id'>) => {
    const totalBalls = combineTubesAndLoose(
      newShuttleData.tubesInStock, 
      newShuttleData.looseBallsInStock || 0, 
      newShuttleData.ballsPerTube || 12
    );
    const bpt = newShuttleData.ballsPerTube || 12;
    const initialTotalCost = newShuttleData.totalCostInStock !== undefined 
      ? newShuttleData.totalCostInStock 
      : Math.round(totalBalls * (bpt > 0 ? newShuttleData.pricePerTube / bpt : 0));

    const initialHistory = (newShuttleData.tubesInStock > 0 || (newShuttleData.looseBallsInStock || 0) > 0) ? [{
      id: `lot-${Date.now()}`,
      date: getTodayString(),
      tubes: newShuttleData.tubesInStock,
      loose: newShuttleData.looseBallsInStock || 0,
      totalBalls,
      pricePerTube: newShuttleData.pricePerTube,
      totalCost: initialTotalCost,
      createdAt: new Date().toISOString(),
    }] : [];

    const newShuttle: ShuttleStock = {
      ...newShuttleData,
      id: `sh-${Date.now()}`,
      totalCostInStock: initialTotalCost,
      purchaseHistory: newShuttleData.purchaseHistory || initialHistory,
    };
    setState((prev) => ({
      ...prev,
      shuttleInventory: [...prev.shuttleInventory, newShuttle],
    }));
  };

  const handleDeleteShuttle = (id: string) => {
    setState((prev) => ({
      ...prev,
      shuttleInventory: prev.shuttleInventory.filter((s) => s.id !== id),
    }));
  };

  const handleRestockShuttleWithLedger = (
    shuttleId: string,
    tubesToAdd: number,
    pricePerTube: number,
    recordToLedger: boolean,
    paymentSource: 'club_funds' | 'out_of_pocket' = 'club_funds',
    payerMemberId?: string,
    looseToAdd: number = 0
  ) => {
    setState((prev) => {
      const shuttle = prev.shuttleInventory.find(s => s.id === shuttleId);
      if (!shuttle) return prev;

      const ballsPerTube = shuttle.ballsPerTube || 12;
      const totalBallsToAdd = tubesToAdd * ballsPerTube + looseToAdd;
      
      const updatedInventory = prev.shuttleInventory.map((s) => {
        if (s.id === shuttleId) {
          // 【在庫加重平均方式】：既存在庫の原価を上書きせず、新仕入れ分を総原価・本数に加算
          return restockShuttle(s, tubesToAdd, pricePerTube, looseToAdd, getTodayString());
        }
        return s;
      });

      let updatedTransactions = [...prev.transactions];
      if (recordToLedger && totalBallsToAdd > 0) {
        // 購入総額 = ダース数分 + 端数球数分
        const costPerBall = pricePerTube / ballsPerTube;
        const totalCost = Math.round(totalBallsToAdd * costPerBall);
        const payer = prev.members.find(m => m.id === payerMemberId);

        const qtyDesc = looseToAdd > 0
          ? `${tubesToAdd > 0 ? `${tubesToAdd}ダース + ` : ''}${looseToAdd}本(計${totalBallsToAdd}球)`
          : `${tubesToAdd}ダース(${totalBallsToAdd}球)`;

        const newTx: Transaction = {
          id: `tx-shuttle-${Date.now()}`,
          date: getTodayString(),
          type: 'expense',
          category: 'shuttle',
          amount: totalCost,
          paymentMethod: 'bank_transfer',
          vendor: 'シャトル販売店',
          paymentSource,
          payerMemberId: paymentSource === 'out_of_pocket' ? payerMemberId : undefined,
          payerName: paymentSource === 'out_of_pocket' ? payer?.name : undefined,
          isReimbursed: false,
          description: `${shuttle.modelName} ${qtyDesc} 購入補充`,
          recordedBy: prev.settings.treasurerName || 'シャトル係',
          createdAt: new Date().toISOString(),
        };
        updatedTransactions = [newTx, ...updatedTransactions];
      }

      return {
        ...prev,
        shuttleInventory: updatedInventory,
        transactions: updatedTransactions,
      };
    });
  };

  // ----------------------------------------------------
  // Budget Plan Update
  // ----------------------------------------------------
  const handleUpdateBudgetPlan = (fiscalYear: number, plan: AnnualBudgetPlan) => {
    setState((prev) => ({
      ...prev,
      budgetPlans: {
        ...prev.budgetPlans,
        [fiscalYear]: plan,
      },
    }));
  };

  // ----------------------------------------------------
  // Settings Update
  // ----------------------------------------------------
  const handleSaveSettings = (newSettings: ClubSettings) => {
    setState((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  };

  const currentTheme = state.settings.theme || 'default';

  return (
    <AuthGate state={state} setState={setState}>
      <div className={`min-h-screen theme-${currentTheme} ${currentTheme === 'clean_light' ? 'theme-clean-light' : ''} bg-bg text-text flex flex-col font-sans selection:bg-accent selection:text-accent-text`} data-theme={currentTheme}>
      
      {/* Top App Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        settings={state.settings}
        currentBalance={currentBalance}
        unreimbursedDebtAmount={unreimbursedDebtAmount}
        inactiveMembersCount={inactiveMembersCount}
        lowStockShuttleCount={lowStockShuttleCount}
        onOpenNewTransaction={() => {
          setEditingTransaction(null);
          setIsTransactionModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenReport={() => setIsReportModalOpen(true)}
      />

      {/* Main View Router */}
      <main 
        className="flex-1 pb-12"
        onTouchStart={(e) => {
          // If any modal is active (root modals or view-level modal overlays), ignore swipe
          const isModalActive = 
            isTransactionModalOpen || 
            isMemberModalOpen || 
            isSettingsModalOpen || 
            isReportModalOpen || 
            (typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0')));

          if (isModalActive) {
            (e.currentTarget as any)._swipeIgnored = true;
            (e.currentTarget as any)._touchStartX = undefined;
            (e.currentTarget as any)._touchStartY = undefined;
            return;
          }

          // If touch started on or inside an input/form/interactive element or modal container, ignore swipe
          const target = e.target as HTMLElement | null;
          const isInteractive = target?.closest(
            'input, textarea, select, button, [contenteditable="true"], [role="button"], [role="dialog"], [role="combobox"], [data-no-swipe], label, .fixed.inset-0'
          );

          if (isInteractive) {
            (e.currentTarget as any)._swipeIgnored = true;
            (e.currentTarget as any)._touchStartX = undefined;
            (e.currentTarget as any)._touchStartY = undefined;
            return;
          }

          (e.currentTarget as any)._swipeIgnored = false;
          const touch = e.touches[0];
          (e.currentTarget as any)._touchStartX = touch.clientX;
          (e.currentTarget as any)._touchStartY = touch.clientY;
        }}
        onTouchEnd={(e) => {
          // Check if swipe was marked as ignored or if any modal is active
          const isModalActive = 
            isTransactionModalOpen || 
            isMemberModalOpen || 
            isSettingsModalOpen || 
            isReportModalOpen || 
            (typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"], [aria-modal="true"], .fixed.inset-0')));

          if ((e.currentTarget as any)._swipeIgnored || isModalActive) {
            (e.currentTarget as any)._touchStartX = undefined;
            (e.currentTarget as any)._touchStartY = undefined;
            (e.currentTarget as any)._swipeIgnored = undefined;
            return;
          }

          // Also check the release target element
          const endTarget = e.target as HTMLElement | null;
          if (endTarget?.closest('input, textarea, select, button, [contenteditable="true"], [role="button"], [role="dialog"], [role="combobox"], [data-no-swipe], label, .fixed.inset-0')) {
            (e.currentTarget as any)._touchStartX = undefined;
            (e.currentTarget as any)._touchStartY = undefined;
            (e.currentTarget as any)._swipeIgnored = undefined;
            return;
          }

          const touchStartX = (e.currentTarget as any)._touchStartX;
          const touchStartY = (e.currentTarget as any)._touchStartY;
          if (touchStartX === undefined || touchStartY === undefined) {
            (e.currentTarget as any)._swipeIgnored = undefined;
            return;
          }

          const touch = e.changedTouches[0];
          const diffX = touch.clientX - touchStartX;
          const diffY = touch.clientY - touchStartY;

          // Threshold: horizontal movement >= 50px and |diffX| > |diffY|
          if (Math.abs(diffX) >= 50 && Math.abs(diffX) > Math.abs(diffY)) {
            const tabs: NavTab[] = ['dashboard', 'doubles', 'calculator', 'shuttles', 'reimbursements', 'ledger', 'members', 'budget'];
            const currentIndex = tabs.indexOf(currentTab);
            if (currentIndex !== -1) {
              if (diffX < 0) {
                // Swipe Left -> Next Tab
                if (currentIndex < tabs.length - 1) {
                  handleSelectTab(tabs[currentIndex + 1]);
                }
              } else {
                // Swipe Right -> Previous Tab
                if (currentIndex > 0) {
                  handleSelectTab(tabs[currentIndex - 1]);
                }
              }
            }
          }
          (e.currentTarget as any)._touchStartX = undefined;
          (e.currentTarget as any)._touchStartY = undefined;
          (e.currentTarget as any)._swipeIgnored = undefined;
        }}
        onTouchCancel={(e) => {
          (e.currentTarget as any)._touchStartX = undefined;
          (e.currentTarget as any)._touchStartY = undefined;
          (e.currentTarget as any)._swipeIgnored = undefined;
        }}
      >
        {currentTab === 'dashboard' && (
          <DashboardView
            state={state}
            onNavigateTab={handleSelectTab}
            onOpenNewTransaction={() => {
              setEditingTransaction(null);
              setIsTransactionModalOpen(true);
            }}
            onOpenNewSession={() => handleSelectTab('calculator')}
          />
        )}

        {currentTab === 'calculator' && (
          <PracticeCalculatorView
            shuttles={state.shuttleInventory}
            members={state.members}
            pastSessions={state.practiceSessions}
            transactions={state.transactions}
            initialCarriedOverAttendeeIds={carriedOverAttendeeIds}
            initialSessionDate={carriedOverSessionDate}
            onClearCarriedOver={() => {
              setCarriedOverAttendeeIds(null);
              setCarriedOverSessionDate(null);
            }}
            onNavigateToDoubles={() => handleSelectTab('doubles')}
            onSaveSessionToLedger={handleSavePracticeSessionToLedger}
            onUpdateSession={handleUpdatePracticeSession}
            onDeleteSession={handleDeletePracticeSession}
          />
        )}

        {currentTab === 'doubles' && (
          <DoublesMatchView
            members={state.members}
            onSaveMember={handleSaveMember}
            onProceedToPracticeSession={handleProceedFromDoublesToSession}
            onNavigateTab={handleSelectTab}
          />
        )}

        {currentTab === 'reimbursements' && (
          <ReimbursementsView
            transactions={state.transactions}
            reimbursements={state.reimbursements || []}
            members={state.members}
            onExecuteReimbursement={handleExecuteReimbursement}
            onDeleteReimbursement={handleDeleteReimbursement}
            onDismissTransaction={handleDismissUnreimbursedTransaction}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}

        {currentTab === 'ledger' && (
          <LedgerView
            transactions={state.transactions}
            onOpenTransactionModal={() => {
              setEditingTransaction(null);
              setIsTransactionModalOpen(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setIsTransactionModalOpen(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenReport={() => setIsReportModalOpen(true)}
          />
        )}

        {currentTab === 'members' && (
          <MembersAttendanceView
            members={state.members}
            practiceSessions={state.practiceSessions}
            onAddMember={() => {
              setEditingMember(null);
              setIsMemberModalOpen(true);
            }}
            onEditMember={(member) => {
              setEditingMember(member);
              setIsMemberModalOpen(true);
            }}
            onDeleteMember={handleDeleteMember}
            onUpdateParticipation={handleUpdateParticipation}
            onDeleteParticipation={handleDeleteParticipation}
          />
        )}

        {currentTab === 'shuttles' && (
          <ShuttleManagerView
            inventory={state.shuttleInventory}
            settings={state.settings}
            members={state.members}
            onUpdateShuttle={handleUpdateShuttle}
            onAddShuttle={handleAddShuttle}
            onDeleteShuttle={handleDeleteShuttle}
            onRestock={handleRestockShuttleWithLedger}
            onUpdateValuationRate={(rate) => {
              handleSaveSettings({ ...state.settings, shuttleValuationRate: rate });
            }}
          />
        )}

        {currentTab === 'budget' && (
          <BudgetPlanView
            budgetPlans={state.budgetPlans}
            transactions={state.transactions}
            settings={state.settings}
            onUpdateBudgetPlan={handleUpdateBudgetPlan}
          />
        )}
      </main>

      {/* Modals */}
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSave={handleSaveTransaction}
        initialTransaction={editingTransaction}
        treasurerName={state.settings.treasurerName}
        members={state.members}
      />

      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onSave={handleSaveMember}
        initialMember={editingMember}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={state.settings}
        onSaveSettings={handleSaveSettings}
        onResetSampleData={() => {
          const reset = resetAppState();
          setState(reset);
        }}
      />

      <PrintReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        state={state}
      />

    </div>
    </AuthGate>
  );
}
