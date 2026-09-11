import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  firebaseSignOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  FirebaseUser,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { AppState } from '../types';
import { INITIAL_APP_STATE } from '../data/initialData';
import { loadAppState, saveAppState, resetAppState } from '../utils/storage';
import { LogIn, UserPlus, Mail, Lock, ShieldCheck, RefreshCw, AlertCircle, LogOut } from 'lucide-react';

export interface AuthContextType {
  user: FirebaseUser | null;
  syncStatus: 'synced' | 'syncing' | 'offline';
  resetCurrentAccountData: () => Promise<void>;
  saveToCloud: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  syncStatus: 'synced',
  resetCurrentAccountData: async () => {},
  saveToCloud: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthGateProps {
  children: React.ReactNode;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children, state, setState }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  // Tracks which user's data is currently loaded in React state to prevent cross-account pollution
  const loadedUserIdRef = useRef<string | null>(null);

  // Inactivity Auto-Logout (30 minutes)
  useEffect(() => {
    if (!user) return;

    const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 minutes
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(async () => {
        try {
          loadedUserIdRef.current = null;
          setState(INITIAL_APP_STATE);
          await firebaseSignOut(auth);
          setLogoutReason('一定時間操作がなかったため、安全のためログアウトしました。');
        } catch (err) {
          console.error("Auto logout error:", err);
        }
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Set initial timer
    resetTimer();

    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, setState]);

  // Helper to remove undefined values for Firestore
  const cleanObject = (obj: any): any => {
    if (obj === undefined || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(cleanObject);
    if (typeof obj === 'object') {
      const newObj: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          newObj[key] = cleanObject(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  };

  // Listen to Auth State with strict account isolation
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (!firebaseUser) {
        // Logged out: strictly wipe state from memory to prevent data leakage to other accounts
        loadedUserIdRef.current = null;
        setState(INITIAL_APP_STATE);
        setLoading(false);
        return;
      }

      // User logged in: keep loading active while fetching user's isolated data
      setLoading(true);
      setSyncStatus('syncing');

      try {
        const docRef = doc(db, 'club_app_data', firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const remoteData = docSnap.data() as AppState;
          if (remoteData && remoteData.transactions && remoteData.members) {
            const merged: AppState = {
              ...INITIAL_APP_STATE,
              ...remoteData,
              settings: {
                ...INITIAL_APP_STATE.settings,
                ...(remoteData.settings || {}),
              },
            };
            setState(merged);
            saveAppState(merged, firebaseUser.uid);
          } else {
            // Corrupted data document: reset to clean state
            setState(INITIAL_APP_STATE);
            saveAppState(INITIAL_APP_STATE, firebaseUser.uid);
            await setDoc(docRef, cleanObject(INITIAL_APP_STATE));
          }
        } else {
          // BRAND NEW USER:
          // Strictly initialize with fresh INITIAL_APP_STATE. NEVER inherit previous user's data!
          setState(INITIAL_APP_STATE);
          saveAppState(INITIAL_APP_STATE, firebaseUser.uid);
          await setDoc(docRef, cleanObject(INITIAL_APP_STATE));
        }

        loadedUserIdRef.current = firebaseUser.uid;
        setSyncStatus('synced');
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `club_app_data/${firebaseUser.uid}`);
        // Fallback to local cache for THIS user only
        const localData = loadAppState(firebaseUser.uid);
        setState(localData);
        loadedUserIdRef.current = firebaseUser.uid;
        setSyncStatus('offline');
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setState]);

  // Sync state changes to Firestore & user-scoped localStorage when user is logged in
  const saveToCloud = async () => {
    if (!user || loadedUserIdRef.current !== user.uid) {
      // Abort if state does not belong to the currently logged in user
      return;
    }
    setSyncStatus('syncing');
    try {
      // 1. Immediately save to user-scoped localStorage
      saveAppState(state, user.uid);

      // 2. Save to cloud Firestore
      const docRef = doc(db, 'club_app_data', user.uid);
      const cleanedState = cleanObject(state);
      await setDoc(docRef, cleanedState, { merge: true });
      setSyncStatus('synced');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `club_app_data/${user.uid}`);
      setSyncStatus('offline');
    }
  };

  useEffect(() => {
    if (!user || loadedUserIdRef.current !== user.uid) return;
    // Persist to user-scoped localStorage immediately on changes
    saveAppState(state, user.uid);
    // Debounce cloud sync
    const timer = setTimeout(saveToCloud, 1200);
    return () => clearTimeout(timer);
  }, [state, user]);

  // Reset the current account's cloud & local data to a clean slate
  const resetCurrentAccountData = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      setState(INITIAL_APP_STATE);
      resetAppState(user.uid);
      const docRef = doc(db, 'club_app_data', user.uid);
      await setDoc(docRef, cleanObject(INITIAL_APP_STATE));
      setSyncStatus('synced');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `club_app_data/${user.uid}`);
      setSyncStatus('offline');
      throw err;
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError(null);
    setLogoutReason(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-in Error:', err);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('ログインポップアップが閉じられました。');
      } else if (code === 'auth/popup-blocked') {
        setError('ブラウザのポップアップがブロックされました。ブラウザ設定でポップアップを許可するか、Safari/Chrome通常ウィンドウでお試しください。');
      } else if (code === 'auth/access_denied' || err?.message?.includes('access_denied') || err?.message?.includes('unverified')) {
        setError('Googleアカウントの承認が許可されていません。Google Cloud ConsoleのOAuth同意画面で「アプリを公開」にするか、テストユーザーに対象アドレスを追加してください。');
      } else {
        setError(err.message || 'Googleログインに失敗しました。時間をおいて再試行してください。');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      loadedUserIdRef.current = null;
      setState(INITIAL_APP_STATE);
      setUser(null);
      await firebaseSignOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text">
        <RefreshCw className="w-8 h-8 text-accent animate-spin mb-3" />
        <p className="text-sm font-medium text-text-muted">アカウントデータを読み込み中...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-accent/20 border border-accent/40 rounded-full flex items-center justify-center mx-auto mb-4 text-accent shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-text tracking-tight">バドミントンクラブ管理システム</h1>
            <p className="text-xs text-text-muted mt-1">Googleアカウントごとに独立した安全なクラウドデータベース</p>
          </div>

          {logoutReason && (
            <div className="mb-5 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{logoutReason}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-3 text-sm ${
                isLoggingIn ? 'opacity-60 cursor-wait' : 'cursor-pointer'
              }`}
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-5 h-5 text-slate-700 animate-spin" />
                  <span>Google認証中...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Googleアカウントでログイン</span>
                </>
              )}
            </button>

            <div className="p-3 bg-surface-subtle rounded-xl border border-border text-[11px] text-text-muted space-y-1">
              <p className="font-semibold text-text">💡 アカウントについて</p>
              <ul className="list-disc list-inside space-y-0.5 text-text-muted">
                <li>ログインするGoogleアカウントごとに、個別のクラブデータが独立して安全に保存されます。</li>
                <li>ポップアップが開かない場合は、ブラウザのポップアップブロックを解除してください。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      syncStatus,
      resetCurrentAccountData,
      saveToCloud,
      logout: handleLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
};
