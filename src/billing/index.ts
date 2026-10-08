/**
 * ShroomLock Plus purchases: a one-time purchase or a monthly subscription. Android uses Google
 * Play Billing (modules/play-billing); there's no store on iOS (not built yet) or the web, where
 * `PlayBilling` is null.
 */
import PlayBilling, { type ProductType, type PurchaseUpdate, type StoreProduct } from '../../modules/play-billing';
import { plusFromOwned, PLUS_MONTHLY_ID, PLUS_PRODUCT_ID, type PlusPlan } from '../core/plus';

export type { PlusPlan, PurchaseUpdate, StoreProduct };

/** "owned", "pending" (payment not through yet), "none", or null when Google Play couldn't be asked. */
export type PlusOwnership = 'owned' | 'pending' | 'none' | null;

const PLANS: Record<PlusPlan, { id: string; type: ProductType }> = {
  lifetime: { id: PLUS_PRODUCT_ID, type: 'inapp' },
  monthly: { id: PLUS_MONTHLY_ID, type: 'subs' },
};

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

/** The two ways to buy Plus as listed in Play Console, with local prices; null where one isn't set up. */
export async function getPlusOffers(): Promise<Record<PlusPlan, StoreProduct | null>> {
  const get = (plan: PlusPlan) =>
    PlayBilling ? PlayBilling.getProduct(PLANS[plan].id, PLANS[plan].type).catch(() => null) : Promise.resolve(null);
  const [lifetime, monthly] = await Promise.all([get('lifetime'), get('monthly')]);
  return { lifetime, monthly };
}

/** Opens Google Play's purchase sheet; the result arrives through `onPurchaseUpdate`. */
export async function buyPlus(plan: PlusPlan): Promise<void> {
  if (!PlayBilling) throw new Error('Purchases aren’t available in this version of ShroomLock');
  await PlayBilling.purchase(PLANS[plan].id, PLANS[plan].type);
}

/** Whether this Google account has Plus, and through which plan. */
export async function plusStatus(): Promise<{ ownership: PlusOwnership; plan: PlusPlan | null }> {
  if (!PlayBilling || !(await billingAvailable())) return { ownership: null, plan: null };
  try {
    const { status, plan } = plusFromOwned(await PlayBilling.getOwnedProducts());
    return { ownership: status, plan };
  } catch {
    return { ownership: null, plan: null };
  }
}

export async function plusOwnership(): Promise<PlusOwnership> {
  return (await plusStatus()).ownership;
}

/** Google Play's page for managing (or cancelling) the monthly subscription (package name as in app.json). */
export const MANAGE_SUBSCRIPTION_URL = `https://play.google.com/store/account/subscriptions?sku=${PLUS_MONTHLY_ID}&package=com.shroomlock.app`;

/** "P1M" → "month", "P1Y" → "year", "P1W" → "week"; anything else as Play wrote it. */
export function periodName(period: string | null): string {
  if (period === 'P1M') return 'month';
  if (period === 'P1Y') return 'year';
  if (period === 'P1W') return 'week';
  return period ?? 'month';
}

/** Purchase-sheet outcomes for Plus. Returns an unsubscribe function. */
export function onPurchaseUpdate(listener: (update: PurchaseUpdate) => void): () => void {
  if (!PlayBilling) return () => {};
  const sub = PlayBilling.addListener('onPurchaseUpdate', (update) => {
    if (!update.productId || update.productId === PLUS_PRODUCT_ID || update.productId === PLUS_MONTHLY_ID) listener(update);
  });
  return () => sub.remove();
}
