import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  AlertTriangle, 
  Calendar, 
  Phone, 
  Mail, 
  HeartHandshake, 
  Search, 
  Filter, 
  ChevronRight, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  ShieldAlert,
  Edit3,
  Trash2,
  Sparkles,
  Award
} from 'lucide-react';
import { Member, PracticeSessionRecord } from '../types';
import { formatCurrency, formatDate, calculateAge } from '../utils/formatters';
import { parseDateString } from '../utils/dateUtils';

interface MembersAttendanceViewProps {
  members: Member[];
  practiceSessions: PracticeSessionRecord[];
  onAddMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onUpdateParticipation: (memberId: string, sessionId: string, newFeePaid: number) => void;
  onDeleteParticipation: (memberId: string, sessionId: string) => void;
}

export const MembersAttendanceView: React.FC<MembersAttendanceViewProps> = ({
  members,
  practiceSessions,
  onAddMember,
  onEditMember,
  onDeleteMember,
  onUpdateParticipation,
  onDeleteParticipation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [showInactiveOnly6Times, setShowInactiveOnly6Times] = useState<boolean>(false);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null);
  const [editFee, setEditFee] = useState<number | ''>(0);

  // 直近6回のイベントセッションIDリスト（日付降順で最新6回）
  const recent6Sessions = useMemo(() => {
    return [...practiceSessions]
      .sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime())
      .slice(0, 6);
  }, [practiceSessions]);

  const recent6SessionIds = useMemo(() => {
    return new Set(recent6Sessions.map(s => s.id));
  }, [recent6Sessions]);

  // 各名簿の参加統計・直近6回参加判定
  const membersWithStats = useMemo(() => {
    return members.map(m => {
      const logs = m.participationLogs || [];
      const totalEventsCount = logs.length;
      const totalPaidAmount = logs.reduce((sum, l) => sum + (l.feePaid || 0), 0);
      
      // 最終参加日
      const sortedLogs = [...logs].sort((a, b) => parseDateString(b.date).getTime() - parseDateString(a.date).getTime());
      const lastAttendedDate = sortedLogs[0]?.date || null;

      // 直近6回のイベントに参加したかどうかの判定
      // 修正: 練習会への参加が一度もない名簿はアラート対象外とする
      const attendedInRecent6 = recent6Sessions.length === 0 
        ? true 
        : logs.some(l => recent6SessionIds.has(l.sessionId));

      // 直近6回未参加フラグ（直近6回のイベントがある かつ 一度でも練習会に参加したことがある かつ 直近に不参加）
      const isMissingRecent6 = recent6Sessions.length >= 1 && totalEventsCount > 0 && !attendedInRecent6;

      const age = calculateAge(m.birthDate);

      return {
        ...m,
        age,
        totalEventsCount,
        totalPaidAmount,
        lastAttendedDate,
        isMissingRecent6,
        recentLogs: sortedLogs,
      };
    });
  }, [members, recent6Sessions, recent6SessionIds]);

  // 絞り込みフィルター
  const filteredMembers = useMemo(() => {
    return membersWithStats.filter(m => {
      // 削除済み名簿を表示しない (isDeletedがtrueは除外)
      if (m.isDeleted) return false;
      
      const matchesSearch = 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.kana.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.phone && m.phone.includes(searchTerm)) ||
        (m.notes && m.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesGender = selectedGender === 'all' || m.gender === selectedGender;
      const matchesInactiveAlert = !showInactiveOnly6Times || m.isMissingRecent6;

      return matchesSearch && matchesGender && matchesInactiveAlert;
    });
  }, [membersWithStats, searchTerm, selectedGender, showInactiveOnly6Times]);

  // アラート対象（直近6回未参加）の人数
  const missingRecent6Count = useMemo(() => {
    return membersWithStats.filter(m => m.isMissingRecent6).length;
  }, [membersWithStats]);

  const genderLabels: Record<string, string> = {
    male: '男性',
    female: '女性',
    other: 'その他',
    unspecified: '未設定',
  };

  const roleLabels: Record<string, { label: string; bg: string }> = {
    leader: { label: '代表', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    officer: { label: '役員', bg: 'bg-accent/15 text-accent border-accent/30' },
    member: { label: '部員', bg: 'bg-surface-subtle text-text-muted border-border' },
    student: { label: '学生', bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
    visitor: { label: 'ビジター', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    inactive: { label: '休会中', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Header Bento Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/15 border border-accent/30 rounded-full text-accent">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text tracking-tight">
              名簿管理
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            生年月日・年齢・緊急連絡先の管理、各イベントの参加実績
          </p>
        </div>

        <button
          type="button"
          onClick={onAddMember}
          className="px-4 py-2.5 text-xs sm:text-sm font-bold text-accent-text bg-accent hover:bg-accent-hover rounded-xl transition-all shadow-md flex items-center gap-2 self-end sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>名簿登録</span>
        </button>
      </div>

      {/* Overview Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">登録者数</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-text mt-1 tabular-nums">
            {members.length} <span className="text-xs font-normal text-text-muted">名</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            男性 {members.filter(m => m.gender === 'male').length}名 / 女性 {members.filter(m => m.gender === 'female').length}名
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">イベント開催数</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-accent mt-1 tabular-nums">
            {practiceSessions.length} <span className="text-xs font-normal text-text-muted">回</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            直近開催: {practiceSessions[0] ? formatDate(practiceSessions[0].date) : '-'}
          </div>
        </div>

        <div className="bg-surface p-5 rounded-2xl border border-border shadow-md">
          <div className="text-xs font-bold text-text-muted uppercase tracking-wider">参加費 累計集金額</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-accent mt-1 tabular-nums">
            {formatCurrency(membersWithStats.reduce((sum, m) => sum + m.totalPaidAmount, 0))}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            全通算支払額
          </div>
        </div>

        

        {/* Missing 6 events alert card */}
        <div 
          onClick={() => setShowInactiveOnly6Times(!showInactiveOnly6Times)}
          className={`p-5 rounded-2xl border shadow-md transition-all cursor-pointer ${
            showInactiveOnly6Times 
              ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40' 
              : missingRecent6Count > 0 
                ? 'bg-surface border-amber-500/50 hover:border-amber-400' 
                : 'bg-surface border-border'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>直近未参加アラート</span>
            </span>
            <span className="text-[10px] font-bold text-text-muted">クリックで絞込</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 tabular-nums">
            {missingRecent6Count} <span className="text-xs font-normal text-text-muted">名</span>
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            直近イベントに参加されてない部員
          </div>
        </div>

      </div>

      {/* Filter & Search Bar */}
      <div className="bg-surface border border-border rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="名前・フリガナ・電話番号で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-surface-subtle border border-border rounded-xl text-text text-xs placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Gender Filter */}
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="p-2 bg-surface-subtle border border-border rounded-xl text-text text-xs font-bold focus:outline-none"
          >
            <option value="all">全ての性別</option>
            <option value="male">男性のみ</option>
            <option value="female">女性のみ</option>
          </select>

          {/* Inactive Toggle Button */}
          <button
            type="button"
            onClick={() => setShowInactiveOnly6Times(!showInactiveOnly6Times)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              showInactiveOnly6Times
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-surface-subtle text-text-muted border-border hover:text-text'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>直近未参加のみ ({missingRecent6Count})</span>
          </button>
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredMembers.map((member) => {
          const roleMeta = roleLabels[member.role] || roleLabels.member;

          return (
            <div
              key={member.id}
              className={`bg-surface rounded-2xl border p-5 shadow-md flex flex-col justify-between transition-all ${
                member.isMissingRecent6 
                  ? 'border-amber-500/50 ring-1 ring-amber-500/20' 
                  : 'border-border hover:border-accent/40'
              }`}
            >
              <div className="space-y-4">
                
                {/* Header: Name, Role, Alert Mark */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-text">{member.name}</h3>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${roleMeta.bg}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                      <span>{member.kana}</span>
                      <span>•</span>
                      <span>{genderLabels[member.gender]}</span>
                      {member.age !== null && (
                        <>
                          <span>•</span>
                          <span className="text-accent font-bold">{member.age}歳</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 6 Times Missing Badge */}
                  {member.isMissingRecent6 ? (
                    <div 
                      className="p-1.5 bg-amber-500/15 border border-amber-500/40 rounded-full text-amber-300 flex items-center gap-1 text-[11px] font-black shrink-0"
                      title="直近6回のイベントに未参加です"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>直近未参加</span>
                    </div>
                  ) : (
                    <div 
                      className="p-1.5 bg-accent/10 border border-accent/20 rounded-full text-accent flex items-center gap-1 text-[11px] font-bold shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>参加中</span>
                    </div>
                  )}
                </div>

                {/* Attendance Stats Bento Tile */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-surface-subtle rounded-xl border border-border">
                  <div>
                    <div className="text-[10px] text-text-muted font-semibold">累計参加回数</div>
                    <div className="text-lg font-black text-text tabular-nums mt-0.5">
                      {member.totalEventsCount} <span className="text-xs font-normal text-text-muted">回</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-text-muted font-semibold">累計支払額</div>
                    <div className="text-sm font-black text-accent tabular-nums mt-1">
                      {formatCurrency(member.totalPaidAmount)}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Contact Info */}
                <div className="space-y-2 text-xs">
                  {/* Emergency Contact Banner */}
                  {member.emergencyContact && member.emergencyContact.phone ? (
                    <div className="p-2.5 bg-surface-subtle rounded-xl border border-border flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                        <HeartHandshake className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>緊急連絡先: {member.emergencyContact.name} ({member.emergencyContact.relation || '親族'})</span>
                      </div>
                      <a 
                        href={`tel:${member.emergencyContact.phone}`}
                        className="text-text-muted hover:text-accent font-semibold tabular-nums ml-1"
                      >
                        {member.emergencyContact.phone}
                      </a>
                    </div>
                  ) : (
                    <div className="p-2 bg-surface-subtle/50 rounded-xl border border-dashed border-border text-[11px] text-text-muted italic">
                      緊急連絡先: 未登録
                    </div>
                  )}

                  {/* Personal Contact */}
                  <div className="flex items-center justify-between text-text-muted text-[11px] pt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-text-muted" />
                      <span>{member.phone || '電話番号なし'}</span>
                    </span>
                    <span className="text-text-muted">
                      最終参加: {member.lastAttendedDate ? formatDate(member.lastAttendedDate) : '履歴なし'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-4 mt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedMemberDetail(member)}
                  className="flex-1 py-2 bg-surface-subtle hover:bg-surface-hover border border-border text-text font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>参加・集金履歴 ({member.totalEventsCount}件)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onEditMember(member)}
                  className="p-2 bg-surface-subtle border border-border hover:border-accent text-text-muted rounded-xl transition-colors cursor-pointer"
                  title="名簿情報を編集"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setMemberToDelete(member)}
                  className="p-2 bg-surface-subtle border border-border hover:border-rose-900 text-text-muted hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                  title="名簿を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Member Attendance & Payment Detail Modal */}
      {selectedMemberDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-text flex items-center gap-2">
                  <span>{selectedMemberDetail.name} さんの参加・集金実績</span>
                </h3>
                <div className="text-xs text-text-muted mt-0.5">
                  {selectedMemberDetail.kana} • {genderLabels[selectedMemberDetail.gender]}
                </div>
              </div>
              <button
                onClick={() => setSelectedMemberDetail(null)}
                className="text-text-muted hover:text-text text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Summary Banner */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-surface-subtle rounded-xl border border-border">
              <div>
                <div className="text-xs text-text-muted font-semibold">通算参加回数</div>
                <div className="text-xl font-black text-text mt-0.5">
                  {selectedMemberDetail.participationLogs?.length || 0} 回
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted font-semibold">累計支払金額</div>
                <div className="text-xl font-black text-accent mt-0.5">
                  {formatCurrency((selectedMemberDetail.participationLogs || []).reduce((s, l) => s + l.feePaid, 0))}
                </div>
              </div>
            </div>

            {/* Emergency Contact Box */}
            {selectedMemberDetail.emergencyContact && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs space-y-1">
                <div className="font-bold text-rose-300 flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-rose-400" />
                  <span>緊急連絡先</span>
                </div>
                <div className="text-text font-medium">
                  {selectedMemberDetail.emergencyContact.name} ({selectedMemberDetail.emergencyContact.relation || '続柄未設定'})
                </div>
                <div className="text-text-muted tabular-nums">
                  TEL: {selectedMemberDetail.emergencyContact.phone || '未登録'}
                </div>
              </div>
            )}

            {/* Participation Log List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text">イベント参加ログ一覧</h4>
              {(!selectedMemberDetail.participationLogs || selectedMemberDetail.participationLogs.length === 0) ? (
                <div className="text-center py-6 text-text-muted text-xs bg-surface-subtle/60 rounded-xl">
                  まだ参加記録はありません。
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {selectedMemberDetail.participationLogs.map((log, idx) => (
                    <div key={idx} className="p-3 bg-surface-subtle rounded-xl border border-border flex items-center justify-between text-xs">
                      {editingLogIndex === idx ? (
                        <>
                          <div className="flex-1 mr-3">
                            <div className="font-bold text-text mb-1">{formatDate(log.date)} - {log.eventName}</div>
                            <input
                              type="number"
                              min="0"
                              value={editFee}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  setEditFee('');
                                } else {
                                  const num = Number(val);
                                  setEditFee(isNaN(num) ? '' : Math.max(0, num));
                                }
                              }}
                              placeholder="0"
                              className="w-full p-1.5 bg-surface border border-border rounded-xl text-text font-bold"
                            />
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                const normalizedFee = typeof editFee === 'number' ? editFee : 0;
                                onUpdateParticipation(selectedMemberDetail.id, log.sessionId, normalizedFee);
                                setEditingLogIndex(null);
                                setSelectedMemberDetail(prev => prev ? {
                                    ...prev,
                                    participationLogs: prev.participationLogs?.map((l, i) => i === idx ? {...l, feePaid: normalizedFee} : l)
                                } : null);
                              }}
                              className="px-2 py-1 bg-accent hover:bg-accent-hover text-accent-text rounded-xl font-bold cursor-pointer"
                            >保存</button>
                            <button
                              onClick={() => setEditingLogIndex(null)}
                              className="px-2 py-1 bg-surface-hover text-text rounded-xl font-bold cursor-pointer border border-border"
                            >戻る</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="font-bold text-text">{formatDate(log.date)}</div>
                            <div className="text-[11px] text-text-muted">{log.eventName}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-black text-accent tabular-nums">+{formatCurrency(log.feePaid)}</div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingLogIndex(idx);
                                setEditFee(log.feePaid);
                              }}
                              className="text-text-muted hover:text-accent cursor-pointer"
                            ><Edit3 className="w-3.5 h-3.5"/></button>
                            <button
                              onClick={() => {
                                onDeleteParticipation(selectedMemberDetail.id, log.sessionId);
                                setSelectedMemberDetail(prev => prev ? {
                                    ...prev,
                                    participationLogs: prev.participationLogs?.filter((_, i) => i !== idx)
                                } : null);
                              }}
                              className="text-text-muted hover:text-rose-400 cursor-pointer"
                            ><Trash2 className="w-3.5 h-3.5"/></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedMemberDetail(null)}
              className="w-full py-2.5 bg-surface-subtle hover:bg-surface-hover text-text border border-border font-bold text-xs rounded-xl cursor-pointer"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-center gap-3 text-rose-400 border-b border-border pb-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-full">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">名簿の削除</h3>
                <p className="text-xs text-text-muted">名簿から名簿を削除します</p>
              </div>
            </div>

            <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">氏名 (フリガナ):</span>
                <span className="font-bold text-text">{memberToDelete.name} ({memberToDelete.kana})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">参加実績:</span>
                <span className="font-bold text-text">{memberToDelete.participationLogs?.length || 0} 回</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted font-semibold">納入累計額:</span>
                <span className="font-black text-accent">
                  {formatCurrency((memberToDelete.participationLogs || []).reduce((s, l) => s + (l.feePaid || 0), 0))}
                </span>
              </div>
            </div>

            <p className="text-xs text-text leading-relaxed">
              名簿「<strong className="text-text font-bold">{memberToDelete.name}</strong>」さんを名簿から削除してよろしいですか？
              <br />
              <span className="text-amber-400 font-bold">過去の参加履歴や取引履歴は保持されます。</span>
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
                }}
                className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>削除を実行する</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
