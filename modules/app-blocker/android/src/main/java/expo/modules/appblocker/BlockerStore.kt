package expo.modules.appblocker

import android.content.Context

/**
 * Blocker settings shared between the JS module, the watcher service and the boot receiver.
 * SharedPreferences are cached in memory, so the service can read them on every poll.
 * App updates keep this file: never rename it or its keys, or users lose their locked apps.
 */
internal class BlockerStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("shroomlock_blocker", Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

  var blockedPackages: Set<String>
    get() = prefs.getStringSet(KEY_BLOCKED, emptySet())?.toSet() ?: emptySet()
    set(value) = prefs.edit().putStringSet(KEY_BLOCKED, value.toSet()).apply()

  /** Deep link the watcher opens, e.g. "shroomlock://challenge". */
  var challengeUrl: String
    get() = prefs.getString(KEY_CHALLENGE_URL, DEFAULT_CHALLENGE_URL) ?: DEFAULT_CHALLENGE_URL
    set(value) = prefs.edit().putString(KEY_CHALLENGE_URL, value).apply()

  fun isUnlocked(packageName: String, now: Long): Boolean = prefs.getLong(unlockKey(packageName), 0L) > now

  fun grant(packageNames: Collection<String>, until: Long) {
    val edit = prefs.edit()
    packageNames.forEach { edit.putLong(unlockKey(it), until) }
    edit.apply()
  }

  private fun unlockKey(packageName: String) = "unlock:$packageName"

  companion object {
    private const val KEY_ENABLED = "enabled"
    private const val KEY_BLOCKED = "blocked"
    private const val KEY_CHALLENGE_URL = "challengeUrl"
    private const val DEFAULT_CHALLENGE_URL = "shroomlock://challenge"
  }
}
