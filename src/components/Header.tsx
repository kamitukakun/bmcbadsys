import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart3, 
  BookOpen, 
  Users, 
  Calculator, 
  Package, 
  Target, 
  PlusCircle, 
  Settings, 
  Printer, 
  CircleDollarSign,
  Swords,
  User,
  LogOut,
  RefreshCw,
  Cloud,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { ClubSettings } from '../types';
import { useAuth } from './AuthGate';

export type NavTab = 'dashboard' | 'doubles' | 'calculator' | 'shuttles' | 'reimbursements' | 'ledger' | 'members' | 'budget';

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  badge?: string;
  badgeColor?: string;
}

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  settings: ClubSettings;
  currentBalance: number;
  unreimbursedDebtAmount: number;
  inactiveMembersCount: number;
  lowStockShuttleCount: number;
  onOpenNewTransaction: () => void;
  onOpenSettings: () => void;
  onOpenReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  settings,
  currentBalance,
  unreimbursedDebtAmount,
  inactiveMembersCount,
  lowStockShuttleCount,
  onOpenNewTransaction,
  onOpenSettings,
  onOpenReport,
}) => {
  const dailyTabs: TabItem[] = [
    { id: 'dashboard' as NavTab, label: 'ダッシュボード', icon: BarChart3 },
    { 
      id: 'doubles' as NavTab, 
      label: 'ダブルス組合せ', 
      icon: Swords,
    },
    { 
      id: 'calculator' as NavTab, 
      label: '参加費管理', 
      icon: Calculator,
      highlight: true,
    },
  ];

  const managementTabs: TabItem[] = [
    { 
      id: 'shuttles' as NavTab, 
      label: 'シャトル管理', 
      icon: Package,
      badge: lowStockShuttleCount > 0 ? `要補充` : undefined,
      badgeColor: 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
    },
    { 
      id: 'reimbursements' as NavTab, 
      label: '立替金・借入精算', 
      icon: CircleDollarSign,
      badge: unreimbursedDebtAmount > 0 ? `${formatCurrency(unreimbursedDebtAmount)}返済待` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
    },
    { id: 'ledger' as NavTab, label: '収支出納帳', icon: BookOpen },
    { 
      id: 'members' as NavTab, 
      label: '名簿管理', 
      icon: Users,
      badge: inactiveMembersCount > 0 ? `未参加 ${inactiveMembersCount}名` : undefined,
      badgeColor: 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
    },
    { id: 'budget' as NavTab, label: '年間予算計画', icon: Target },
  ];

  const tabs = [...dailyTabs, ...managementTabs];
  const isManagementTabActive = managementTabs.some(tab => tab.id === currentTab);
  const activeManagementTab = managementTabs.find(tab => tab.id === currentTab);

  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { user, syncStatus, saveToCloud, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const updateMoreMenuPosition = useCallback(() => {
    if (moreBtnRef.current) {
      const rect = moreBtnRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate right position with minimum 8px padding from viewport edge
      const right = Math.max(8, viewportWidth - rect.right);
      
      // Calculate top position, ensure it fits in viewport
      const menuApproxHeight = 280;
      const fitsBelow = rect.bottom + menuApproxHeight <= viewportHeight;
      const top = fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - menuApproxHeight - 6);
      
      setMoreMenuPosition({ top, right });
    }
  }, []);

  const toggleMoreMenu = () => {
    if (!isMoreMenuOpen) {
      updateMoreMenuPosition();
      setIsMoreMenuOpen(true);
    } else {
      setIsMoreMenuOpen(false);
    }
  };

  // Handle position tracking, resize, scroll, and escape key for more menu
  useEffect(() => {
    if (!isMoreMenuOpen) return;

    updateMoreMenuPosition();

    const handleScrollOrResize = () => {
      updateMoreMenuPosition();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreMenuOpen, updateMoreMenuPosition]);

  // Close dropdown on outside click or escape key
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  // Center the active tab in the horizontally scrolling navigation bar
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Only scroll if the active tab is visible inside the nav (e.g. daily tabs, or all tabs on PC)
    const activeBtn = tabRefs.current[currentTab];
    if (!activeBtn || activeBtn.offsetParent === null) return;

    const frameId = requestAnimationFrame(() => {
      if (nav.scrollWidth <= nav.clientWidth) {
        if (nav.scrollLeft !== 0) {
          nav.scrollTo({ left: 0, behavior: 'smooth' });
        }
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      const currentScroll = nav.scrollLeft;
      const targetScrollLeft = currentScroll + (btnRect.left - navRect.left) + (activeBtn.clientWidth / 2) - (nav.clientWidth / 2);

      nav.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [currentTab]);

  return (
    <header className="bg-header-bg/95 backdrop-blur-md border-b border-header-border sticky top-0 z-30 shadow-md no-print text-header-text">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
          
          {/* Account Avatar & Club Info */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                id="header-btn-user-menu"
                type="button"
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                className="relative rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer shadow-md ring-2 ring-accent/20 focus:outline-none focus:ring-2 focus:ring-accent flex items-center justify-center w-10 h-10"
                aria-label="アカウントメニューを開く"
                aria-expanded={isUserMenuOpen}
                title={user ? `アカウント: ${user.email || user.displayName || 'ユーザー'}` : 'アカウントメニュー'}
              >
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center text-accent-text bg-accent">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || user.email || 'ユーザー'}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-5 h-5 text-accent-text" />
                  )}
                </div>
                {/* クラウド同期ステータスインジケーター */}
                {user && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-header-bg ${
                      syncStatus === 'syncing'
                        ? 'bg-sky-400 animate-pulse'
                        : syncStatus === 'synced'
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                    }`}
                    title={
                      syncStatus === 'syncing'
                        ? 'クラウド同期中'
                        : syncStatus === 'synced'
                          ? 'クラウド同期完了'
                          : 'オフライン保存'
                    }
                  />
                )}
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && user && (
                <div
                  className="absolute left-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl p-4 space-y-3 z-50 text-text animate-fade-in"
                  style={{ minWidth: '260px' }}
                >
                  {/* User Info Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-surface-subtle border border-border flex items-center justify-center overflow-hidden shrink-0 text-text">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || user.email || 'ユーザー'}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="w-5 h-5 text-text-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-text-muted font-bold tracking-wider uppercase">ログイン中</div>
                      <div className="text-xs sm:text-sm font-black text-text truncate" title={user.email || user.displayName || ''}>
                        {user.email || user.displayName}
                      </div>
                      {user.displayName && user.email && (
                        <div className="text-[11px] text-text-muted truncate">
                          {user.displayName}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sync Status Info */}
                  <div className="bg-surface-subtle border border-border rounded-xl p-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        syncStatus === 'syncing'
                          ? 'bg-sky-400 animate-pulse'
                          : syncStatus === 'synced'
                            ? 'bg-accent animate-pulse'
                            : 'bg-amber-400'
                      }`} />
                      <span className="text-text-muted font-medium shrink-0">同期状況:</span>
                    </div>
                    <div className="shrink-0">
                      {syncStatus === 'syncing' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-500">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>同期中...</span>
                        </span>
                      ) : syncStatus === 'synced' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                          <span>☁ クラウド同期完了</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            saveToCloud();
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          <span>⚠ オフライン保存 (再試行)</span>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Logout Button */}
                  <div className="pt-1">
                    <button
                      id="header-btn-logout"
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        await logout();
                      }}
                      className="w-full py-2.5 px-3 bg-surface-subtle hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-border hover:border-rose-500/30 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer active:scale-[0.99]"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>ログアウト</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-bold text-header-text leading-tight tracking-tight truncate max-w-[200px] sm:max-w-none">
                  {settings.clubName}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-accent/15 text-accent border border-accent/30 shrink-0">
                  運営費管理システム
                </span>
              </div>
              <p className="text-xs text-header-text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                <span>会計担当: <strong className="text-header-text font-medium">{settings.treasurerName || '未設定'}</strong></span>
                <span className="opacity-40 hidden sm:inline">|</span>
                <span className="text-[11px] text-header-text-muted opacity-80 sm:text-xs">年度: 4月期〜翌3月</span>
              </p>
            </div>
          </div>

          {/* Quick Balance Summary & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2 justify-between sm:justify-end">
            {/* Balance Pill */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-3 sm:px-4 py-1.5 flex items-center gap-2.5 shadow-inner grow sm:grow-0">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">クラブ現在残高</div>
                <div className="text-xs sm:text-base font-extrabold text-white tabular-nums">
                  {formatCurrency(currentBalance)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Print Report */}
              <button
                id="header-btn-print-report"
                onClick={onOpenReport}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shadow-sm"
                title="決算報告書・収支計算書を印刷/プレビュー"
              >
                <Printer className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">決算書印刷</span>
              </button>

              {/* Settings */}
              <button
                id="header-btn-settings"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shadow-sm"
                title="クラブ設定 & データバックアップ"
              >
                <Settings className="w-4 h-4 text-slate-300" />
                <span className="hidden sm:inline">設定</span>
              </button>

              {/* Quick Record Button */}
              <button
                id="header-btn-new-transaction"
                onClick={onOpenNewTransaction}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-accent-text bg-accent hover:bg-accent-hover active:opacity-90 rounded-xl transition-all shadow-md cursor-pointer whitespace-nowrap min-h-[38px]"
              >
                <PlusCircle className="w-4 h-4 text-accent-text shrink-0" />
                <span>収支を記帳</span>
              </button>
            </div>
          </div>

        </div>

        {/* Navigation Tabs Bar */}
        <div className="border-t border-header-border py-2 flex items-center justify-between gap-1.5">
          {/* 横スクロール領域 (日常グループ3タブ + PC時は管理グループ5タブ) */}
          <div className="relative flex-1 min-w-0">
            <nav 
              ref={navRef}
              className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* 「日常」グループ (3タブ: ダッシュボード、ダブルス組合せ、参加費管理) - 常時表示 */}
              {dailyTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    onClick={() => onSelectTab(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-accent border border-slate-700 shadow-sm px-3 sm:px-3.5 py-2'
                        : 'text-header-text-muted hover:text-header-text hover:bg-slate-800/50 px-2.5 sm:px-3.5 py-2'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-header-text-muted'}`} />
                    <span className={isActive ? 'inline' : 'hidden sm:inline'}>{tab.label}</span>
                    
                    {tab.badge && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* PC・タブレット(sm以上)用のセパレーター (細い縦の区切り線) */}
              <div 
                className="hidden sm:block w-px h-5 bg-header-border mx-1 shrink-0 self-center" 
                aria-hidden="true" 
              />

              {/* 「管理」グループ (5タブ: シャトル管理、立替金・借入精算、収支出納帳、名簿管理、年間予算計画) - sm以上で表示 */}
              {managementTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    onClick={() => onSelectTab(tab.id)}
                    className={`hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-slate-800 text-accent border border-slate-700 shadow-sm'
                        : 'text-header-text-muted hover:text-header-text hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-header-text-muted'}`} />
                    <span>{tab.label}</span>
                    
                    {tab.badge && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* スマホ(sm未満)用の「その他」ボタングループ（スクロール領域の外側に常時固定表示） */}
          <div className="sm:hidden shrink-0 pl-1 border-l border-header-border/40">
            <button
              id="header-nav-btn-more"
              ref={moreBtnRef}
              type="button"
              onClick={toggleMoreMenu}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isManagementTabActive
                  ? 'bg-slate-800 text-accent border border-slate-700 shadow-sm'
                  : 'text-header-text-muted hover:text-header-text hover:bg-slate-800/50'
              }`}
              aria-expanded={isMoreMenuOpen}
              aria-label="その他の管理メニュー"
            >
              <MoreHorizontal className={`w-4 h-4 ${isManagementTabActive ? 'text-accent' : 'text-header-text-muted'}`} />
              {isManagementTabActive && activeManagementTab && (
                <span className="text-[10px] text-accent/80 font-normal max-w-[70px] truncate">
                  ({activeManagementTab.label})
                </span>
              )}
              {/* 管理グループ内の要対応バッジ表示 */}
              {isManagementTabActive && activeManagementTab?.badge ? (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${activeManagementTab.badgeColor}`}>
                  {activeManagementTab.badge}
                </span>
              ) : (!isManagementTabActive && (lowStockShuttleCount > 0 || unreimbursedDebtAmount > 0 || inactiveMembersCount > 0)) ? (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="管理メニューに確認事項あり" />
              ) : null}
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180 text-accent' : 'text-header-text-muted'}`} />
            </button>
          </div>
        </div>

      </div>

      {/* スマホ用「その他」ドロップダウン (Portal経由でbody直下に配置し、overflow-x-autoのクリップを完全回避) */}
      {isMoreMenuOpen && moreMenuPosition && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100]" id="more-nav-portal-root">
          {/* 半透明バックドロップ（画面外タップで確実に閉じる） */}
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity" 
            onClick={() => setIsMoreMenuOpen(false)}
            aria-hidden="true"
          />

          {/* ドロップダウンメニュー本体 */}
          <div 
            className="fixed bg-surface border border-border rounded-2xl shadow-2xl p-2 z-[101] text-text space-y-1 animate-fade-in w-64 max-w-[calc(100vw-16px)]"
            style={{
              top: `${moreMenuPosition.top}px`,
              right: `${moreMenuPosition.right}px`,
            }}
            role="menu"
            aria-label="管理グループメニュー"
          >
            <div className="px-3 py-1.5 text-[10px] font-bold text-text-subtle tracking-wider uppercase border-b border-border/50 mb-1 flex items-center justify-between">
              <span>管理グループ</span>
              <span className="text-[9px] text-text-muted font-normal">全5タブ</span>
            </div>
            {managementTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectTab(tab.id);
                    setIsMoreMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'bg-accent/15 text-accent border border-accent/30 font-black'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${tab.badgeColor}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
