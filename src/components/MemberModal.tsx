import React, { useState, useEffect } from 'react';
import { UserPlus, Edit3, HeartHandshake, Phone, Mail, Calendar, User } from 'lucide-react';
import { Member, MemberRole, Gender, EmergencyContact } from '../types';
import { calculateAge } from '../utils/formatters';
import { getTodayString } from '../utils/dateUtils';

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (member: Omit<Member, 'id'>, id?: string) => void;
  initialMember?: Member | null;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMember,
}) => {
  const today = getTodayString();

  const [name, setName] = useState('');
  const [kana, setKana] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [birthDate, setBirthDate] = useState<string>('');
  const [role, setRole] = useState<MemberRole>('member');
  const [joinDate, setJoinDate] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // 緊急連絡先
  const [emName, setEmName] = useState('');
  const [emRelation, setEmRelation] = useState('');
  const [emPhone, setEmPhone] = useState('');

  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initialMember) {
      setName(initialMember.name);
      setKana(initialMember.kana || '');
      setGender(initialMember.gender || 'male');
      setBirthDate(initialMember.birthDate || '');
      setRole(initialMember.role);
      setJoinDate(initialMember.joinDate || '');
      setPhone(initialMember.phone || '');
      setEmail(initialMember.email || '');
      
      if (initialMember.emergencyContact) {
        setEmName(initialMember.emergencyContact.name || '');
        setEmRelation(initialMember.emergencyContact.relation || '');
        setEmPhone(initialMember.emergencyContact.phone || '');
      } else {
        setEmName('');
        setEmRelation('');
        setEmPhone('');
      }

      setIsActive(initialMember.isActive);
      setNotes(initialMember.notes || '');
    } else {
      setName('');
      setKana('');
      setGender('male');
      setBirthDate('');
      setRole('member');
      setJoinDate('');
      setPhone('');
      setEmail('');
      setEmName('');
      setEmRelation('');
      setEmPhone('');
      setIsActive(true);
      setNotes('');
    }
  }, [initialMember, isOpen, today]);

  if (!isOpen) return null;

  const currentAge = calculateAge(birthDate);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let emergencyContact: EmergencyContact | undefined = undefined;
    if (emName.trim() || emPhone.trim()) {
      emergencyContact = {
        name: emName.trim(),
        relation: emRelation.trim(),
        phone: emPhone.trim(),
      };
    }

    onSave({
      name: name.trim(),
      kana: kana.trim(),
      gender,
      birthDate: birthDate || undefined,
      role,
      joinDate,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      emergencyContact,
      isActive,
      notes: notes.trim() || undefined,
      participationLogs: initialMember?.participationLogs || [],
    }, initialMember?.id);

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full shadow-2xl border border-border flex flex-col max-h-[85vh] my-auto relative">
        
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
            {initialMember ? (
              <>
                <Edit3 className="w-4 h-4 text-accent" />
                <span>名簿情報の編集</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-accent" />
                <span>新規部員の登録</span>
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
          
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">氏名 *</label>
              <input
                type="text"
                required
                placeholder="例: 加美山 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block font-bold text-text mb-1">フリガナ</label>
              <input
                type="text"
                placeholder="例: カミヤマ タロウ"
                value={kana}
                onChange={(e) => setKana(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Gender, Birthday & Calculated Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">性別</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              >
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="unspecified">未設定</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-text">生年月日</label>
                {currentAge !== null && (
                  <span className="text-[11px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                    現在: {currentAge} 歳
                  </span>
                )}
              </div>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Role*/}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">クラブ内役職</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              >
                <option value="leader">代表</option>
                <option value="officer">役員・幹事</option>
                <option value="member">一般部員</option>
                <option value="student">学生</option>
                <option value="visitor">ビジター</option>
                <option value="inactive">休会中</option>
              </select>
            </div>
          </div>

          {/* Contact (Phone / Email) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-text mb-1">電話番号</label>
              <input
                type="tel"
                placeholder="090-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block font-bold text-text mb-1">メールアドレス</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-text mb-1">備考</label>
            <input
              type="text"
              placeholder="例: 体育館予約担当、怪我療養中など"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
            />
          </div>

          {/* Emergency Contact Group Box */}
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-rose-300 font-bold text-xs">
              <HeartHandshake className="w-4 h-4 text-rose-400" />
              <span>緊急連絡先の設定</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-text-muted font-bold mb-1 text-[11px]">氏名</label>
                <input
                  type="text"
                  value={emName}
                  onChange={(e) => setEmName(e.target.value)}
                  className="w-full p-2 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-rose-400 text-xs"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-text-muted font-bold mb-1 text-[11px]">続柄 (関係)</label>
                <input
                  type="text"
                  placeholder="例: 配偶者, 母, 父"
                  value={emRelation}
                  onChange={(e) => setEmRelation(e.target.value)}
                  className="w-full p-2 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-rose-400 text-xs"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-text-muted font-bold mb-1 text-[11px]">電話番号</label>
                <input
                  type="tel"
                  placeholder="090-xxxx-xxxx"
                  value={emPhone}
                  onChange={(e) => setEmPhone(e.target.value)}
                  className="w-full p-2 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-rose-400 text-xs"
                />
              </div>
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
              {initialMember ? '保存する' : '登録する'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
