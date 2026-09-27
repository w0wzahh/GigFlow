package app.gigflow.driver

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import app.gigflow.driver.ui.*

/**
 * GigFlow Driver — iOS-styled companion.
 *
 * Four tabs hosted in a single activity (no fragments, no deps):
 *   Dashboard · Offers · Track · Assistant
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
        offers = OffersScreen(this, p)
        track = TrackScreen(this, p, db, settings)
        assist = AssistScreen(this, p, settings, db)

        content = FrameLayout(this)
        tabBar = TabBar(this, p)
        tabBar.setTabs(listOf(
            TabBar.Tab("house", "Home"),
            TabBar.Tab("tag", "Offers"),
            TabBar.Tab("plus.circle", "Track"),
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

        // status/nav bars blend into the app background
        window.statusBarColor = p.groupedBg
        window.navigationBarColor = p.groupedBg

        show(0)
    }

    private fun show(i: Int) {
        current = i
        val target = when (i) {
            0 -> dashboard.screen
            1 -> offers.screen
            2 -> track.screen
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

    private fun refresh(i: Int) = when (i) {
        0 -> dashboard.refresh()
        1 -> offers.refresh()
        2 -> track.refresh()
        else -> assist.refresh()
    }

    override fun onResume() {
        super.onResume()
        if (::tabBar.isInitialized) refresh(current)
    }
}
