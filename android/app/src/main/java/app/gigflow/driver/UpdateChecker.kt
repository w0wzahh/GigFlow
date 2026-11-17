package app.gigflow.driver

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.core.content.FileProvider
import app.gigflow.driver.ui.Ios
import app.gigflow.driver.ui.IosSheet
import app.gigflow.driver.ui.iosButton
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Self-update against GitHub Releases — the app isn't on a store, so it
 * polls the repo's latest release tag and offers to download the APK when
 * a newer versionName exists.
 *
 * Only two things ever leave the phone: a GET to api.github.com and the
 * APK download itself. Install goes through the system installer, so the
 * user still confirms (plus the one-time "allow this source" prompt).
 */
object UpdateChecker {

    private const val REPO = "w0wzahh/GigFlow"
    private const val API = "https://api.github.com/repos/$REPO/releases/latest"
    private const val APK_NAME_PREFIX = "GigFlow-"
    private val io = Executors.newSingleThreadExecutor()
    private val ui = Handler(Looper.getMainLooper())

    data class Release(
        val version: String,   // "1.3.0"
        val notes: String,
        val apkUrl: String,
        val sizeBytes: Long,
    )

    /** Current installed version, e.g. "1.3.0". */
    fun currentVersion(ctx: Context): String = try {
        ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "0"
    } catch (_: Exception) { "0" }

    /** True when [candidate] is strictly newer than [current] ("1.10.0" > "1.9.9"). */
    fun isNewer(candidate: String, current: String): Boolean {
        fun parts(v: String) = v.trim().removePrefix("v")
            .split(".").map { it.toIntOrNull() ?: 0 }
        val a = parts(candidate); val b = parts(current)
        for (i in 0 until maxOf(a.size, b.size)) {
            val x = a.getOrElse(i) { 0 }; val y = b.getOrElse(i) { 0 }
            if (x != y) return x > y
        }
        return false
    }

    /** Fetch the latest release; cb(null) when nothing newer or on error. */
    fun check(ctx: Context, cb: (Release?) -> Unit) {
        val current = currentVersion(ctx)
        io.execute {
            val rel = try {
                val conn = (URL(API).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Accept", "application/vnd.github+json")
                    setRequestProperty("User-Agent", "GigFlow-Android/$current")
                }
                if (conn.responseCode != 200) null else {
                    val body = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(body)
                    val version = json.optString("tag_name").removePrefix("v")
                    val assets = json.optJSONArray("assets")
                    var apkUrl = ""; var size = 0L
                    if (assets != null) for (i in 0 until assets.length()) {
                        val a = assets.getJSONObject(i)
                        val name = a.optString("name")
                        if (name.startsWith(APK_NAME_PREFIX) && name.endsWith(".apk")) {
                            apkUrl = a.optString("browser_download_url")
                            size = a.optLong("size")
                            break
                        }
                    }
                    if (apkUrl.isBlank() || !isNewer(version, current)) null
                    else Release(version, json.optString("body"), apkUrl, size)
                }
            } catch (_: Exception) { null }
            ui.post { cb(rel) }
        }
    }

    /**
     * Download the APK to app-private storage and hand it to the system
     * package installer. progressCb(0..100) on the main thread; done(false)
     * on failure.
     */
    fun downloadAndInstall(
        ctx: Context,
        rel: Release,
        progressCb: (Int) -> Unit,
        done: (Boolean) -> Unit,
    ) {
        io.execute {
            val ok = try {
                val file = File(ctx.cacheDir, "update-${rel.version}.apk")
                val conn = (URL(rel.apkUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10_000
                    readTimeout = 30_000
                    setRequestProperty("User-Agent", "GigFlow-Android")
                }
                val total = conn.contentLengthLong.takeIf { it > 0 } ?: rel.sizeBytes
                conn.inputStream.use { inp ->
                    file.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        var read: Int; var got = 0L; var lastPct = -1
                        while (inp.read(buf).also { read = it } != -1) {
                            out.write(buf, 0, read)
                            got += read
                            if (total > 0) {
                                val pct = (got * 100 / total).toInt()
                                if (pct != lastPct) {
                                    lastPct = pct
                                    ui.post { progressCb(pct) }
                                }
                            }
                        }
                    }
                }
                install(ctx, file)
            } catch (_: Exception) { false }
            ui.post { done(ok) }
        }
    }

    private fun install(ctx: Context, apk: File): Boolean {
        return try {
            val uri: Uri = FileProvider.getUriForFile(
                ctx, "${ctx.packageName}.fileprovider", apk)
            val i = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(i)
            true
        } catch (_: Exception) { false }
    }

    // ---- update prompt UI ---------------------------------------------------

    private const val CHECK_INTERVAL_MS = 6 * 3600_000L

    /** Check at most once every 6h; silently does nothing when up-to-date. */
    fun promptIfNewer(activity: android.app.Activity, p: Ios.Palette) {
        val prefs = activity.getSharedPreferences("gigflow_updates", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (now - prefs.getLong("last_check", 0) < CHECK_INTERVAL_MS) return
        prefs.edit().putLong("last_check", now).apply()
        check(activity) { rel ->
            // Activity may be gone by the time the response lands.
            if (rel != null && !activity.isFinishing && !activity.isDestroyed) {
                showUpdateSheet(activity, p, rel)
            }
        }
    }

    /** Bottom sheet: version, notes, download-and-install with progress. */
    fun showUpdateSheet(ctx: Context, p: Ios.Palette, rel: Release) {
        val d = { v: Float -> (v * ctx.resources.displayMetrics.density).toInt() }
        val sheet = IosSheet(ctx, p)
        val col = android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(d(20f), d(8f), d(20f), d(4f))
        }
        col.addView(android.widget.TextView(ctx).apply {
            text = "Update available"
            textSize = Ios.T_HEADLINE
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setTextColor(p.label)
        })
        col.addView(android.widget.TextView(ctx).apply {
            text = "v${rel.version}" +
                if (rel.sizeBytes > 0) " · %.1f MB".format(rel.sizeBytes / 1_000_000.0) else ""
            textSize = Ios.T_FOOTNOTE
            setTextColor(p.label2)
            setPadding(0, d(2f), 0, d(10f))
        })
        val notes = rel.notes.trim().lineSequence().take(14).joinToString("\n")
        if (notes.isNotBlank()) {
            col.addView(android.widget.TextView(ctx).apply {
                text = notes
                textSize = Ios.T_FOOTNOTE
                setTextColor(p.label2)
                setPadding(0, 0, 0, d(12f))
            })
        }
        sheet.add(col)

        val dl = iosButton(ctx, p, "Download & install")
        val later = iosButton(ctx, p, "Later", p.fill)
        later.setTextColor(p.label)
        sheet.add(android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(d(16f), 0, d(16f), 0)
            addView(dl); addView(later)
            (later.layoutParams as? android.widget.LinearLayout.LayoutParams)
                ?.topMargin = d(8f)
        })

        dl.setOnClickListener {
            dl.isEnabled = false
            downloadAndInstall(ctx, rel,
                progressCb = { pct -> dl.text = "Downloading… $pct%" },
                done = { ok ->
                    if (ok) sheet.dismiss()
                    else {
                        dl.text = "Download & install"
                        dl.isEnabled = true
                        android.widget.Toast.makeText(
                            ctx, "Download failed — try again",
                            android.widget.Toast.LENGTH_SHORT).show()
                    }
                })
        }
        later.setOnClickListener { sheet.dismiss() }
        sheet.show()
    }
}
