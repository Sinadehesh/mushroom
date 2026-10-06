package expo.modules.appblocker

import android.Manifest
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppBlockerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AppBlocker")

    // --- Permissions -------------------------------------------------------

    Function("hasUsageAccess") {
      val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      } else {
        @Suppress("DEPRECATION")
        appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
      }
      mode == AppOpsManager.MODE_ALLOWED
    }

    Function("canDrawOverlays") {
      Settings.canDrawOverlays(context)
    }

    Function("openUsageAccessSettings") {
      openSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    Function("openOverlaySettings") {
      openSettings(
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}"))
      )
    }

    /** Android 13+: lets the "ShroomLock is on" notification show. The lock works without it. */
    Function("requestNotificationPermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        appContext.currentActivity?.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4711)
      }
    }

    // --- Apps ----------------------------------------------------------------

    /** Every app with a launcher icon except ShroomLock itself, sorted by name. */
    AsyncFunction("getLaunchableApps") {
      val pm = context.packageManager
      val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(launcher, 0)
        .map { it.activityInfo.packageName }
        .distinct()
        .filter { it != context.packageName }
        .map { mapOf("packageName" to it, "label" to appLabel(context, it)) }
        .sortedBy { it["label"]?.lowercase() }
    }

    Function("getBlockedApps") {
      BlockerStore(context).blockedPackages.toList()
    }

    Function("setBlockedApps") { packageNames: List<String> ->
      BlockerStore(context).blockedPackages = packageNames.toSet()
    }

    // --- Lock on/off -----------------------------------------------------------

    Function("isEnabled") {
      BlockerStore(context).enabled
    }

    Function("setEnabled") { enabled: Boolean, challengeUrl: String ->
      val store = BlockerStore(context)
      store.challengeUrl = challengeUrl
      store.enabled = enabled
      if (enabled) BlockerService.start(context) else BlockerService.stop(context)
    }

    /** Let `packageName` (or every blocked app, when null) open freely for `minutes`. */
    Function("grantTemporaryAccess") { packageName: String?, minutes: Int ->
      val store = BlockerStore(context)
      val targets = if (packageName != null) listOf(packageName) else store.blockedPackages
      store.grant(targets, System.currentTimeMillis() + minutes * 60_000L)
    }

    // --- Leaving the challenge -------------------------------------------------

    Function("openApp") { packageName: String ->
      val intent = context.packageManager.getLaunchIntentForPackage(packageName)
      if (intent != null) context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      intent != null
    }

    Function("goHome") {
      goHome(context)
    }

    // --- Staying alive ---------------------------------------------------------

    /** True while the watcher service is alive in this process. */
    Function("isServiceRunning") {
      BlockerService.running
    }

    /** Restart the watcher if the lock is on but the system killed it. Call on every app start. */
    Function("ensureRunning") {
      if (BlockerStore(context).enabled && !BlockerService.running) BlockerService.start(context)
    }

    Function("isIgnoringBatteryOptimizations") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /** System dialog "Let ShroomLock always run in background?"; falls back to the settings list. */
    Function("requestIgnoreBatteryOptimizations") {
      val direct = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
      if (!tryStart(direct)) tryStart(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    /** Lower-case manufacturer, e.g. "xiaomi", "samsung". */
    Function("getManufacturer") {
      Build.MANUFACTURER.lowercase()
    }

    /**
     * Opens the manufacturer's own "autostart / background activity" screen (Xiaomi, Huawei,
     * Oppo, Vivo, Samsung…), which stock Android doesn't have. Falls back to the app's
     * system settings page. Returns true when a manufacturer screen was opened.
     */
    Function("openManufacturerSettings") {
      val opened = manufacturerIntents().any { tryStart(it) }
      if (!opened) {
        tryStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
      }
      opened
    }
  }

  private fun manufacturerIntents(): List<Intent> {
    val pkg = context.packageName
    fun component(owner: String, cls: String) = Intent().setComponent(ComponentName(owner, cls))
    return when (Build.MANUFACTURER.lowercase()) {
      "xiaomi", "redmi", "poco" -> listOf(
        // "Other permissions": Display pop-up windows while running in the background, etc.
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
          .putExtra("extra_pkgname", pkg),
        Intent("miui.intent.action.APP_PERM_EDITOR")
          .setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity")
          .putExtra("extra_pkgname", pkg),
        component("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
      )
      "huawei", "honor" -> listOf(
        component("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        component("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"),
        component("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
      )
      "oppo", "realme", "oneplus" -> listOf(
        component("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        component("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        component("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
        component("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"),
      )
      "vivo", "iqoo" -> listOf(
        component("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
      )
      "samsung" -> listOf(
        component("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
        component("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"),
      )
      "asus" -> listOf(
        component("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
        component("com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"),
      )
      else -> emptyList()
    }
  }

  private fun tryStart(intent: Intent): Boolean = try {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (e: Exception) {
    false
  }

  private fun openSettings(intent: Intent) {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
