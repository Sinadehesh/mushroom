/**
 * ShroomLock Plus purchases. Android uses Google Play Billing (modules/play-billing); there's
 * no store on iOS (not built yet) or the web, where `nativeBilling` is null.
 */
import PlayBilling, { type PurchaseUpdate, type StoreProduct } from '../../modules/play-billing';
import { PLUS_PRODUCT_ID } from '../core/plus';

export type { PurchaseUpdate, StoreProduct };

/** "owned", "pending" (payment not through yet), "none", or null when Google Play couldn't be asked. */
export type PlusOwnership = 'owned' | 'pending' | 'none' | null;

const CONNECT_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), CONNECT_TIMEOUT_MS))]);
}

/** True when this build includes the billing module (Android). */
export const billingBuiltIn = PlayBilling !== null;

/** Whether Google Play purchases work on this phone (false without the Play Store). */
export async function billingAvailable(): Promise<boolean> {
  if (!PlayBilling) return false;
  return withTimeout(
    PlayBilling.connect().catch(() => false),
    false,
  );
}

/** Plus as listed in Play Console, with the local price; null if it isn't set up there. */
export async function getPlusProduct(): Promise<StoreProduct | null> {
  if (!PlayBilling) return null;
  return PlayBilling.getProduct(PLUS_PRODUCT_ID);
}

/** Opens Google Play's purchase sheet; the result arrives through `onPurchaseUpdate`. */
export async function buyPlus(): Promise<void> {
  if (!PlayBilling) throw new Error('Purchases aren’t available in this version of ShroomLock');
  await PlayBilling.purchase(PLUS_PRODUCT_ID);
}

export async function plusOwnership(): Promise<PlusOwnership> {
  if (!PlayBilling || !(await billingAvailable())) return null;
  try {
    const owned = await PlayBilling.getOwnedProducts();
    const plus = owned.find((p) => p.productId === PLUS_PRODUCT_ID);
    return plus ? (plus.state === 'purchased' ? 'owned' : 'pending') : 'none';
  } catch {
    return null;
  }
}

/** Purchase-sheet outcomes for Plus. Returns an unsubscribe function. */
export function onPurchaseUpdate(listener: (update: PurchaseUpdate) => void): () => void {
  if (!PlayBilling) return () => {};
  const sub = PlayBilling.addListener('onPurchaseUpdate', (update) => {
    if (!update.productId || update.productId === PLUS_PRODUCT_ID) listener(update);
  });
  return () => sub.remove();
}
