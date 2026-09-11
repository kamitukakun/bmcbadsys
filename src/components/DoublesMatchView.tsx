import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Swords,
  Users,
  UserPlus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Coffee,
  Shuffle,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Calendar,
  Layers,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Info,
  LogOut,
  UserCheck,
  ArrowLeftRight,
  Hash,
  Filter,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import { Member, DoublesPlayer, DoublesMatch, DoublesRound, Gender, MemberRole } from '../types';
import {
  generateDoublesRound,
  generateStreamMatchForCourt,
  optimizeSingleCourtMatch,
  MatcherOptions
} from '../utils/doublesMatcher';
import { getTodayString } from '../utils/dateUtils';
import { formatDate } from '../utils/formatters';

interface DoublesMatchViewProps {
  members: Member[];
  onSaveMember: (memberData: Omit<Member, 'id'>, id?: string) => string;
  onProceedToPracticeSession: (selectedMemberIds: string[], sessionDate: string) => void;
  onNavigateTab: (tab: any) => void;
}

// 交代選択中のプレイヤー情報
interface SelectedSwapInfo {
  source: 'court' | 'resting';
  matchId?: string;
  team?: 'A' | 'B';
  index?: number;
  player: DoublesPlayer;
}

const STORAGE_KEY = 'badminton_doubles_session_state_v2';

