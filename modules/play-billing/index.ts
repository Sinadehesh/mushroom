import { requireOptionalNativeModule, type NativeModule } from 'expo';

export type PurchaseState = 'purchased' | 'pending' | 'cancelled' | 'error';

export interface PurchaseUpdate {
  productId?: string;
  state: PurchaseState;
  message?: string;
}

export interface StoreProduct {
  productId: string;
  title: string;
  description: string;
  /** Formatted in the user's currency, e.g. "$5.99". */
  price: string | null;
}

export interface OwnedProduct {
  productId: string;
  state: 'purchased' | 'pending';
}

declare class PlayBillingNativeModule extends NativeModule<{ onPurchaseUpdate: (update: PurchaseUpdate) => void }> {
  connect(): Promise<boolean>;
  getProduct(productId: string): Promise<StoreProduct | null>;
  purchase(productId: string): Promise<void>;
  getOwnedProducts(): Promise<OwnedProduct[]>;
}

/** Android only. `null` on iOS, on the web, and in Expo Go. */
export default requireOptionalNativeModule<PlayBillingNativeModule>('PlayBilling');
