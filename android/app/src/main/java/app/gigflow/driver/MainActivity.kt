package app.gigflow.driver

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.ViewGroup
import android.widget.FrameLayout
import app.gigflow.driver.ui.*

/**
 * GigFlow Driver — iOS-styled companion.
 *
 * Five tabs hosted in a single activity (no fragments, no deps):
 *   Dashboard · Offers · Track · Plan · Assistant
 *
 * The accessibility service runs independently of this UI — see
 * GigFlowAccessibilityService.
 */
class MainActivity : Activity() {

    private lateinit var settings: SettingsRepository
    private lateinit var db: LocalDb
    private lateinit var p: Ios.Palette

    private lateinit var dashboard: DashboardScreen
    private lateinit var offers: OffersScreen
    private lateinit var track: TrackScreen
    private lateinit var plan: PlanScreen
    private lateinit var assist: AssistScreen

    private lateinit var content: FrameLayout
    private lateinit var tabBar: TabBar
    private var current = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        settings = SettingsRepository(this)
        db = LocalDb(this)
        p = Ios.palette(this)

        dashboard = DashboardScreen(this, p, db, settings)
        offers = OffersScreen(this, p, settings)
        track = TrackScreen(this, p, db, settings)
        plan = PlanScreen(this, p, db, settings)
        assist = AssistScreen(this, p, settings, db)

        content = FrameLayout(this)
        tabBar = TabBar(this, p)
        tabBar.setTabs(listOf(
            TabBar.Tab("house", "Home"),
            TabBar.Tab("tag", "Offers"),
            TabBar.Tab("plus.circle", "Track"),
            TabBar.Tab("calendar", "Plan"),
            TabBar.Tab("slider", "Assist"),
        ))
        tabBar.onSelect = { show(it) }

        val root = FrameLayout(this).apply {
            addView(content, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(tabBar, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            setBackgroundColor(p.groupedBg)
        }
        setContentView(root)

        // Edge-to-edge: content flows under the status bar; the nav bar hides
        // and only reappears on a bottom swipe (transient, never resizes us).
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let { ctl ->
                ctl.hide(WindowInsets.Type.navigationBars())
                ctl.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
            root.setOnApplyWindowInsetsListener { _, insets ->
                val sys = insets.getInsets(WindowInsets.Type.systemBars())
                content.setPadding(0, sys.top, 0, 0)
                tabBar.setPadding(0, 0, 0, sys.bottom)
                insets
            }
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }

        show(0)
    }

    private fun show(i: Int) {
        current = i
        val target = when (i) {
            0 -> dashboard.screen
            1 -> offers.screen
            2 -> track.screen
            3 -> plan.screen
            else -> assist.screen
        }
        if (target.parent == content) return
        content.removeAllViews()
        target.alpha = 0f
        content.addView(target, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        target.animate().alpha(1f).setDuration(Ios.ANIM_FAST).start()
        refresh(i)
    }

    private fun refresh(i: Int): Unit {
        Ios.hapticsEnabled = settings.haptics
        syncIfConfigured()
        return when (i) {
            0 -> dashboard.refresh()
            1 -> offers.refresh()
            2 -> track.refresh()
            3 -> plan.refresh()
            else -> assist.refresh()
        }
    }

    /** Flush offline records and refresh dashboard totals on launch/resume. */
    private var lastSync = 0L
    private fun syncIfConfigured() {
        if (!GigFlowApi.configured(settings.syncBaseUrl, settings.syncToken)) return
        val now = System.currentTimeMillis()
        if (now - lastSync < 15_000) return // don't hammer on every tab switch
        lastSync = now
        val pending = db.unsynced()
        if (pending.isNotEmpty()) {
            GigFlowApi.pushBatch(settings.syncBaseUrl, settings.syncToken, pending) { ok ->
                if (ok) pending.forEach { db.markSynced(it.clientId) }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (::tabBar.isInitialized) refresh(current)
    }
}