export const DoublesMatchView: React.FC<DoublesMatchViewProps> = ({
  members,
  onSaveMember,
  onProceedToPracticeSession,
  onNavigateTab,
}) => {
  const today = getTodayString();

  // ----------------------------------------------------
  // セッション状態 (localStorage から復元または初期化)
  // ----------------------------------------------------
  const [sessionDate, setSessionDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sessionDate) return parsed.sessionDate;
      }
    } catch (e) { }
    return today;
  });

  // 画面ステップ: 'select_players' (試合準備・プレイヤー選択) | 'match_running' (試合進行・組合せ)
  const [currentStep, setCurrentStep] = useState<'select_players' | 'match_running'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentStep) return parsed.currentStep;
      }
    } catch (e) { }
    return 'select_players';
  });

  // プレイヤー選択サブタブ: 'members' (クラブ台帳)
  const [playerTab, setPlayerTab] = useState<'members'>('members');

  // コート面数 (1〜6面)
  const [courtCount, setCourtCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.courtCount === 'number') return parsed.courtCount;
      }
    } catch (e) { }
    return 2;
  });

  // 組合せ作成方式: 'batch' (一括) | 'stream' (流し込み)
  const [creationMethod, setCreationMethod] = useState<'batch' | 'stream'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.creationMethod) return parsed.creationMethod;
      }
    } catch (e) { }
    return 'batch';
  });

  // 組合せ生成モード
  const [matcherMode, setMatcherMode] = useState<'fair' | 'mix_priority'>('fair');

  // プレイヤー管理ステート (既存名簿リストから初期化・同期)
  const [players, setPlayers] = useState<DoublesPlayer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.players) && parsed.players.length > 0) {
          const validMemberIds = new Set(
            members.filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive').map(m => m.id)
          );
          const filtered = parsed.players.filter((p: DoublesPlayer) => validMemberIds.has(p.memberId));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch (e) { }
    return members
      .filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive')
      .map(m => ({
        playerId: `p-${m.id}`,
        memberId: m.id,
        name: m.name,
        gender: m.gender || 'unspecified',
        memberType: m.role === 'visitor' ? 'visitor' : 'member',
        role: m.role,
        status: 'joined',
        isResting: false,
        matchCount: 0,
        restCount: 0,
        historyPairIds: [],
        historyOpponentIds: [],
      }));
  });

  // 選択中の名簿ID（プレイヤー選択画面用）
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.selectedMemberIds)) {
          const validMemberIds = new Set(
            members.filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive').map(m => m.id)
          );
          return parsed.selectedMemberIds.filter((id: string) => validMemberIds.has(id));
        }
      }
    } catch (e) { }
    const active = members.filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive');
    return active.slice(0, 12).map(m => m.id);
  });

  // 試合・ラウンド管理ステート
  const [rounds, setRounds] = useState<DoublesRound[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.rounds)) return parsed.rounds;
      }
    } catch (e) { }
    return [];
  });

  const [currentRoundNumber, setCurrentRoundNumber] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.currentRoundNumber === 'number') return parsed.currentRoundNumber;
      }
    } catch (e) { }
    return 0;
  });

  const [currentMatches, setCurrentMatches] = useState<DoublesMatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.currentMatches)) return parsed.currentMatches;
      }
    } catch (e) { }
    return [];
  });

  const [currentResting, setCurrentResting] = useState<DoublesPlayer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.currentResting)) {
          const validMemberIds = new Set(
            members.filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive').map(m => m.id)
          );
          return parsed.currentResting.filter((p: DoublesPlayer) => validMemberIds.has(p.memberId));
        }
      }
    } catch (e) { }
    return [];
  });

  // ----------------------------------------------------
  // 名簿交代（スワップ）用ステート
  // ----------------------------------------------------
  const [selectedSwapPlayer, setSelectedSwapPlayer] = useState<SelectedSwapInfo | null>(null);
  const [showSwapModalForPlayer, setShowSwapModalForPlayer] = useState<SelectedSwapInfo | null>(null);

  // ----------------------------------------------------
  // モーダル管理ステート (標準 confirm() は全廃)
  // ----------------------------------------------------
  const [showAddVisitorModal, setShowAddVisitorModal] = useState<boolean>(false);
  const [showLateJoinModal, setShowLateJoinModal] = useState<boolean>(false);
  const [showConfirmToSessionModal, setShowConfirmToSessionModal] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ビジター追加フォーム
  const [visitorName, setVisitorName] = useState<string>('');
  const [visitorGender, setVisitorGender] = useState<Gender>('male');
  const [visitorKana, setVisitorKana] = useState<string>('');
  const [visitorNotes, setVisitorNotes] = useState<string>('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // 番号プレイヤー追加用ステート (1〜16)
  const [numberSelection, setNumberSelection] = useState<Record<number, boolean>>({
    1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true, 8: true
  });
  const [numberGender, setNumberGender] = useState<Record<number, Gender>>({
    1: 'male', 2: 'male', 3: 'male', 4: 'male',
    5: 'female', 6: 'female', 7: 'female', 8: 'female'
  });

  // 検索・絞り込みフィルター
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [filterRole, setFilterRole] = useState<'all' | 'member' | 'visitor'>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ----------------------------------------------------
  // 状態の自動永続化 (localStorage)
  // ----------------------------------------------------
  useEffect(() => {
    try {
      const stateToSave = {
        sessionDate,
        currentStep,
        courtCount,
        creationMethod,
        matcherMode,
        players,
        selectedMemberIds,
        rounds,
        currentRoundNumber,
        currentMatches,
        currentResting,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (err) {
      console.error('Failed to save doubles session to localStorage', err);
    }
  }, [
    sessionDate,
    currentStep,
    courtCount,
    creationMethod,
    matcherMode,
    players,
    selectedMemberIds,
    rounds,
    currentRoundNumber,
    currentMatches,
    currentResting,
  ]);

  // 名簿追加・更新・削除時に同期
  useEffect(() => {
    const validMembers = members.filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive');
    const validMemberIdSet = new Set(validMembers.map(m => m.id));

    // 削除された名簿を selectedMemberIds から除外
    setSelectedMemberIds(prev => prev.filter(id => validMemberIdSet.has(id)));

    setPlayers(prev => {
      const existingMap = new Map<string, DoublesPlayer>(prev.map(p => [p.memberId, p]));
      const updatedList: DoublesPlayer[] = [];

      validMembers.forEach(m => {
        const existing = existingMap.get(m.id);
        if (existing !== undefined) {
          updatedList.push({
            ...existing,
            name: m.name,
            gender: m.gender || 'unspecified',
            memberType: m.role === 'visitor' ? 'visitor' : 'member',
            role: m.role,
          });
        } else {
          updatedList.push({
            playerId: `p-${m.id}`,
            memberId: m.id,
            name: m.name,
            gender: m.gender || 'unspecified',
            memberType: m.role === 'visitor' ? 'visitor' : 'member',
            role: m.role,
            status: 'joined',
            isResting: false,
            matchCount: 0,
            restCount: 0,
            historyPairIds: [],
            historyOpponentIds: [],
          });
        }
      });

      const updatedMap = new Map(updatedList.map(u => [u.memberId, u]));

      // 休憩中（ベンチ）から削除された名簿を除外し、最新情報を反映
      setCurrentResting(prevResting =>
        prevResting
          .filter(p => validMemberIdSet.has(p.memberId))
          .map(p => {
            const updated = updatedMap.get(p.memberId);
            return updated ? { ...p, name: updated.name, gender: updated.gender, role: updated.role, memberType: updated.memberType } : p;
          })
      );

      // 進行中の試合の選手情報も最新化
      setCurrentMatches(prevMatches =>
        prevMatches.map(m => ({
          ...m,
          teamA: m.teamA.map(p => {
            const updated = updatedMap.get(p.memberId);
            return updated ? { ...p, name: updated.name, gender: updated.gender, role: updated.role, memberType: updated.memberType } : p;
          }) as [DoublesPlayer, DoublesPlayer],
          teamB: m.teamB.map(p => {
            const updated = updatedMap.get(p.memberId);
            return updated ? { ...p, name: updated.name, gender: updated.gender, role: updated.role, memberType: updated.memberType } : p;
          }) as [DoublesPlayer, DoublesPlayer],
        }))
      );

      return updatedList;
    });
  }, [members]);

  // ----------------------------------------------------
  // 重複チェック (名前の既存確認)
  // ----------------------------------------------------
  useEffect(() => {
    if (!visitorName.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const cleanName = visitorName.trim().replace(/\s+/g, '');
    const found = members.find(m =>
      !m.isDeleted && m.name.replace(/\s+/g, '') === cleanName
    );
    if (found) {
      setDuplicateWarning(`同名の${found.role === 'visitor' ? 'ビジター' : '既存名簿'}「${found.name}」様がすでに存在します。`);
    } else {
      setDuplicateWarning(null);
    }
  }, [visitorName, members]);

  // ----------------------------------------------------
  // 新規ビジター名簿の登録
  // ----------------------------------------------------
  const handleCreateVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) return;

    const newMemberId = onSaveMember({
      name: visitorName.trim(),
      kana: visitorKana.trim(),
      gender: visitorGender,
      role: 'visitor',
      joinDate: sessionDate,
      isActive: true,
      notes: visitorNotes.trim() ? `[ビジター登録] ${visitorNotes.trim()}` : '[練習会にてビジター登録]',
    });

    setSelectedMemberIds(prev => [...prev, newMemberId]);
    const registeredName = visitorName.trim();
    setVisitorName('');
    setVisitorKana('');
    setVisitorNotes('');
    setShowAddVisitorModal(false);
    showToast(`「${registeredName}」様をビジターとして登録・選択しました！`);
  };

  // ----------------------------------------------------
  // 番号プレイヤーの一括作成・参加登録 (例: No.1〜No.8)
  // ----------------------------------------------------
  const handleAddNumberPlayers = () => {
    const selectedNums = Object.entries(numberSelection)
      .filter(([_, isSelected]) => isSelected)
      .map(([num]) => Number(num))
      .sort((a, b) => a - b);

    if (selectedNums.length === 0) {
      showToast('番号を1つ以上選択してください');
      return;
    }

    const createdIds: string[] = [];
    selectedNums.forEach(num => {
      const name = `No.${num}`;
      const gender = numberGender[num] || 'male';

      // 既存の同名名簿を探す
      const existing = members.find(m => !m.isDeleted && m.name === name);
      if (existing) {
        createdIds.push(existing.id);
      } else {
        const newId = onSaveMember({
          name,
          kana: `ナンバー${num}`,
          gender,
          role: 'visitor',
          joinDate: sessionDate,
          isActive: true,
          notes: `[番号クイック作成: No.${num}]`,
        });
        createdIds.push(newId);
      }
    });

    setSelectedMemberIds(prev => Array.from(new Set([...prev, ...createdIds])));
    setPlayerTab('members');
    showToast(`番号プレイヤー ${selectedNums.length} 名（${selectedNums.map(n => `No.${n}`).join(', ')}）を参加登録しました！`);
  };

  // ----------------------------------------------------
  // プレイヤー選択のトグル
  // ----------------------------------------------------
  const togglePlayerSelection = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // フィルタリングされた名簿一覧
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (m.isDeleted) return false;
      if (!m.isActive || m.role === 'inactive') return false;
      if (filterGender !== 'all' && m.gender !== filterGender) return false;
      if (filterRole === 'member' && m.role === 'visitor') return false;
      if (filterRole === 'visitor' && m.role !== 'visitor') return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchName = m.name.toLowerCase().includes(kw);
        const matchKana = (m.kana || '').toLowerCase().includes(kw);
        if (!matchName && !matchKana) return false;
      }
      return true;
    }).sort((a, b) => {
      // 1. クラブ内役職順 (代表 > 役員 > 部員 > 学生 > ビジター)
      const roleRank: Record<string, number> = {
        leader: 1,
        officer: 2,
        member: 3,
        student: 4,
        visitor: 5,
        inactive: 6,
      };
      const rankA = roleRank[a.role] ?? 99;
      const rankB = roleRank[b.role] ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      // 2. 練習参加回数が多い順 (降順)
      const countA = a.participationLogs?.length || 0;
      const countB = b.participationLogs?.length || 0;
      if (countA !== countB) {
        return countB - countA;
      }
      // 3. カナ順
      return (a.kana || '').localeCompare(b.kana || '');
    });
  }, [members, filterGender, filterRole, searchKeyword]);

  // 選択中の名簿内訳
  const selectionStats = useMemo(() => {
    const selected = members.filter(m => selectedMemberIds.includes(m.id));
    const maleCount = selected.filter(m => m.gender === 'male').length;
    const femaleCount = selected.filter(m => m.gender === 'female').length;
    const visitorCount = selected.filter(m => m.role === 'visitor').length;
    const memberCount = selected.length - visitorCount;

    return {
      total: selected.length,
      maleCount,
      femaleCount,
      visitorCount,
      memberCount,
    };
  }, [members, selectedMemberIds]);

  // 進行中の試合セッションが存在するか
  const hasActiveSession = currentRoundNumber > 0 && currentMatches.length > 0;

  // プレイヤーID -> 最新プレイヤー情報（matchCountなどの一元参照用）
  const playerMap = useMemo(() => {
    return new Map<string, DoublesPlayer>(players.map(p => [p.playerId, p]));
  }, [players]);

  const activePlayerMemberIds = useMemo(() => {
    return new Set(players.filter(p => p.status === 'joined' || p.status === 'late').map(p => p.memberId));
  }, [players]);

  const hasChanges = useMemo(() => {
    if (!hasActiveSession) return false;
    const currentSelectedSet = new Set(selectedMemberIds);
    if (selectedMemberIds.length !== activePlayerMemberIds.size) return true;
    for (const id of currentSelectedSet) {
      if (!activePlayerMemberIds.has(id)) return true;
    }
    return false;
  }, [hasActiveSession, selectedMemberIds, activePlayerMemberIds]);

  // ----------------------------------------------------
  // 選択中名簿とプレイヤーリストを同期させる関数（未選択者を除外）
  // ----------------------------------------------------
  const syncPlayersWithSelection = (basePlayers: DoublesPlayer[]): DoublesPlayer[] => {
    const selectedSet = new Set(selectedMemberIds);
    let updated = [...basePlayers];

    selectedMemberIds.forEach(mId => {
      const idx = updated.findIndex(p => p.memberId === mId);
      if (idx >= 0) {
        if (updated[idx].status === 'left') {
          updated[idx] = {
            ...updated[idx],
            status: currentRoundNumber > 1 ? 'late' : 'joined',
            isResting: false,
          };
        }
      } else {
        const member = members.find(m => m.id === mId);
        if (member) {
          const newPlayer: DoublesPlayer = {
            playerId: `p-${member.id}`,
            memberId: member.id,
            name: member.name,
            gender: member.gender || 'unspecified',
            memberType: member.role === 'visitor' ? 'visitor' : 'member',
            role: member.role,
            status: currentRoundNumber > 1 ? 'late' : 'joined',
            isResting: false,
            matchCount: 0,
            restCount: 0,
            historyPairIds: [],
            historyOpponentIds: [],
          };
          updated.push(newPlayer);
        }
      }
    });

    // 選択されていないアクティブ名簿は 'left' に設定
    updated = updated.map(p => {
      if ((p.status === 'joined' || p.status === 'late') && !selectedSet.has(p.memberId)) {
        return { ...p, status: 'left' };
      }
      return p;
    });

    return updated;
  };

  // ----------------------------------------------------
  // ★ 名簿編集後の試合再開処理 (安全なコート縮小と状態遷移) ★
  // ----------------------------------------------------
  const handleResumeSession = () => {
    // 1. 選択中の有効名簿数チェック
    const validSelected = selectedMemberIds.filter(id => {
      const m = members.find(mem => mem.id === id);
      return m && !m.isDeleted && m.isActive && m.role !== 'inactive';
    });

    if (validSelected.length < 4) {
      setConfirmDialog({
        isOpen: true,
        title: '人数不足',
        message: 'ダブルスを継続するには最低4名の参加者を選択してください。',
        confirmText: 'OK',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const selectedSet = new Set(validSelected);

    // 2. プレイヤー状態を同期
    let updatedPlayers = syncPlayersWithSelection(players);
    const activePlayers = updatedPlayers.filter(
      p => selectedSet.has(p.memberId) && (p.status === 'joined' || p.status === 'late')
    );
    const activePlayerMap = new Map(activePlayers.map(p => [p.memberId, p]));

    // 稼働可能な最大コート数 (Math.floor(activeCount / 4))
    const maxCourts = Math.floor(activePlayers.length / 4);
    if (maxCourts < 1) {
      setConfirmDialog({
        isOpen: true,
        title: '人数不足',
        message: 'ダブルスには最低4名の参加者が必要です。',
        confirmText: 'OK',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // 必要に応じてコート数を安全に縮小
    const targetCourtCount = Math.min(currentMatches.length, maxCourts);

    // 継続するコートと、縮小により取り下げるコートを分離
    const keptMatches = currentMatches.slice(0, targetCourtCount);
    const discardedMatches = currentMatches.slice(targetCourtCount);

    // 縮小されたコートにいた選手で、依然としてアクティブな選手を回収
    let candidateBenchPlayers: DoublesPlayer[] = [];
    discardedMatches.forEach(m => {
      [...m.teamA, ...m.teamB].forEach(p => {
        const activeP = activePlayerMap.get(p.memberId);
        if (activeP && !candidateBenchPlayers.some(c => c.playerId === activeP.playerId)) {
          candidateBenchPlayers.push(activeP);
        }
      });
    });

    // 既存の休憩中リストのうちアクティブな選手を追加
    currentResting.forEach(p => {
      const activeP = activePlayerMap.get(p.memberId);
      if (activeP && !candidateBenchPlayers.some(c => c.playerId === activeP.playerId)) {
        candidateBenchPlayers.push(activeP);
      }
    });

    // 新規参加者等でまだ候補に入っていないアクティブ選手を追加
    activePlayers.forEach(p => {
      const inKeptMatch = keptMatches.some(m =>
        m.teamA.some(tm => tm.memberId === p.memberId) ||
        m.teamB.some(tm => tm.memberId === p.memberId)
      );
      if (!inKeptMatch && !candidateBenchPlayers.some(c => c.playerId === p.playerId)) {
        candidateBenchPlayers.push(p);
      }
    });

    // 継続するコートで、解除された選手（非アクティブ選手）を candidateBenchPlayers から補充
    let updatedMatches = keptMatches.map(match => {
      let teamA = [...match.teamA] as [DoublesPlayer, DoublesPlayer];
      let teamB = [...match.teamB] as [DoublesPlayer, DoublesPlayer];

      for (let i = 0; i < 2; i++) {
        if (!selectedSet.has(teamA[i].memberId)) {
          if (candidateBenchPlayers.length > 0) {
            teamA[i] = candidateBenchPlayers.shift()!;
          }
        } else {
          const fresh = activePlayerMap.get(teamA[i].memberId);
          if (fresh) teamA[i] = fresh;
        }

        if (!selectedSet.has(teamB[i].memberId)) {
          if (candidateBenchPlayers.length > 0) {
            teamB[i] = candidateBenchPlayers.shift()!;
          }
        } else {
          const fresh = activePlayerMap.get(teamB[i].memberId);
          if (fresh) teamB[i] = fresh;
        }
      }
      return { ...match, teamA, teamB };
    });

    // 最終的にコートに出ているプレイヤーIDの集合
    const finalCourtMemberIds = new Set<string>();
    updatedMatches.forEach(m => {
      m.teamA.forEach(p => finalCourtMemberIds.add(p.memberId));
      m.teamB.forEach(p => finalCourtMemberIds.add(p.memberId));
    });

    // 休憩中（ベンチ）は、アクティブかつコートに出ていない全選手
    const updatedResting = activePlayers.filter(p => !finalCourtMemberIds.has(p.memberId));

    // コート設定も調整
    if (courtCount > maxCourts) {
      setCourtCount(maxCourts);
    }

    setPlayers(updatedPlayers);
    setCurrentMatches(updatedMatches);
    setCurrentResting(updatedResting);
    setCurrentStep('match_running');
    setSelectedSwapPlayer(null);
    showToast(`第${currentRoundNumber}試合を再開しました（コート数: ${updatedMatches.length}面）`);
  };

  // ----------------------------------------------------
  // 試合開始（第1試合の組合せ新規生成）
  // ----------------------------------------------------
  const handleStartSession = () => {
    if (selectedMemberIds.length < 4) {
      setConfirmDialog({
        isOpen: true,
        title: '人数不足',
        message: 'ダブルスの試合を行うには最低4名の参加者を選択してください。',
        confirmText: 'OK',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const syncedPlayers = syncPlayersWithSelection(players);
    const initialSessionPlayers: DoublesPlayer[] = syncedPlayers
      .filter(p => selectedMemberIds.includes(p.memberId))
      .map(p => ({
        ...p,
        status: 'joined',
        isResting: false,
        matchCount: 0,
        restCount: 0,
        historyPairIds: [],
        historyOpponentIds: [],
      }));

    try {
      const round1 = generateDoublesRound(1, initialSessionPlayers, {
        courtCount,
        mode: matcherMode,
      });

      setPlayers(round1.updatedPlayers);
      setCurrentRoundNumber(1);
      setCurrentMatches(round1.matches);
      setCurrentResting(round1.restingPlayers);
      setRounds([
        {
          roundNumber: 1,
          matches: round1.matches,
          restingPlayers: round1.restingPlayers,
          createdAt: new Date().toISOString(),
        },
      ]);
      setCurrentStep('match_running');
      setSelectedSwapPlayer(null);
      showToast('第1試合の組合せを均等に生成しました！');
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: '生成エラー',
        message: err.message || '組合せの生成に失敗しました。',
        confirmText: '閉じる',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
    }
  };

  // ----------------------------------------------------
  // 次の試合を生成 (第2試合、第3試合…)
  // ----------------------------------------------------
  const handleGenerateNextRound = () => {
    const nextRoundNumber = currentRoundNumber + 1;
    try {
      const syncedPlayers = syncPlayersWithSelection(players);
      const activeCandidates = syncedPlayers.filter(
        p => (p.status === 'joined' || p.status === 'late') && !p.isResting
      );

      if (activeCandidates.length < 4) {
        setConfirmDialog({
          isOpen: true,
          title: '人数不足',
          message: '次試合を生成するには最低4名のアクティブな参加者が必要です。プレイヤー管理から参加者を追加してください。',
          confirmText: '閉じる',
          onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
        });
        return;
      }

      // 稼働可能なコート数を上限として安全に生成
      const effectiveCourts = Math.max(1, Math.min(courtCount, Math.floor(activeCandidates.length / 4)));

      const nextRound = generateDoublesRound(nextRoundNumber, syncedPlayers, {
        courtCount: effectiveCourts,
        mode: matcherMode,
      });

      setPlayers(nextRound.updatedPlayers);
      setCurrentRoundNumber(nextRoundNumber);
      setCurrentMatches(nextRound.matches);
      setCurrentResting(nextRound.restingPlayers);
      setRounds(prev => [
        ...prev,
        {
          roundNumber: nextRoundNumber,
          matches: nextRound.matches,
          restingPlayers: nextRound.restingPlayers,
          createdAt: new Date().toISOString(),
        },
      ]);
      setSelectedSwapPlayer(null);
      showToast(`第${nextRoundNumber}試合の組合せを生成しました！`);
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: '生成エラー',
        message: err.message || '次試合の生成に失敗しました。',
        confirmText: '閉じる',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
    }
  };

  // ----------------------------------------------------
  // 流し込み方式: 終了した特定コートに新しい対戦を割り当て
  // ----------------------------------------------------
  const handleStreamNextMatchForCourt = (courtNumber: number) => {
    try {
      const syncedPlayers = syncPlayersWithSelection(players);
      const playingPlayerIds = new Set<string>();
      currentMatches
        .filter(m => m.courtNumber !== courtNumber && !m.isCompleted)
        .forEach(m => {
          m.teamA.forEach(p => playingPlayerIds.add(p.playerId));
          m.teamB.forEach(p => playingPlayerIds.add(p.playerId));
        });

      const availableCandidates = syncedPlayers.filter(
        p => !playingPlayerIds.has(p.playerId) && (p.status === 'joined' || p.status === 'late') && !p.isResting
      );

      if (availableCandidates.length < 4) {
        setConfirmDialog({
          isOpen: true,
          title: '流し込み人数不足',
          message: '流し込みを行うには、現在他コートに出ていないアクティブプレイヤーが4名以上必要です。',
          confirmText: 'OK',
          onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
        });
        return;
      }

      const { nextMatch, updatedPlayers } = generateStreamMatchForCourt(
        courtNumber,
        currentRoundNumber,
        syncedPlayers,
        currentMatches,
        matcherMode
      );

      // コートを更新
      setCurrentMatches(prev => prev.map(m => m.courtNumber === courtNumber ? nextMatch : m));
      setPlayers(updatedPlayers);

      // 休憩中リストを再計算（現在いずれのコートでもプレイしていない人）
      const activeCourtPlayingIds = new Set<string>();
      currentMatches
        .filter(m => m.courtNumber !== courtNumber && !m.isCompleted)
        .concat(nextMatch)
        .forEach(m => {
          m.teamA.forEach(p => activeCourtPlayingIds.add(p.playerId));
          m.teamB.forEach(p => activeCourtPlayingIds.add(p.playerId));
        });

      setCurrentResting(
        updatedPlayers.filter(
          p => !activeCourtPlayingIds.has(p.playerId) && (p.status === 'joined' || p.status === 'late')
        )
      );

      setSelectedSwapPlayer(null);
      showToast(`第${courtNumber}コートに新しい試合を流し込みました！`);
    } catch (err: any) {
      setConfirmDialog({
        isOpen: true,
        title: '流し込みエラー',
        message: err.message || '流し込みに必要な休憩中プレイヤーが足りません。',
        confirmText: 'OK',
        onConfirm: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      });
    }
  };

  // ----------------------------------------------------
  // 試合中でのコート数動的変更 ([ - ] / [ + ])
  // ----------------------------------------------------
  const handleModifyCourtCountDuringMatch = (newCount: number) => {
    if (newCount < 1 || newCount > 6) return;
    if (newCount === courtCount) return;

    if (newCount > courtCount) {
      // コートを増やす
      // 休憩中の選手が4名以上いるか確認
      const availableResting = currentResting.filter(
        p => (p.status === 'joined' || p.status === 'late') && !p.isResting
      );
      if (availableResting.length < 4) {
        showToast(`コートを増やすには休憩中プレイヤーが4名以上必要です（現在: ${availableResting.length}名）`);
        return;
      }

      try {
        const sorted = [...availableResting].sort((a, b) => a.matchCount - b.matchCount);
        const four = sorted.slice(0, 4);
        const newMatch = optimizeSingleCourtMatch(newCount, currentRoundNumber, four, matcherMode);

        // matchCount 加算
        const fourIds = new Set(four.map(p => p.playerId));
        const nextPlayers = players.map(p => {
          if (fourIds.has(p.playerId)) {
            return { ...p, matchCount: p.matchCount + 1 };
          }
          return p;
        });

        setCourtCount(newCount);
        setPlayers(nextPlayers);
        setCurrentMatches(prev => [...prev, newMatch]);
        setCurrentResting(prev => prev.filter(p => !fourIds.has(p.playerId)));
        showToast(`第${newCount}コートを追加しました！`);
      } catch (err: any) {
        showToast(err.message || 'コートの追加に失敗しました');
      }
    } else {
      // コートを減らす (末尾のコートを閉じる)
      const lastMatch = currentMatches.find(m => m.courtNumber === courtCount);
      if (lastMatch) {
        const releasedPlayers = [...lastMatch.teamA, ...lastMatch.teamB];
        const releasedIds = new Set(releasedPlayers.map(p => p.playerId));

        const nextPlayers = players.map(p => {
          if (releasedIds.has(p.playerId)) {
            return { ...p, matchCount: Math.max(0, p.matchCount - 1) };
          }
          return p;
        });

        setCourtCount(newCount);
        setPlayers(nextPlayers);
        setCurrentMatches(prev => prev.filter(m => m.courtNumber !== courtCount));
        setCurrentResting(prev => [...prev, ...releasedPlayers]);
        showToast(`第${courtCount}コートを閉じ、選手を休憩中に戻しました`);
      } else {
        setCourtCount(newCount);
      }
    }
  };

  // 試合終了・完了解除時の履歴同期ヘルパー
  const applyMatchHistory = (match: DoublesMatch, isCompleting: boolean, currentPlayers: DoublesPlayer[]): DoublesPlayer[] => {
    const [a0, a1] = match.teamA;
    const [b0, b1] = match.teamB;

    const updates: Record<string, { partnerId?: string; opponentIds: string[] }> = {
      [a0.playerId]: { partnerId: a1.memberId, opponentIds: [b0.memberId, b1.memberId] },
      [a1.playerId]: { partnerId: a0.memberId, opponentIds: [b0.memberId, b1.memberId] },
      [b0.playerId]: { partnerId: b1.memberId, opponentIds: [a0.memberId, a1.memberId] },
      [b1.playerId]: { partnerId: b0.memberId, opponentIds: [a0.memberId, a1.memberId] },
    };

    return currentPlayers.map(p => {
      const u = updates[p.playerId];
      if (!u) return p;

      let nextPairs = [...(p.historyPairIds || [])];
      let nextOpponents = [...(p.historyOpponentIds || [])];

      if (isCompleting) {
        // 試合完了: ペアと対戦相手を追加
        if (u.partnerId) nextPairs.push(u.partnerId);
        nextOpponents.push(...u.opponentIds);
      } else {
        // 完了解除: 直近で追加されたペアと対戦相手を取り消し
        if (u.partnerId) {
          const pIdx = nextPairs.lastIndexOf(u.partnerId);
          if (pIdx >= 0) nextPairs.splice(pIdx, 1);
        }
        u.opponentIds.forEach(opId => {
          const oIdx = nextOpponents.lastIndexOf(opId);
          if (oIdx >= 0) nextOpponents.splice(oIdx, 1);
        });
      }

      return {
        ...p,
        historyPairIds: nextPairs,
        historyOpponentIds: nextOpponents,
      };
    });
  };

  // ----------------------------------------------------
  // ★ 名簿交代 (スワップ) ロジック ★
  // 試合生成後もコート間・コートと休憩中の選手を自由に入れ替え可能
  // ----------------------------------------------------
  const executeSwap = (source: SelectedSwapInfo, target: SelectedSwapInfo) => {
    if (source.player.playerId === target.player.playerId) {
      setSelectedSwapPlayer(null);
      return;
    }

    const p1 = playerMap.get(source.player.playerId) || source.player;
    const p2 = playerMap.get(target.player.playerId) || target.player;

    // パターン1: コート上の選手同士の入れ替え
    if (source.source === 'court' && target.source === 'court') {
      setCurrentMatches(prev =>
        prev.map(m => {
          let newTeamA = [...m.teamA] as [DoublesPlayer, DoublesPlayer];
          let newTeamB = [...m.teamB] as [DoublesPlayer, DoublesPlayer];

          if (m.id === source.matchId) {
            if (source.team === 'A') newTeamA[source.index!] = p2;
            if (source.team === 'B') newTeamB[source.index!] = p2;
          }
          if (m.id === target.matchId) {
            if (target.team === 'A') newTeamA[target.index!] = p1;
            if (target.team === 'B') newTeamB[target.index!] = p1;
          }

          return { ...m, teamA: newTeamA, teamB: newTeamB };
        })
      );
      showToast(`「${p1.name}」様 ⇄ 「${p2.name}」様 をコート間で交代しました！`);
    }

    // パターン2: コート上の選手(source) と 休憩中の選手(target) の入れ替え
    else if (source.source === 'court' && target.source === 'resting') {
      const updatedP2: DoublesPlayer = {
        ...p2,
        matchCount: p2.matchCount + 1,
        restCount: Math.max(0, p2.restCount - 1),
      };
      const updatedP1: DoublesPlayer = {
        ...p1,
        matchCount: Math.max(0, p1.matchCount - 1),
        restCount: p1.restCount + 1,
      };

      // コートの該当枠を updatedP2 に置換
      setCurrentMatches(prev =>
        prev.map(m => {
          if (m.id !== source.matchId) return m;
          const newTeamA = [...m.teamA] as [DoublesPlayer, DoublesPlayer];
          const newTeamB = [...m.teamB] as [DoublesPlayer, DoublesPlayer];
          if (source.team === 'A') newTeamA[source.index!] = updatedP2;
          if (source.team === 'B') newTeamB[source.index!] = updatedP2;
          return { ...m, teamA: newTeamA, teamB: newTeamB };
        })
      );

      // 休憩中リスト: p2を除外して updatedP1 を追加
      setCurrentResting(prev => [
        ...prev.filter(p => p.playerId !== p2.playerId),
        updatedP1
      ]);

      // 試合消化数の整合: コートに出たp2は +1、ベンチに下がったp1は -1
      setPlayers(prev =>
        prev.map(p => {
          if (p.playerId === p2.playerId) return updatedP2;
          if (p.playerId === p1.playerId) return updatedP1;
          return p;
        })
      );

      showToast(`「${p1.name}」様(ベンチへ) ⇄ 「${p2.name}」様(コートへ) を交代しました！`);
    }

    // パターン3: 休憩中の選手(source) と コート上の選手(target) の入れ替え
    else if (source.source === 'resting' && target.source === 'court') {
      // 逆にして呼び出し
      executeSwap(target, source);
      return;
    }

    // パターン4: 休憩中同士（何もしない）
    else {
      showToast('休憩中同士の交代は不要です');
    }

    setSelectedSwapPlayer(null);
    setShowSwapModalForPlayer(null);
  };

  // プレイヤーカードをタップした時のスワップ選択ハンドラ
  const handlePlayerCardTap = (info: SelectedSwapInfo) => {
    if (!selectedSwapPlayer) {
      // 交代元として選択
      setSelectedSwapPlayer(info);
      showToast(`「${info.player.name}」様を選択中。交代したい相手をタップしてください。`);
    } else {
      // すでに選択中ならスワップ実行
      if (selectedSwapPlayer.player.playerId === info.player.playerId) {
        setSelectedSwapPlayer(null); // 解除
        showToast('交代の選択を解除しました');
      } else {
        executeSwap(selectedSwapPlayer, info);
      }
    }
  };

  // ----------------------------------------------------
  // 試合終了チェックボックスのトグル
  // ----------------------------------------------------
  const handleToggleMatchComplete = (matchId: string) => {
    const targetMatch = currentMatches.find(m => m.id === matchId);
    if (!targetMatch) return;

    const willBeCompleted = !targetMatch.isCompleted;

    // 試合終了時にコート上の最終組み合わせ（ペア＆対戦相手）を履歴に確定
    setPlayers(prev => applyMatchHistory(targetMatch, willBeCompleted, prev));

    setCurrentMatches(prev =>
      prev.map(m => m.id === matchId ? { ...m, isCompleted: willBeCompleted } : m)
    );
  };

  // 全コート試合終了の一括トグル
  const isAllMatchesCompleted = useMemo(() => {
    return currentMatches.length > 0 && currentMatches.every(m => m.isCompleted);
  }, [currentMatches]);

  const handleToggleAllMatchesComplete = () => {
    const nextState = !isAllMatchesCompleted;

    // 状態が変化する試合について履歴を更新
    setPlayers(prev => {
      let updated = prev;
      currentMatches.forEach(m => {
        if (!!m.isCompleted !== nextState) {
          updated = applyMatchHistory(m, nextState, updated);
        }
      });
      return updated;
    });

    setCurrentMatches(prev => prev.map(m => ({ ...m, isCompleted: nextState })));
    showToast(nextState ? '全コートを試合終了にしました（対戦履歴を確定）' : '全コートの終了チェックを解除しました');
  };

  // ----------------------------------------------------
  // スコア入力の更新
  // ----------------------------------------------------
  const handleUpdateScore = (matchId: string, team: 'A' | 'B', score: number) => {
    setCurrentMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          scoreA: team === 'A' ? score : m.scoreA,
          scoreB: team === 'B' ? score : m.scoreB,
        };
      })
    );
  };

  // ----------------------------------------------------
  // 途中参加（遅刻参加）の処理
  // ----------------------------------------------------
  const handleAddLateParticipant = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    setPlayers(prev => {
      const existing = prev.find(p => p.memberId === memberId);
      if (existing) {
        return prev.map(p =>
          p.memberId === memberId
            ? { ...p, status: 'late', isResting: false, matchCount: 0 }
            : p
        );
      } else {
        const newPlayer: DoublesPlayer = {
          playerId: `p-${member.id}`,
          memberId: member.id,
          name: member.name,
          gender: member.gender || 'unspecified',
          memberType: member.role === 'visitor' ? 'visitor' : 'member',
          role: member.role,
          status: 'late',
          isResting: false,
          matchCount: 0,
          restCount: 0,
          historyPairIds: [],
          historyOpponentIds: [],
        };
        return [...prev, newPlayer];
      }
    });

    if (!selectedMemberIds.includes(memberId)) {
      setSelectedMemberIds(prev => [...prev, memberId]);
    }

    // 休憩中リストにも追加
    const targetPlayer = players.find(p => p.memberId === memberId) || {
      playerId: `p-${member.id}`,
      memberId: member.id,
      name: member.name,
      gender: member.gender || 'unspecified',
      memberType: member.role === 'visitor' ? 'visitor' : 'member',
      role: member.role,
      status: 'late',
      isResting: false,
      matchCount: 0,
      restCount: 0,
    };
    setCurrentResting(prev => [...prev, targetPlayer]);

    setShowLateJoinModal(false);
    showToast(`「${member.name}」様が途中参加として加わりました（次試合から優先選出）`);
  };

  // ----------------------------------------------------
  // 途中退出（早退）の処理 (アプリ内カスタムモーダル)
  // ----------------------------------------------------
  const handleMarkPlayerLeft = (memberId: string) => {
    const player = players.find(p => p.memberId === memberId);
    if (!player) return;

    setConfirmDialog({
      isOpen: true,
      title: '途中退出（早退）の確認',
      message: `「${player.name}」様を途中退出（早退）にしますか？\n※ 次回以降の試合組合せから除外されますが、練習会の参加実績としては保持されます。`,
      confirmText: '早退として記録',
      isDanger: true,
      onConfirm: () => {
        setPlayers(prev =>
          prev.map(p => p.memberId === memberId ? { ...p, status: 'left' } : p)
        );
        setSelectedMemberIds(prev => prev.filter(id => id !== memberId));
        setCurrentResting(prev => prev.filter(p => p.memberId !== memberId));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        showToast(`「${player.name}」様を途中退出として記録しました`);
      },
    });
  };

  // ----------------------------------------------------
  // 一時休憩トグル
  // ----------------------------------------------------
  const handleToggleRest = (memberId: string) => {
    setPlayers(prev =>
      prev.map(p => p.memberId === memberId ? { ...p, isResting: !p.isResting } : p)
    );
    showToast('一時休憩のステータスを更新しました');
  };

  // ----------------------------------------------------
  // セッション全体のリセット
  // ----------------------------------------------------
  const handleResetSession = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'セッションのリセット',
      message: '現在の試合組合せや消化試合数を初期化し、参加者選択画面に戻りますか？',
      confirmText: 'リセットする',
      isDanger: true,
      onConfirm: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) { }
        setCurrentStep('select_players');
        setCurrentRoundNumber(0);
        setCurrentMatches([]);
        setCurrentResting([]);
        setRounds([]);
        setSelectedSwapPlayer(null);
        setPlayers(prev => prev.map(p => ({ ...p, matchCount: 0, restCount: 0, isResting: false })));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        showToast('セッションをリセットしました');
      },
    });
  };

  // ----------------------------------------------------
  // 練習会登録への引き継ぎ対象名簿集計
  // ----------------------------------------------------
  const actualAttendedPlayers = useMemo(() => {
    const participatedMemberIds = new Set<string>();
    selectedMemberIds.forEach(id => participatedMemberIds.add(id));
    rounds.forEach(r => {
      r.matches.forEach(m => {
        m.teamA.forEach(p => participatedMemberIds.add(p.memberId));
        m.teamB.forEach(p => participatedMemberIds.add(p.memberId));
      });
    });
    currentMatches.forEach(m => {
      m.teamA.forEach(p => participatedMemberIds.add(p.memberId));
      m.teamB.forEach(p => participatedMemberIds.add(p.memberId));
    });

    return players.filter(p =>
      (participatedMemberIds.has(p.memberId) || p.matchCount > 0) &&
      (p.status === 'joined' || p.status === 'late' || p.status === 'left')
    );
  }, [players, selectedMemberIds, rounds, currentMatches]);

  const handleConfirmTransferToPracticeSession = () => {
    const attendeeMemberIds = actualAttendedPlayers.map(p => p.memberId);
    setShowConfirmToSessionModal(false);
    onProceedToPracticeSession(attendeeMemberIds, sessionDate);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 pb-28">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl font-black text-xs flex items-center gap-2 animate-bounce border border-emerald-500">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* スワップ選択中 ガイドバナー */}
      {selectedSwapPlayer && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-40 bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 px-5 py-2.5 rounded-xl shadow-2xl text-xs flex items-center gap-3 backdrop-blur-md">
          <ArrowLeftRight className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <div>
            <span className="font-bold text-slate-100">「{selectedSwapPlayer.player.name}」</span>
            <span className="text-emerald-300"> 様と交代するプレイヤーをタップしてください</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedSwapPlayer(null)}
            className="p-1 hover:bg-emerald-900 rounded-xl text-slate-300 cursor-pointer"
            title="選択解除"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-full text-accent shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black text-text flex items-center gap-2 flex-wrap">
                <span>ダブルス組合せ</span>
              </h1>
              <p className="text-[10px] sm:text-sm text-text-subtle leading-snug mt-0.5">
                試合生成後も名簿交代可能。公平な乱数自動編成で、終了後は練習会出納帳へワンタップ連携します。
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center justify-end gap-2 flex-wrap self-end md:self-auto">
          {currentStep === 'match_running' && (
            <>
              <button
                type="button"
                onClick={() => setShowConfirmToSessionModal(true)}
                className="min-h-[44px] px-4 py-2 bg-accent hover:bg-accent-hover text-accent-text font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>出納帳へ連携</span>
              </button>

              <button
                type="button"
                onClick={handleResetSession}
                className="min-h-[44px] px-3.5 py-2 bg-surface-subtle hover:bg-surface-hover text-text-muted border border-border rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                title="最初からやり直す"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>リセット</span>
              </button>
            </>
          )}

          {currentStep === 'select_players' && (
            <div className="flex items-center justify-end gap-2 flex-wrap">
              {/* ビジター登録 */}
              <button
                type="button"
                id="btn-add-visitor"
                onClick={() => setShowAddVisitorModal(true)}
                className="min-h-[44px] px-4 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                <span>＋ ビジター登録</span>
              </button>

              {/* リセット */}
              {currentRoundNumber != 0 && (<button
                type="button"
                onClick={handleResetSession}
                className="min-h-[44px] px-3.5 py-2 bg-surface-subtle hover:bg-surface-hover text-text-muted border border-border rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                title="最初からやり直す"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>リセット</span>
              </button>)}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* STEP 1: 参加名簿選択・試合準備画面 */}
      {/* ==================================================== */}
      {currentStep === 'select_players' && (
        <div className="space-y-5">
          {/* 進行中セッションの再開案内バナー */}
          {hasActiveSession && (
            <div className="bg-surface border-2 border-accent/50 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-accent/20 border border-accent/40 rounded-full text-accent shrink-0 mt-0.5 md:mt-0">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm sm:text-base text-text">
                      {hasChanges ? `名簿に変更があります (現在 第${currentRoundNumber}試合)` : `現在 第${currentRoundNumber}試合 が進行中です`}
                    </span>
                    <span className="px-2.5 py-0.5 bg-accent/20 text-accent text-xs font-bold rounded-full border border-accent/30">
                      保持中
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {hasChanges
                      ? '名簿が変更されました。「変更を反映して試合へ」を押すと、変更を反映して現在の試合状況を保持したまま再開できます。'
                      : '現在の試合状況をそのまま再開できます。'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Settings Bar */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-text flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              <span>試合準備</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* コート数管理: [ − ] 2 [ ＋ ] */}
              <div className="bg-surface-subtle border border-border rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-xs font-bold text-text mb-2 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  <span>コート面数</span>
                </span>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCourtCount(prev => Math.max(1, prev - 1))}
                    disabled={courtCount <= 1}
                    className="w-11 h-11 bg-surface hover:bg-surface-hover disabled:opacity-30 border border-border rounded-xl font-black text-text text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-xl font-black text-accent">{courtCount}</span>
                    <span className="text-xs text-text-muted ml-1 font-bold">コート</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCourtCount(prev => Math.min(6, prev + 1))}
                    disabled={courtCount >= 6}
                    className="w-11 h-11 bg-surface hover:bg-surface-hover disabled:opacity-30 border border-border rounded-xl font-black text-text text-lg flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 作成方式 セグメントコントロール: [ 一括 ] [ 流し込み ] */}
              <div className="bg-surface-subtle border border-border rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-xs font-bold text-text mb-2 flex items-center gap-1">
                  <Shuffle className="w-3.5 h-3.5 text-accent" />
                  <span>作成方式</span>
                </span>
                <div className="flex items-center bg-surface border border-border rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setCreationMethod('batch')}
                    className={`flex-1 min-h-[38px] py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${creationMethod === 'batch'
                      ? 'bg-accent text-accent-text shadow-md'
                      : 'text-text-muted hover:text-text'
                      }`}
                  >
                    一括生成
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationMethod('stream')}
                    className={`flex-1 min-h-[38px] py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${creationMethod === 'stream'
                      ? 'bg-accent text-accent-text shadow-md'
                      : 'text-text-muted hover:text-text'
                      }`}
                  >
                    流し込み
                  </button>
                </div>
              </div>

              {/* ペア編成方針 */}
              <div className="bg-surface-subtle border border-border rounded-xl p-3.5 flex flex-col justify-between">
                <span className="text-xs font-bold text-text mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>ペア編成ルール</span>
                </span>
                <select
                  value={matcherMode}
                  onChange={(e) => setMatcherMode(e.target.value as any)}
                  className="w-full min-h-[38px] py-1.5 px-2.5 sm:p-2 bg-surface border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal text-xs focus:outline-none focus:border-accent"
                >
                  <option value="fair">公平</option>
                  <option value="mix_priority">ミックス優先</option>
                </select>
              </div>
            </div>

            {/* 選択状況バー */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-text text-sm">
                  参加選択: <span className="text-accent">{selectionStats.total}</span> 名
                </span>
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full font-bold text-[11px]">
                  男: {selectionStats.maleCount}名
                </span>
                <span className="px-2 py-0.5 bg-pink-500/10 text-pink-300 border border-pink-500/20 rounded-full font-bold text-[11px]">
                  女: {selectionStats.femaleCount}名
                </span>

                <span className="text-text-muted text-[11px]">
                  (1試合あたり {courtCount * 4}名 出場 / 休憩 {Math.max(0, selectionStats.total - courtCount * 4)}名)
                </span>
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMemberIds([])}
                  className="min-h-[36px] px-3 py-1 bg-surface-subtle hover:bg-surface-hover text-text-muted border border-border rounded-xl font-bold text-xs cursor-pointer"
                >
                  全員解除
                </button>
              </div>
            </div>
          </div>

          {/* 参加者管理・選択タブ: [ 👥 クラブ台帳から選択 ] [ 🔢 番号でクイック追加 ] */}
          <div className="flex items-center border-b border-border gap-2">
            <button
              type="button"
              onClick={() => setPlayerTab('members')}
              className={`pb-3 px-4 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${playerTab === 'members'
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>プレイヤー ({selectionStats.total}名選択中)</span>
            </button>
          </div>

          {/* TAB 1: クラブ台帳から選択 */}
          {playerTab === 'members' && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
              {/* 検索・絞り込みフィルター */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="氏名やふりがなで検索..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    className="w-full min-h-[44px] pl-10 pr-4 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-xs text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* プレイヤー一覧 (モバイルでタップしやすい 44px+ リスト) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {filteredMembers.map(m => {
                  const isSelected = selectedMemberIds.includes(m.id);
                  const playerStats = players.find(p => p.memberId === m.id);

                  return (
                    <div
                      key={m.id}
                      onClick={() => togglePlayerSelection(m.id)}
                      className={`min-h-[48px] p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none active:scale-[0.98] ${isSelected
                        ? 'bg-accent/10 border-accent/40 text-text shadow-sm'
                        : 'bg-surface-subtle border-border text-text-muted hover:border-accent/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 ${isSelected ? 'bg-accent border-accent text-accent-text' : 'border-border'
                          }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-text">{m.name}</span>
                            <span className={`h-4 min-w-4 flex items-center justify-center text-[10px] font-bold px-1.5 rounded-full ${m.gender === 'female'
                              ? 'bg-pink-500/20 text-pink-300'
                              : m.gender === 'male'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-surface-hover text-text-muted'
                              }`}>
                              {m.gender === 'female' ? 'w' : m.gender === 'male' ? 'm' : '−'}
                            </span>
                            {m.role === 'visitor' && (
                              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded-full font-bold">
                                b
                              </span>
                            )}
                          </div>
                          {m.kana && <div className="text-[10px] text-text-muted">{m.kana}</div>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-text-muted">
                          {playerStats && playerStats.matchCount > 0 ? `${playerStats.matchCount}試合` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* STEP 2: 試合進行・組合せ画面 */}
      {/* ==================================================== */}
      {currentStep === 'match_running' && (
        <div className="space-y-5">
          {/* 試合進行バー: 今何試合目か・コート増減・全コート終了トグル */}
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-2 bg-accent text-accent-text rounded-full font-black text-sm shadow-sm whitespace-nowrap">
                第{currentRoundNumber}試合
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
                  <span>進行中の試合</span>
                  <span className="text-xs text-text-muted font-normal">
                    ({creationMethod === 'stream' ? '流し込み方式' : '一括方式'})
                  </span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  選手枠をタップして自由に名簿交代が可能です。
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 flex-wrap">
              {/* コート数管理 [ - ] 2 [ + ] */}
              <div className="flex items-center bg-surface-subtle border border-border rounded-xl p-1 gap-1">
                <button
                  type="button"
                  onClick={() => handleModifyCourtCountDuringMatch(courtCount - 1)}
                  disabled={courtCount <= 1}
                  className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-hover disabled:opacity-30 text-text font-bold flex items-center justify-center cursor-pointer transition-all border border-border"
                  title="コートを減らす"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-xs font-black text-accent">{courtCount} コート</span>
                <button
                  type="button"
                  onClick={() => handleModifyCourtCountDuringMatch(courtCount + 1)}
                  disabled={courtCount >= 6}
                  className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-hover disabled:opacity-30 text-text font-bold flex items-center justify-center cursor-pointer transition-all border border-border"
                  title="コートを増やす"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 全コート終了チェックボックス */}
              {creationMethod !== 'batch' && (<button
                type="button"
                onClick={handleToggleAllMatchesComplete}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${isAllMatchesCompleted
                  ? 'bg-accent/20 border-accent/40 text-accent shadow-md'
                  : 'bg-surface-subtle border-border text-text hover:bg-surface-hover'
                  }`}
              >
                <div className={`w-4 h-4 rounded-lg flex items-center justify-center border ${isAllMatchesCompleted ? 'bg-accent border-accent text-accent-text' : 'border-border'
                  }`}>
                  {isAllMatchesCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>全コート終了</span>
              </button>)}
            </div>
          </div>

          {/* コートカード一覧 (スマートフォン1列、タブレット2列、PC3列) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentMatches.map(match => {
              const isCompleted = Boolean(match.isCompleted);

              return (
                <div
                  key={match.id}
                  className={`border rounded-2xl p-4 sm:p-5 shadow-md space-y-3.5 transition-all ${isCompleted
                    ? 'bg-surface/60 border-border/60 opacity-90'
                    : 'bg-surface border-border'
                    }`}
                >
                  {/* コートヘッダー: コート名 & [☑ 試合終了] チェックボックス */}
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-accent" />
                      <span className="font-black text-sm text-text">
                        {match.courtName || `${match.courtNumber}コート`}
                      </span>
                    </div>

                    {/* 試合終了トグルボタン (44pxタッチターゲット) */}
                    {creationMethod !== 'batch' && (<button
                      type="button"
                      onClick={() => handleToggleMatchComplete(match.id)}
                      className={`min-h-[44px] px-3.5 py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${isCompleted
                        ? 'bg-accent/20 border-accent/50 text-accent'
                        : 'bg-surface-subtle border-border text-text-muted hover:text-text'
                        }`}
                    >
                      <div className={`w-4 h-4 rounded-lg flex items-center justify-center border ${isCompleted ? 'bg-accent border-accent text-accent-text' : 'border-border'
                        }`}>
                        {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{isCompleted ? '試合終了' : '終了チェック'}</span>
                    </button>
                    )}
                  </div>

                  {/* 対戦カード: チームA vs チームB (コンパクトな横並び・すっきりしたデザイン) */}
                  <div className="space-y-2">
                    {/* Team A (2名) */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {match.teamA.map((p, idx) => {
                        const isSwapTarget = selectedSwapPlayer?.player.playerId === p.playerId;

                        return (
                          <div
                            key={p.playerId}
                            onClick={() => handlePlayerCardTap({ source: 'court', matchId: match.id, team: 'A', index: idx, player: p })}
                            className={`p-2 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-1.5 active:scale-[0.98] ${isSwapTarget
                              ? 'bg-accent/30 border-2 border-accent text-text ring-2 ring-accent/50 animate-pulse'
                              : 'bg-surface-subtle border-border hover:border-accent/40 text-text'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-bold text-xs truncate">{p.name}</span>
                              <span className={`h-4 min-w-4 flex items-center justify-center text-[9px] font-bold px-1 rounded-full shrink-0 ${p.gender === 'female' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                {p.gender === 'female' ? 'w' : 'm'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                              <span>{playerMap.get(p.playerId)?.matchCount ?? p.matchCount}</span>
                              <ArrowLeftRight className="w-3 h-3 text-text-muted hover:text-accent shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* VS Divider (compact) */}
                    <div className="flex items-center justify-center my-0.5">
                      <span className="text-[10px] font-black text-text-muted tracking-wider">
                        vs
                      </span>
                    </div>

                    {/* Team B (2名) */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {match.teamB.map((p, idx) => {
                        const isSwapTarget = selectedSwapPlayer?.player.playerId === p.playerId;

                        return (
                          <div
                            key={p.playerId}
                            onClick={() => handlePlayerCardTap({ source: 'court', matchId: match.id, team: 'B', index: idx, player: p })}
                            className={`p-2 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-1.5 active:scale-[0.98] ${isSwapTarget
                              ? 'bg-accent/30 border-2 border-accent text-text ring-2 ring-accent/50 animate-pulse'
                              : 'bg-surface-subtle border-border hover:border-accent/40 text-text'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="font-bold text-xs truncate">{p.name}</span>
                              <span className={`h-4 min-w-4 flex items-center justify-center text-[9px] font-bold px-1 rounded-full shrink-0 ${p.gender === 'female' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
                                }`}>
                                {p.gender === 'female' ? 'w' : 'm'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-text-muted shrink-0">
                              <span>{playerMap.get(p.playerId)?.matchCount ?? p.matchCount}</span>
                              <ArrowLeftRight className="w-3 h-3 text-text-muted hover:text-accent shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 流し込み方式の時のコート個別流し込みボタン */}
                  {creationMethod === 'stream' && isCompleted && (
                    <div className="pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => handleStreamNextMatchForCourt(match.courtNumber)}
                        className="w-full min-h-[44px] py-2 bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>このコートに次の試合を流し込み</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 休憩中プレイヤー一覧 (スワップ交代の対象としても選択可能) */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-xs font-bold text-text flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>休憩中 ({currentResting.length}名)</span>
              </span>
            </div>

            {currentResting.length === 0 ? (
              <p className="text-xs text-text-muted italic">現在全員が試合出場中です</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentResting.map(p => {
                  const isSwapTarget = selectedSwapPlayer?.player.playerId === p.playerId;

                  return (
                    <div
                      key={p.playerId}
                      onClick={() => handlePlayerCardTap({ source: 'resting', player: p })}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 select-none active:scale-[0.98] ${isSwapTarget
                        ? 'bg-accent/30 border-2 border-accent text-text ring-2 ring-accent/50 animate-pulse'
                        : 'bg-surface-subtle border-border hover:border-accent/40 text-text'
                        }`}
                    >
                      <span className="font-bold text-xs">{p.name}</span>
                      <span className={`h-4 min-w-4 flex items-center justify-center text-[9px] font-bold px-1 rounded-full ${p.gender === 'female' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                        {p.gender === 'female' ? 'w' : 'm'}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {playerMap.get(p.playerId)?.matchCount ?? p.matchCount}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkPlayerLeft(p.memberId);
                        }}
                        className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center hover:bg-rose-500/20 rounded-xl text-text-muted hover:text-rose-400 transition-colors cursor-pointer"
                        title="途中退出（早退）として記録"
                        aria-label="途中退出（早退）として記録"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 画面下部固定ナビゲーションバー (スマホ片手操作最適化) */}
      {/* ==================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-3 sm:px-6 lg:px-8 py-3 pb-safe shadow-2xl">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">
          {currentStep === 'match_running' ? (
            <>
              {/* 選手管理・再選択 */}
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({
                    isOpen: true,
                    title: 'プレイヤー準備画面へ戻る',
                    message: '参加者選択・設定画面に戻りますか？ 現在の試合結果は保持されます。',
                    confirmText: '戻る',
                    onConfirm: () => {
                      setCurrentStep('select_players');
                      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                    },
                  });
                }}
                className="flex-1 min-h-[48px] py-2.5 mb-3 bg-surface-subtle hover:bg-surface-hover text-text border border-border rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Users className="w-4 h-4" />
                <span>プレイヤー管理</span>
              </button>

              {/* ↻ 新しい組合せを生成 */}
              <button
                type="button"
                onClick={handleGenerateNextRound}
                disabled={players.filter(p => (p.status === 'joined' || p.status === 'late') && !p.isResting).length < 4}
                className={`flex-[2] min-h-[48px] py-2.5 mb-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-xl transition-all ${
                  players.filter(p => (p.status === 'joined' || p.status === 'late') && !p.isResting).length < 4
                    ? 'bg-surface-hover text-text-muted cursor-not-allowed opacity-60 border border-border'
                    : isAllMatchesCompleted
                      ? 'bg-accent hover:bg-accent-hover text-accent-text animate-pulse ring-2 ring-accent/50 cursor-pointer active:scale-[0.98]'
                      : 'bg-accent hover:bg-accent-hover text-accent-text cursor-pointer active:scale-[0.98]'
                  }`}
              >
                <Shuffle className="w-4 h-4" />
                <span>
                  {players.filter(p => (p.status === 'joined' || p.status === 'late') && !p.isResting).length < 4
                    ? '参加者不足 (4名未満)'
                    : `組合せ生成 (第${currentRoundNumber + 1}試合)`}
                </span>
              </button>
            </>
          ) : (
            <>
              {/* 準備画面時の下部バー: 状態に応じて単一のプライマリボタンを表示 */}
              <button
                type="button"
                onClick={hasActiveSession ? handleResumeSession : handleStartSession}
                disabled={selectedMemberIds.length < 4}
                className={`w-full min-h-[48px] py-3 mb-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                  selectedMemberIds.length >= 4
                    ? 'bg-accent hover:bg-accent-hover text-accent-text cursor-pointer'
                    : 'bg-surface-hover text-text-muted cursor-not-allowed opacity-60 border border-border'
                  }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {selectedMemberIds.length < 4
                    ? `最低4名の参加者が必要です (${selectedMemberIds.length}/4)`
                    : hasActiveSession
                      ? (hasChanges ? `変更を反映して試合へ (第${currentRoundNumber}試合へ)` : `試合へ戻る (第${currentRoundNumber}試合)`)
                      : `組合せを生成する (${selectedMemberIds.length}名選択中)`}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL: 新規ビジター名簿追加モーダル */}
      {/* ==================================================== */}
      {showAddVisitorModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>新規ビジター名簿の登録</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddVisitorModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              登録と同時にクラブの名簿台帳へ正規登録され、一意なIDでダブルスプレイヤーとして自動選択されます。
            </p>

            <form onSubmit={handleCreateVisitor} className="space-y-3 sm:space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-text mb-1">
                  氏名 <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 加美山 太郎"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full min-h-[44px] py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal text-xs focus:outline-none focus:border-accent"
                />
              </div>

              {duplicateWarning && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text mb-1">フリガナ</label>
                  <input
                    type="text"
                    placeholder=""
                    value={visitorKana}
                    onChange={(e) => setVisitorKana(e.target.value)}
                    className="w-full min-h-[44px] py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text text-xs focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text mb-1">性別</label>
                  <select
                    value={visitorGender}
                    onChange={(e) => setVisitorGender(e.target.value as Gender)}
                    className="w-full min-h-[44px] py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">備考</label>
                <input
                  type="text"
                  placeholder="例: 〇〇さんの紹介、初参加など"
                  value={visitorNotes}
                  onChange={(e) => setVisitorNotes(e.target.value)}
                  className="w-full min-h-[44px] py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVisitorModal(false)}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>登録する</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 途中参加モーダル */}
      {/* ==================================================== */}
      {showLateJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span>途中参加名簿の追加</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLateJoinModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              遅れて到着した名簿を追加します。試合消化数0として、次回の試合組合せから優先的にコートへ割り振られます。
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {members
                .filter(m => !m.isDeleted && m.isActive && m.role !== 'inactive' && !players.some(p => p.memberId === m.id && (p.status === 'joined' || p.status === 'late')))
                .map(m => (
                  <div
                    key={m.id}
                    onClick={() => handleAddLateParticipant(m.id)}
                    className="p-3 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <div>
                      <span className="font-bold text-xs text-text">{m.name}</span>
                      {m.role === 'visitor' && (
                        <span className="ml-2 px-1 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded-full font-bold">
                          ビジター
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-xl text-[10px] font-bold"
                    >
                      途中参加
                    </button>
                  </div>
                ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowLateJoinModal(false)}
                className="w-full py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 練習会登録・出納帳引き継ぎ確認モーダル */}
      {/* ==================================================== */}
      {showConfirmToSessionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/20 text-accent rounded-full">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text">
                    練習会参加費・出納帳への引き継ぎ
                  </h3>
                  <span className="text-[11px] text-text-muted">
                    実参加者 {actualAttendedPlayers.length} 名を自動集計
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmToSessionModal(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-surface-hover transition-colors text-text-muted hover:text-text text-xs font-bold cursor-pointer -mr-2"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-text">引き継ぎ対象プレイヤー:</div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-surface-subtle border border-border rounded-xl">
                {actualAttendedPlayers.map(p => (
                  <div key={p.playerId} className="flex items-center justify-between text-xs px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-text">{p.name}</span>
                      {p.memberType === 'visitor' && (
                        <span className="px-1 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] rounded-full font-bold">
                          ビジター
                        </span>
                      )}
                    </div>
                    <div>
                      {p.status === 'left' ? (
                        <span className="px-1.5 py-0.2 bg-rose-500/15 text-rose-300 text-[9px] rounded-full font-bold">
                          途中退出
                        </span>
                      ) : p.status === 'late' ? (
                        <span className="px-1.5 py-0.2 bg-blue-500/15 text-blue-300 text-[9px] rounded-full font-bold">
                          途中参加
                        </span>
                      ) : (
                        <span className="text-text-muted text-[10px]">
                          消化: {p.matchCount}試合
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-text leading-relaxed">
              「練習会登録画面へ進む」を押すと、参加費管理画面に遷移し、上記の名簿が自動選択されます。<br />
              <span className="text-text-muted">
                シャトル使用本数や会場費を確認の上、ワンタップで出納帳への集金記帳と練習会記録を完了できます。
              </span>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmToSessionModal(false)}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmTransferToPracticeSession}
                className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-4 h-4" />
                <span>練習会登録画面へ進む</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: カスタム確認ダイアログ (ブラウザ confirm() 排除) */}
      {/* ==================================================== */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-subtle border border-border flex items-center justify-center text-accent">
              {confirmDialog.isDanger ? (
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              ) : (
                <HelpCircle className="w-6 h-6 text-accent" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-text">{confirmDialog.title}</h3>
              <p className="text-xs text-text-muted mt-2 leading-relaxed whitespace-pre-line">
                {confirmDialog.message}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              {confirmDialog.cancelText !== null && (
                <button
                  type="button"
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  {confirmDialog.cancelText || 'キャンセル'}
                </button>
              )}
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer ${confirmDialog.isDanger
                  ? 'bg-rose-500 hover:bg-rose-400 text-white'
                  : 'bg-accent hover:bg-accent-hover text-accent-text'
                  }`}
              >
                {confirmDialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
