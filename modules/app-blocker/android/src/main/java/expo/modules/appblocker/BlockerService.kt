package expo.modules.appblocker

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Foreground service that polls UsageStatsManager for the app in front. When it's a blocked
 * app without an active unlock window:
 *
 *  1. it opens the challenge deep link on top (allowed from the background because the user
 *     granted "Display over other apps");
 *  2. if the app is still in front a moment later (some phones, e.g. Xiaomi, block background
 *     activity starts, or the user came back to it), it covers the screen with its own
 *     overlay window, whose button opens the challenge. Overlay windows only need
 *     SYSTEM_ALERT_WINDOW, so this works on every Android version and manufacturer.
 */
class BlockerService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var store: BlockerStore
  private var foregroundPackage: String? = null
  private var lastQueryAt = 0L
  private var lastLaunchPackage: String? = null
  private var lastLaunchAt = 0L
  private var overlay: View? = null
  private var overlayPackage: String? = null

  private val tick = object : Runnable {
    override fun run() {
      try {
        check()
      } catch (e: Exception) {
        Log.w(TAG, "Foreground check failed", e)
      }
      handler.postDelayed(this, POLL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    store = BlockerStore(this)
    running = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startInForeground()
    if (!store.enabled) {
      stopSelf()
      return START_NOT_STICKY
    }
    handler.removeCallbacks(tick)
    handler.post(tick)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    hideOverlay()
    running = false
    super.onDestroy()
  }

  /** Swiping ShroomLock away from Recents must not switch the lock off. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    if (store.enabled) {
      try {
        start(applicationContext)
      } catch (e: Exception) {
        Log.w(TAG, "Could not restart after task removal", e)
      }
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun check() {
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (!power.isInteractive || keyguard.isKeyguardLocked) {
      hideOverlay()
      return
    }

    val pkg = currentForegroundPackage() ?: return
    val now = System.currentTimeMillis()
    val locked = pkg != packageName && pkg in store.blockedPackages && !store.isUnlocked(pkg, now)
    if (!locked) {
      hideOverlay()
      return
    }
    if (overlay != null && overlayPackage == pkg) return

    val recentlyLaunched = pkg == lastLaunchPackage && now - lastLaunchAt < RELAUNCH_GAP_MS
    if (!recentlyLaunched) {
      lastLaunchPackage = pkg
      lastLaunchAt = now
      openChallenge(pkg)
    } else if (now - lastLaunchAt >= OVERLAY_DELAY_MS) {
      // The challenge didn't come up (or the user went back to the app): block it ourselves.
      showOverlay(pkg)
    }
  }

  /** Latest app to come to the foreground; events only arrive on change, so remember it between polls. */
  private fun currentForegroundPackage(): String? {
    val usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    // Overlap the previous window slightly: events can be written a moment after their timestamp.
    val from = if (lastQueryAt == 0L) now - INITIAL_LOOKBACK_MS else lastQueryAt - QUERY_OVERLAP_MS
    val events = usage.queryEvents(from, now) ?: return foregroundPackage
    val event = UsageEvents.Event()
    var latestAt = 0L
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      // ACTIVITY_RESUMED (API 29+) has the same value as the older MOVE_TO_FOREGROUND.
      if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND && event.timeStamp >= latestAt) {
        latestAt = event.timeStamp
        foregroundPackage = event.packageName
      }
    }
    lastQueryAt = now
    return foregroundPackage
  }

  private fun challengeIntent(pkg: String): Intent {
    val uri = Uri.parse(store.challengeUrl).buildUpon()
      .appendQueryParameter("source", appLabel(this, pkg))
      .appendQueryParameter("package", pkg)
      .build()
    return Intent(Intent.ACTION_VIEW, uri)
      .setPackage(packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
  }

  private fun openChallenge(pkg: String) {
    try {
      startActivity(challengeIntent(pkg))
    } catch (e: Exception) {
      Log.w(TAG, "Could not open the challenge over $pkg", e)
    }
  }

  // --- Fallback overlay ------------------------------------------------------------------

  private fun showOverlay(pkg: String) {
    if (!Settings.canDrawOverlays(this)) return
    hideOverlay()
    val label = appLabel(this, pkg)
    val view = buildOverlay(label, pkg)
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.OPAQUE
    )
    try {
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(view, params)
      overlay = view
      overlayPackage = pkg
    } catch (e: Exception) {
      Log.w(TAG, "Could not show the lock overlay", e)
    }
  }

  private fun hideOverlay() {
    val view = overlay ?: return
    overlay = null
    overlayPackage = null
    try {
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(view)
    } catch (e: Exception) {
      Log.w(TAG, "Could not remove the lock overlay", e)
    }
  }

  private fun buildOverlay(label: String, pkg: String): View {
    fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
      text = value
      textSize = sizeSp
      setTextColor(color)
      gravity = Gravity.CENTER
      if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
      setPadding(0, dp(6), 0, dp(6))
    }
    fun button(value: String, primary: Boolean, onClick: () -> Unit) = Button(this).apply {
      text = value
      isAllCaps = false
      textSize = 17f
      setTextColor(if (primary) Color.WHITE else GREEN)
      background = GradientDrawable().apply {
        cornerRadius = dp(14).toFloat()
        setColor(if (primary) GREEN else Color.TRANSPARENT)
        if (!primary) setStroke(dp(1), BORDER)
      }
      setOnClickListener { onClick() }
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply {
        topMargin = dp(12)
      }
    }

    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(CREAM)
      setPadding(dp(32), dp(32), dp(32), dp(32))
      addView(text("🍄", 64f, Color.BLACK))
      addView(text("$label is locked", 24f, INK, bold = true))
      addView(text("Name a mushroom to open it.", 16f, MUTED))
      addView(button("Identify the mushroom", primary = true) {
        hideOverlay()
        lastLaunchPackage = pkg
        lastLaunchAt = System.currentTimeMillis()
        openChallenge(pkg)
      })
      addView(button("Go to home screen", primary = false) {
        hideOverlay()
        goHome(this@BlockerService)
      })
    }
  }

  private fun startInForeground() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "App lock", NotificationManager.IMPORTANCE_MIN).apply {
          setShowBadge(false)
        }
      )
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
    }
    val openApp = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    val contentIntent = PendingIntent.getActivity(
      this, 0, openApp, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
    val notification = builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
      .setContentTitle("ShroomLock is on")
      .setContentText("Locked apps open after you name a mushroom.")
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .build()
    // The two-argument form uses the foregroundServiceType declared in the manifest (specialUse).
    startForeground(NOTIFICATION_ID, notification)
  }

  companion object {
    private const val TAG = "ShroomLockBlocker"
    private const val CHANNEL_ID = "shroomlock_blocker"
    private const val NOTIFICATION_ID = 4711
    private const val POLL_MS = 500L
    private const val RELAUNCH_GAP_MS = 4000L
    private const val OVERLAY_DELAY_MS = 1500L
    private const val INITIAL_LOOKBACK_MS = 60_000L
    private const val QUERY_OVERLAP_MS = 2_000L

    private val CREAM = Color.parseColor("#F6F4EE")
    private val INK = Color.parseColor("#1C2A21")
    private val MUTED = Color.parseColor("#5E6B61")
    private val GREEN = Color.parseColor("#2F5D43")
    private val BORDER = Color.parseColor("#DCE1D5")

    @Volatile
    var running = false
      private set

    fun start(context: Context) {
      val intent = Intent(context, BlockerService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BlockerService::class.java))
    }
  }
}

internal fun appLabel(context: Context, pkg: String): String = try {
  val pm = context.packageManager
  pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
} catch (e: Exception) {
  pkg
}

internal fun goHome(context: Context) {
  val home = Intent(Intent.ACTION_MAIN)
    .addCategory(Intent.CATEGORY_HOME)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  context.startActivity(home)
}
