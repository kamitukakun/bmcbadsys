import React, { useState } from 'react';
import {
  Settings,
  Save,
  AlertTriangle,
  CheckCircle2,
  Percent,
  Palette,
  Sparkles,
  Sun,
  Feather,
  Gamepad2,
  Check,
} from 'lucide-react';
import { ClubSettings, AppTheme } from '../types';
import { useAuth } from './AuthGate';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ClubSettings;
  onSaveSettings: (settings: ClubSettings) => void;
  onResetSampleData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onResetSampleData,
}) => {
  if (!isOpen) return null;

  const { user, resetCurrentAccountData } = useAuth();
  const [clubName, setClubName] = useState(settings.clubName);
  const [treasurerName, setTreasurerName] = useState(settings.treasurerName);
  const [valuationRate, setValuationRate] = useState(settings.shuttleValuationRate || 80);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(settings.theme || 'default');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'reset' | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      clubName,
      treasurerName,
      shuttleValuationRate: Number(valuationRate),
      theme: selectedTheme,
      logoUrl: settings.logoUrl,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const handleConfirmAction = async () => {
    if (confirmAction === 'reset') {
      try {
        setIsResetting(true);
        if (user && resetCurrentAccountData) {
          await resetCurrentAccountData();
        } else {
          onResetSampleData();
        }
        setConfirmAction(null);
        onClose();
      } catch (err) {
        console.error("Reset failed:", err);
      } finally {
        setIsResetting(false);
      }
    } else {
      setConfirmAction(null);
    }
  };

  const themeOptions: { id: AppTheme; name: string; subtitle: string; desc: string; icon: React.ReactNode; previewBg: string; badge: string }[] = [
    {
      id: 'default',
      name: 'デフォルト',
      subtitle: 'Modern Dark',
      desc: '洗練されたスレート＆エメラルド調の目に優しいダークモード',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
      previewBg: 'bg-slate-950 border-slate-700',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'clean_light',
      name: 'Clean Light',
      subtitle: 'クリーンライト',
      desc: '明るく清潔感があり、長時間利用しても疲れにくいライトテーマ',
      icon: <Sun className="w-4 h-4 text-emerald-600" />,
      previewBg: 'bg-white border-slate-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    {
      id: 'pixel',
      name: 'ピクセルアート',
      subtitle: 'Pixel Art (8-bit)',
      desc: 'レトロゲーム風のドット絵フォント＆アーケードスタイル',
      icon: <Gamepad2 className="w-4 h-4 text-amber-400" />,
      previewBg: 'bg-[#101428] border-indigo-500',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print overflow-y-auto">
      <div className="bg-surface rounded-2xl max-w-lg w-full shadow-2xl border border-border flex flex-col max-h-[90vh] my-auto relative">
        
        {/* Confirmation Modal */}
        {confirmAction && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50 rounded-2xl">
            <div className="bg-surface border border-border p-6 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl">
              <div className="text-rose-400">
                <AlertTriangle className="w-10 h-10 mx-auto" />
              </div>
              <h3 className="text-text font-bold text-center">
                {confirmAction === 'reset' ? 'アカウントデータの初期化' : ''}
              </h3>
              <p className="text-text-muted text-xs text-center leading-relaxed">
                {confirmAction === 'reset' 
                  ? user 
                    ? `現在ログイン中のアカウント（${user.email || user.displayName}）のクラウド帳簿・在庫・名簿データを初期化し、クリーンな新規状態に戻します。（※他のGoogleアカウントには影響しません）`
                    : '現在のデータは全て削除され、初期状態に戻ります。よろしいですか？' 
                  : ''}
              </p>
              <div className="flex gap-2 pt-1">
                <button 
                  type="button"
                  disabled={isResetting}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 bg-surface-subtle hover:bg-surface-hover border border-border rounded-xl text-text-muted font-bold text-xs cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  type="button"
                  disabled={isResetting}
                  onClick={handleConfirmAction}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 rounded-xl text-white font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-1 transition-all"
                >
                  {isResetting ? '初期化中...' : '初期化を実行'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Header - Fixed */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
            <Settings className="w-4 h-4 text-accent" />
            <span>クラブ設定 & 資産評価設定</span>
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
          {/* Scrollable Body */}
          <div className="p-5 sm:p-6 space-y-3 sm:space-y-4 text-xs overflow-y-auto flex-1">
          
          {/* Club Info Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-accent">
              チーム基本情報
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-text-muted mb-1.5">クラブ・サークル名</label>
                <input
                  type="text"
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-bold sm:leading-normal focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-bold text-text-muted mb-1.5">会計担当者 氏名</label>
                <input
                  type="text"
                  value={treasurerName}
                  onChange={(e) => setTreasurerName(e.target.value)}
                  className="w-full py-2 px-2.5 sm:p-2.5 bg-surface-subtle border border-border rounded-lg sm:rounded-xl text-text font-medium leading-snug sm:font-semibold sm:leading-normal focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Shuttle Inventory Asset Valuation Setting */}
          <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-text flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-accent" />
                <span>シャトル在庫 資産評価割合設定</span>
              </div>
              <span className="text-base font-black text-accent tabular-nums">
                {valuationRate}% 評価
              </span>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              クラブ解散時や売却処分を想定した、購入原価に対する資産評価額の算出レートです（デフォルト: 80%）。
            </p>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={valuationRate}
                onChange={(e) => setValuationRate(Number(e.target.value))}
                className="w-full h-2 bg-surface rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>

          {/* Theme Selector Section */}
          <div className="p-4 bg-surface-subtle rounded-xl border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-bold text-text flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-accent" />
                <span>画面デザイン・テーマ設定</span>
              </div>
              <span className="text-[11px] font-bold text-text-muted">
                {selectedTheme === 'default' ? 'デフォルト' : selectedTheme === 'clean_light' ? 'Clean Light' : 'ピクセルアート'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {themeOptions.map((opt) => {
                const isSelected = selectedTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedTheme(opt.id)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-surface shadow-md ring-1 ring-accent'
                        : 'border-border bg-surface/60 hover:border-border hover:bg-surface'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="p-1 rounded-full bg-surface-subtle">
                          {opt.icon}
                        </div>
                        {isSelected && (
                          <span className="flex items-center justify-center w-4 h-4 bg-accent rounded-full text-accent-text">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-text text-xs">
                        {opt.name}
                      </div>
                      <div className="text-[10px] text-text-muted font-medium">
                        {opt.subtitle}
                      </div>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 leading-tight">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dangerous Actions */}
          <div className="pt-2 border-t border-border space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-text font-medium block">アカウントデータの初期化</span>
                <span className="text-text-subtle text-[10px] block">
                  {user ? `${user.email} のデータを初期状態に戻します` : '全データを初期サンプルデータに戻します'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction('reset')}
                className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-colors"
              >
                初期化する
              </button>
            </div>
          </div>

          </div>

          {/* Footer - Fixed */}
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
              className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-accent-text font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>保存しました</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>設定を保存</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
