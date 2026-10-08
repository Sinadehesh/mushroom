package expo.modules.playbilling

import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val EVENT = "onPurchaseUpdate"

/**
 * One-time products and subscriptions through Google Play Billing. Functions take the product
 * type as Play names it: "inapp" (one-time) or "subs" (subscription). The purchase flow's outcome
 * arrives as an `onPurchaseUpdate` event: { productId, state: purchased | pending | cancelled | error }.
 * Purchases are acknowledged here as soon as they complete; Google refunds unacknowledged
 * purchases after three days.
 */
class PlayBillingModule : Module() {
  private var client: BillingClient? = null
  private val waiting = mutableListOf<(BillingResult) -> Unit>()
  private val details = mutableMapOf<String, ProductDetails>()

  private val purchasesListener = PurchasesUpdatedListener { result, purchases ->
    when (result.responseCode) {
      BillingResponseCode.OK -> purchases?.forEach(::handlePurchase)
      BillingResponseCode.USER_CANCELED -> sendEvent(EVENT, mapOf("state" to "cancelled"))
      // Bought before (e.g. on another phone): report what Play says we own.
      BillingResponseCode.ITEM_ALREADY_OWNED -> queryOwned { list -> list.forEach { handlePurchase(it.second) } }
      else -> sendEvent(EVENT, mapOf("state" to "error", "message" to describe(result)))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("PlayBilling")

    Events(EVENT)

    OnDestroy {
      client?.endConnection()
      client = null
    }

    /** Resolves true when Google Play Billing is available (false on phones without the Play Store). */
    AsyncFunction("connect") { promise: Promise ->
      withClient { result -> promise.resolve(result.responseCode == BillingResponseCode.OK) }
    }

    /**
     * Store listing of a product, with the price in the user's currency and, for a subscription,
     * its base plan's billing period (ISO 8601, e.g. "P1M"); null if not set up in Play Console.
     */
    AsyncFunction("getProduct") { productId: String, type: String, promise: Promise ->
      productDetails(productId, type) { pd, error ->
        if (pd == null) {
          if (error == null) promise.resolve(null) else promise.reject("ERR_BILLING", error, null)
          return@productDetails
        }
        val phase = basePlan(pd)?.pricingPhases?.pricingPhaseList?.lastOrNull()
        promise.resolve(
          mapOf(
            "productId" to pd.productId,
            "type" to type,
            "title" to pd.name,
            "description" to pd.description,
            "price" to (if (type == ProductType.SUBS) phase?.formattedPrice else pd.oneTimePurchaseOfferDetails?.formattedPrice),
            "period" to (if (type == ProductType.SUBS) phase?.billingPeriod else null),
          ),
        )
      }
    }

    /** Opens Google Play's purchase sheet. Resolves once it's shown; the outcome comes as an event. */
    AsyncFunction("purchase") { productId: String, type: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "ShroomLock isn't in the foreground", null)
        return@AsyncFunction
      }
      productDetails(productId, type) { pd, error ->
        if (pd == null) {
          promise.reject("ERR_BILLING", error ?: "Product $productId isn't available in Google Play", null)
          return@productDetails
        }
        val product = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd)
        if (type == ProductType.SUBS) {
          val offer = basePlan(pd)
          if (offer == null) {
            promise.reject("ERR_BILLING", "The subscription has no active plan in Google Play", null)
            return@productDetails
          }
          product.setOfferToken(offer.offerToken)
        }
        val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(product.build())).build()
        activity.runOnUiThread {
          val result = client?.launchBillingFlow(activity, params)
          if (result?.responseCode == BillingResponseCode.OK) {
            promise.resolve(null)
          } else {
            promise.reject("ERR_BILLING", result?.let(::describe) ?: "Not connected to Google Play", null)
          }
        }
      }
    }

    /**
     * One-time products this Google account owns and subscriptions it has active (Play lists a
     * subscription until it ends, cancelled or not), from Play's local cache (works offline):
     * [{ productId, type, state: purchased | pending }]. Also acknowledges any completed purchase
     * that wasn't yet, e.g. a pending payment that went through while the app was closed.
     */
    AsyncFunction("getOwnedProducts") { promise: Promise ->
      withClient { result ->
        if (result.responseCode != BillingResponseCode.OK) {
          promise.reject("ERR_BILLING", describe(result), null)
          return@withClient
        }
        queryOwned(onError = { promise.reject("ERR_BILLING", it, null) }) { purchases ->
          purchases.map { it.second }
            .filter { it.purchaseState == Purchase.PurchaseState.PURCHASED && !it.isAcknowledged }
            .forEach(::acknowledge)
          promise.resolve(
            purchases.flatMap { (type, p) ->
              val state = stateOf(p) ?: return@flatMap emptyList<Map<String, String>>()
              p.products.map { mapOf("productId" to it, "type" to type, "state" to state) }
            },
          )
        }
      }
    }
  }

  // --- Connection ----------------------------------------------------------------

  /** Runs `then` once connected (or with the failure), connecting first if needed. */
  private fun withClient(then: (BillingResult) -> Unit) {
    val existing = client
    if (existing != null && existing.isReady) {
      then(BillingResult.newBuilder().setResponseCode(BillingResponseCode.OK).build())
      return
    }
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    synchronized(waiting) {
      waiting.add(then)
      if (waiting.size > 1) return // a connection attempt is already running
    }
    val c = existing ?: BillingClient.newBuilder(context)
      .setListener(purchasesListener)
      .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
      .enableAutoServiceReconnection()
      .build()
      .also { client = it }
    c.startConnection(object : BillingClientStateListener {
      override fun onBillingSetupFinished(result: BillingResult) = flush(result)

      override fun onBillingServiceDisconnected() {
        flush(BillingResult.newBuilder().setResponseCode(BillingResponseCode.SERVICE_DISCONNECTED).build())
      }
    })
  }

  private fun flush(result: BillingResult) {
    val callbacks = synchronized(waiting) { waiting.toList().also { waiting.clear() } }
    callbacks.forEach { it(result) }
  }

  // --- Products and purchases ------------------------------------------------------

  private fun productDetails(productId: String, type: String, then: (ProductDetails?, String?) -> Unit) {
    val key = "$type:$productId"
    details[key]?.let { return then(it, null) }
    withClient { result ->
      if (result.responseCode != BillingResponseCode.OK) return@withClient then(null, describe(result))
      val params = QueryProductDetailsParams.newBuilder()
        .setProductList(
          listOf(
            QueryProductDetailsParams.Product.newBuilder()
              .setProductId(productId)
              .setProductType(type)
              .build(),
          ),
        )
        .build()
      client?.queryProductDetailsAsync(params) { queryResult, productResult ->
        if (queryResult.responseCode != BillingResponseCode.OK) return@queryProductDetailsAsync then(null, describe(queryResult))
        val pd = productResult.productDetailsList.firstOrNull { it.productId == productId }
        if (pd != null) details[key] = pd
        then(pd, null)
      } ?: then(null, "Not connected to Google Play")
    }
  }

  /** The base plan of a subscription (the offer without an offer id), or its first offer. */
  private fun basePlan(pd: ProductDetails) =
    pd.subscriptionOfferDetails?.let { offers -> offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull() }

  /** One-time purchases, then active subscriptions, each paired with its product type. */
  private fun queryOwned(onError: (String) -> Unit = {}, then: (List<Pair<String, Purchase>>) -> Unit) {
    val owned = mutableListOf<Pair<String, Purchase>>()
    fun query(types: List<String>) {
      val type = types.firstOrNull() ?: return then(owned)
      val params = QueryPurchasesParams.newBuilder().setProductType(type).build()
      client?.queryPurchasesAsync(params) { result, purchases ->
        if (result.responseCode != BillingResponseCode.OK) return@queryPurchasesAsync onError(describe(result))
        purchases.forEach { owned.add(type to it) }
        query(types.drop(1))
      } ?: onError("Not connected to Google Play")
    }
    query(listOf(ProductType.INAPP, ProductType.SUBS))
  }

  private fun handlePurchase(purchase: Purchase) {
    val state = stateOf(purchase) ?: return
    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged) acknowledge(purchase)
    purchase.products.forEach { sendEvent(EVENT, mapOf("productId" to it, "state" to state)) }
  }

  private fun acknowledge(purchase: Purchase) {
    val params = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
    // Retried on the next getOwnedProducts if it fails.
    client?.acknowledgePurchase(params) { }
  }

  private fun stateOf(purchase: Purchase): String? = when (purchase.purchaseState) {
    Purchase.PurchaseState.PURCHASED -> "purchased"
    Purchase.PurchaseState.PENDING -> "pending"
    else -> null
  }

  private fun describe(result: BillingResult): String = when (result.responseCode) {
    BillingResponseCode.BILLING_UNAVAILABLE -> "Google Play purchases aren't available on this device"
    BillingResponseCode.SERVICE_UNAVAILABLE, BillingResponseCode.NETWORK_ERROR -> "Can't reach Google Play. Check your connection."
    BillingResponseCode.ITEM_UNAVAILABLE -> "This item isn't available in your country yet"
    else -> result.debugMessage.ifBlank { "Google Play error ${result.responseCode}" }
  }
}
