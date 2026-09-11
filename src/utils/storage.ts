import { AppState } from '../types';
import { INITIAL_APP_STATE } from '../data/initialData';
import { getTodayString } from './dateUtils';

const BASE_STORAGE_KEY = 'badminton_club_finance_state_v2';
const LEGACY_STORAGE_KEY = 'badminton_club_finance_state_v1';

export function getStorageKey(userId?: string): string {
  if (userId) {
    return `${BASE_STORAGE_KEY}_user_${userId}`;
  }
  return `${BASE_STORAGE_KEY}_guest`;
}

export function loadAppState(userId?: string): AppState {
  try {
    const key = getStorageKey(userId);
    let serialized = localStorage.getItem(key);

    // If no data under user-scoped key and no userId is provided, check legacy key
    if (!serialized && !userId) {
      serialized = localStorage.getItem(LEGACY_STORAGE_KEY);
    }

    if (!serialized) {
      return INITIAL_APP_STATE;
    }
    const parsed = JSON.parse(serialized);
    // Ensure all critical fields exist
    return {
      ...INITIAL_APP_STATE,
      ...parsed,
      settings: {
        ...INITIAL_APP_STATE.settings,
        ...(parsed.settings || {}),
      },
    };
  } catch (err) {
    console.error('Failed to load state from localStorage', err);
    return INITIAL_APP_STATE;
  }
}

export function saveAppState(state: AppState, userId?: string): void {
  try {
    const key = getStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage', err);
  }
}

export function resetAppState(userId?: string): AppState {
  try {
    const key = getStorageKey(userId);
    localStorage.removeItem(key);
    if (!userId) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch (err) {
    console.error(err);
  }
  return INITIAL_APP_STATE;
}

export function exportAppStateFile(state: AppState) {
  const jsonStr = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = getTodayString();
  const filename = `${state.settings.clubName}_会計データバックアップ_${dateStr}.json`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
