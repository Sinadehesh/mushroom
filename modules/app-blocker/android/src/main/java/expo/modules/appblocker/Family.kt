package expo.modules.appblocker

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri

/**
 * FloraLock, ShroomLock and CloudLock form one family: someone who bought Plus in one of them
 * gets Plus in the others at a family price. Each app answers "does this phone have Plus here?"
 * through FamilyProvider (authority "<package>.family"), but only to its sister apps.
 */
internal object Family {
  /** The family's package names; keep in step with FAMILY_APPS in src/core/family.ts. */
  val PACKAGES = listOf("com.floralock.app", "com.shroomlock.app", "com.cloudlock.app")

  // A file of its own: not part of the blocker's settings.
  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("lock_family", Context.MODE_PRIVATE)

  private const val KEY_PLUS = "plus"

  /** Whether Google Play confirmed a Plus purchase in this app (set from JS). */
  fun hasPlus(context: Context): Boolean = prefs(context).getBoolean(KEY_PLUS, false)

  fun setPlus(context: Context, plus: Boolean) = prefs(context).edit().putBoolean(KEY_PLUS, plus).apply()

  /** Each sister app: whether it's installed and whether it has Plus. */
  fun sisters(context: Context): List<Map<String, Any>> =
    PACKAGES.filter { it != context.packageName }.map { pkg ->
      val installed = isInstalled(context, pkg)
      mapOf("packageName" to pkg, "installed" to installed, "plus" to (installed && sisterHasPlus(context, pkg)))
    }

  @Suppress("DEPRECATION")
  private fun isInstalled(context: Context, pkg: String): Boolean =
    try {
      context.packageManager.getPackageInfo(pkg, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }

  @Suppress("DEPRECATION")
  private fun sisterHasPlus(context: Context, pkg: String): Boolean {
    val authority = "$pkg.family"
    return try {
      // Only trust the answer from the sister app itself (an older version has no provider).
      val provider = context.packageManager.resolveContentProvider(authority, 0) ?: return false
      if (provider.packageName != pkg) return false
      context.contentResolver.query(Uri.parse("content://$authority/plus"), null, null, null, null)?.use { cursor ->
        cursor.moveToFirst() && cursor.getInt(0) == 1
      } ?: false
    } catch (e: Exception) {
      false
    }
  }
}

/** Tells a sister app (and only a sister app) whether this phone has Plus in this app. */
class FamilyProvider : ContentProvider() {
  override fun onCreate() = true

  override fun query(
    uri: Uri,
    projection: Array<out String>?,
    selection: String?,
    selectionArgs: Array<out String>?,
    sortOrder: String?,
  ): Cursor? {
    val context = context ?: return null
    val caller = try {
      callingPackage
    } catch (e: SecurityException) {
      null
    }
    if (caller == null || caller == context.packageName || caller !in Family.PACKAGES) return null
    return MatrixCursor(arrayOf("plus")).apply { addRow(arrayOf(if (Family.hasPlus(context)) 1 else 0)) }
  }

  override fun getType(uri: Uri): String? = null

  override fun insert(uri: Uri, values: ContentValues?): Uri? = null

  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = 0

  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = 0
}
