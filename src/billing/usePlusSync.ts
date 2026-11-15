import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { blocker } from '../blocker';
import { allowedLockedApps } from '../core/plus';
import { shareFamilyPlus } from '../family';
import { useStore } from '../state/store';
import { onPurchaseUpdate, plusOwnership } from '.';

/**
 * Keeps the Plus flag in step with Google Play: checked when ShroomLock opens or returns to the
 * front, and set as soon as a purchase completes. The sister apps are told too, for their
 * family price (only Google Play's answer is shared, never a review code). When Play confirms
 * Plus isn't owned (e.g. after a refund), locked apps beyond the free limit are released. If
 * Play can't be reached, the last known answer stands.
 */
export function usePlusSync() {
  const { state, dispatch } = useStore();
  const { hydrated } = state;
  // Read at check time: a review-code unlock means no locked apps get released.
  const codeUnlock = useRef(state.codeUnlock);
  codeUnlock.current = state.codeUnlock;

  useEffect(() => {
    if (!hydrated) return;
    const check = () =>
      plusOwnership().then((owned) => {
        if (owned === null || owned === 'pending') return;
        const plus = owned === 'owned';
        dispatch({ type: 'setPlus', plus });
        if (!plus && !codeUnlock.current) {
          const locked = blocker.getBlockedApps();
          const allowed = allowedLockedApps(locked, false);
          if (allowed.length < locked.length) blocker.setBlockedApps(allowed);
        }
      });
    check();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && check());
    const purchases = onPurchaseUpdate((u) => u.state === 'purchased' && dispatch({ type: 'setPlus', plus: true }));
    return () => {
      appState.remove();
      purchases();
    };
  }, [hydrated, dispatch]);

  // Tell the sister apps whenever Plus changes here (purchase, restore, refund). `plus` only
  // ever comes from Google Play; a review code is kept apart (codeUnlock) and isn't shared.
  useEffect(() => {
    if (hydrated) shareFamilyPlus(state.plus);
  }, [hydrated, state.plus]);
}
