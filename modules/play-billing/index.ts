import { requireOptionalNativeModule, type NativeModule } from 'expo';

export type PurchaseState = 'purchased' | 'pending' | 'cancelled' | 'error';

/** Google Play's product types: a one-time product, or a subscription. */
export type ProductType = 'inapp' | 'subs';

export interface PurchaseUpdate {
  productId?: string;
  state: PurchaseState;
  message?: string;
}

export interface StoreProduct {
  productId: string;
  type: ProductType;
  title: string;
  description: string;
  /** Formatted in the user's currency, e.g. "$5.99". */
  price: string | null;
  /** A subscription's billing period (ISO 8601, e.g. "P1M"); null for a one-time product. */
  period: string | null;
}

export interface OwnedProduct {
  productId: string;
  type: ProductType;
  state: 'purchased' | 'pending';
}

declare class PlayBillingNativeModule extends NativeModule<{ onPurchaseUpdate: (update: PurchaseUpdate) => void }> {
  connect(): Promise<boolean>;
  getProduct(productId: string, type: ProductType): Promise<StoreProduct | null>;
  purchase(productId: string, type: ProductType): Promise<void>;
  getOwnedProducts(): Promise<OwnedProduct[]>;
}

/** Android only. `null` on iOS, on the web, and in Expo Go. */
export default requireOptionalNativeModule<PlayBillingNativeModule>('PlayBilling');
