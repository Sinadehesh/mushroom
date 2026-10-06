package expo.modules.appblocker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Restarts the watcher after a reboot or an app update, if the user left the lock on. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    if (!BlockerStore(context).enabled) return
    try {
      BlockerService.start(context)
    } catch (e: Exception) {
      Log.w("ShroomLockBlocker", "Could not restart the lock after $action", e)
    }
  }
}
