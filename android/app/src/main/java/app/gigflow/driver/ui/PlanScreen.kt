package app.gigflow.driver.ui

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.TilesOverlay
import java.util.*

/**
 * Plan — recurring weekly work blocks. Mirrors the web Schedule feature:
 * pick a day, set a start/end time and an optional earnings target.
 * Saves locally, syncs to /api/mobile/schedule when connected.
 */
class PlanScreen(
    ctx: Context,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(ctx, p, "Schedule")
    private val ctx: Context = ctx
    private var pickedDay = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun
    private var dayBtns = mutableListOf<TextView>()

    private val dayNames = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(Sections.header(ctx, p, "Work heatmap"))
        c.addView(heatCard())
        c.addView(TextView(ctx).apply {
            text = "Built only from your own tracked shifts and tagged offers — " +
                "not citywide demand. More driving = more coverage."
            textSize = Ios.T_FOOTNOTE; setTextColor(p.label3)
            setPadding(dp(ctx, 20f), dp(ctx, 6f), dp(ctx, 16f), dp(ctx, 4f))
        })

        c.addView(Sections.header(ctx, p, "New shift"))
        c.addView(formCard())
        c.addView(Sections.header(ctx, p, "This week"))
        c.addView(listCard())
        c.addView(TextView(ctx).apply {
            text = "Recurring blocks repeat every week. Tap one to delete."
            textSize = Ios.T_FOOTNOTE; setTextColor(p.label3)
            setPadding(dp(ctx, 20f), dp(ctx, 6f), dp(ctx, 16f), dp(ctx, 16f))
        })
        screen.animateIn()
    }

    /** Mystro-style activity heatmap over OpenStreetMap (osmdroid). */
    private fun heatCard(): View {
        val card = Sections.card(ctx, p)
        val pts = db.heatPoints()
        if (pts.isEmpty()) {
            card.addView(Sections.row(ctx, p,
                iconGlyph = "mappin", iconTint = p.tint,
                title = "No activity mapped yet",
                subtitle = "Start a shift in Track or let the assistant tag " +
                    "offer locations — your hotspots appear here.",
            ))
            return card
        }

        Configuration.getInstance().load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
        Configuration.getInstance().userAgentValue = ctx.packageName

        val map = MapView(ctx)
        map.setTileSource(TileSourceFactory.MAPNIK)
        map.setMultiTouchControls(true)
        map.setBuiltInZoomControls(false)
        map.isTilesScaledToDpi = true
        map.minZoomLevel = 4.0
        map.overlays.add(HeatOverlay(pts, p.tint))

        // Center/zoom to cover all points.
        val lats = pts.map { it.lat }; val lngs = pts.map { it.lng }
        val box = BoundingBox(
            lats.max(), lngs.max(), lats.min(), lngs.min(),
        )
        map.post { map.zoomToBoundingBox(box, false, dp(ctx, 32f), 18.0, 1500L) }
        map.controller.setZoom(12.0)
        map.controller.setCenter(GeoPoint(lats.average(), lngs.average()))

        // Dark-mode friendly tiles when the palette is dark.
        if (p.isDark) map.overlayManager.tilesOverlay.setColorFilter(TilesOverlay.INVERT_COLORS)

        val holder = FrameLayout(ctx).apply {
            clipToOutline = true
            outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            background = Ios.rounded(12f, p.fill, ctx)
            setPadding(0, 0, 0, 0)
            addView(map, FrameLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 220f)))
        }
        holder.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) { map.onResume() }
            override fun onViewDetachedFromWindow(v: View) { map.onPause() }
        })
        card.addView(holder)
        return card
    }

    private fun formCard(): View {
        val card = Sections.card(ctx, p)

        val (rTitle, title) = Sections.formField(ctx, p, "Label", "", numeric = false, hint = "Downtown dinner rush")
        card.addView(rTitle); card.addView(Sections.separator(ctx, p))

        // day-of-week picker — 7 letter circles
        dayBtns.clear()
        card.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(ctx, 10f), dp(ctx, 12f), dp(ctx, 10f), dp(ctx, 12f))
            dayNames.forEachIndexed { i, d ->
                val tv = TextView(ctx).apply {
                    text = d.take(1)
                    textSize = Ios.T_SUBHEAD
                    gravity = Gravity.CENTER
                    setTypeface(typeface, Typeface.BOLD)
                    setOnClickListener { pickedDay = i; paintDays() }
                }
                addView(tv, LinearLayout.LayoutParams(dp(ctx, 40f), dp(ctx, 40f))
                    .apply { setMargins(dp(ctx, 2f), 0, dp(ctx, 2f), 0) })
                dayBtns.add(tv)
            }
        })
        paintDays()

        card.addView(Sections.separator(ctx, p))
        val (rFrom, from) = Sections.formField(ctx, p, "From", "17:00", numeric = false, hint = "17:00")
        val (rTo, to) = Sections.formField(ctx, p, "To", "21:00", numeric = false, hint = "21:00")
        val (rTarget, target) = Sections.formField(ctx, p, "Target", "", hint = "optional $")
        card.addView(rFrom); card.addView(Sections.separator(ctx, p))
        card.addView(rTo); card.addView(Sections.separator(ctx, p))
        card.addView(rTarget); card.addView(Sections.separator(ctx, p))

        card.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f))
            val btn = iosButton(ctx, p, "Add shift")
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            btn.setOnClickListener {
                val s = parseTime(from.text.toString()) ?: return@setOnClickListener bad("From must be HH:MM")
                val e = parseTime(to.text.toString()) ?: return@setOnClickListener bad("To must be HH:MM")
                if (e <= s) return@setOnClickListener bad("End must be after start")
                add(title.text.toString().ifBlank { null }, s, e,
                    (target.text.toString().toDoubleOrNull()?.times(100))?.toInt())
            }
        })
        return card
    }

    private fun paintDays() {
        dayBtns.forEachIndexed { i, tv ->
            val sel = i == pickedDay
            tv.background = if (sel) Ios.rounded(20f, p.tint, ctx) else Ios.rounded(20f, p.fill, ctx)
            tv.setTextColor(if (sel) android.graphics.Color.WHITE else p.label2)
        }
    }

    private fun parseTime(t: String): Int? {
        val m = Regex("""^\s*(\d{1,2})[:.]?(\d{2})?\s*$""").matchEntire(t) ?: return null
        val h = m.groupValues[1].toInt()
        val min = m.groupValues[2].toIntOrNull() ?: 0
        if (h > 23 || min > 59) return null
        return h * 60 + min
    }

    private fun bad(msg: String) { Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show() }

    private fun add(title: String?, startMin: Int, endMin: Int, targetCents: Int?) {
        val payload = JSONObject()
            .put("title", title)
            .put("dayOfWeek", pickedDay)
            .put("startMin", startMin)
            .put("endMin", endMin)
        targetCents?.let { payload.put("targetCents", it) }
        val s = db.insertSchedule(payload)
        GigFlowApi.pushSchedule(settings.syncBaseUrl, settings.syncToken, s.payload) { ok ->
            if (ok) db.markScheduleSynced(s.clientId)
        }
        Toast.makeText(ctx, "Added", Toast.LENGTH_SHORT).show()
        refresh()
    }

    private fun fmt(min: Int) = "%d:%02d %s".format(
        ((min / 60 + 11) % 12) + 1, min % 60, if (min / 60 < 12) "AM" else "PM")

    private fun listCard(): View {
        val card = Sections.card(ctx, p)
        val scheds = db.schedules().sortedBy { (it.payload.optInt("dayOfWeek") + 6) % 7 * 1440 + it.payload.optInt("startMin") }
        if (scheds.isEmpty()) {
            card.addView(TextView(ctx).apply {
                text = "No shifts planned — add your first block above."
                textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                setPadding(dp(ctx, 16f), dp(ctx, 14f), dp(ctx, 16f), dp(ctx, 14f))
            })
            return card
        }
        scheds.forEachIndexed { i, s ->
            val pl = s.payload
            if (i > 0) card.addView(Sections.separator(ctx, p))
            card.addView(Sections.row(ctx, p,
                title = pl.optString("title").ifBlank {
                    dayNames.getOrElse(pl.optInt("dayOfWeek")) { "?" } + " shift"
                },
                subtitle = "${dayNames.getOrElse(pl.optInt("dayOfWeek")) { "?" }} · " +
                    "${fmt(pl.optInt("startMin"))} – ${fmt(pl.optInt("endMin"))}" +
                    (pl.optInt("targetCents").takeIf { it > 0 }
                        ?.let { " · target ${Ios.money(it)}" } ?: "") +
                    if (!s.synced) " · pending" else "",
                iconGlyph = "calendar", iconTint = p.tint,
                chevron = true,
            ) { confirmDelete(s) })
        }
        return card
    }

    private fun confirmDelete(s: LocalDb.Sched) {
        val sheet = IosSheet(ctx, p)
        val pl = s.payload
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 20f), dp(ctx, 8f), dp(ctx, 20f), 0)
            addView(TextView(ctx).apply {
                text = pl.optString("title").ifBlank { dayNames.getOrElse(pl.optInt("dayOfWeek")) { "Shift" } }
                textSize = Ios.T_HEADLINE; setTypeface(typeface, Typeface.BOLD); setTextColor(p.label)
            })
            addView(TextView(ctx).apply {
                text = "${dayNames.getOrElse(pl.optInt("dayOfWeek")) { "" }} · ${fmt(pl.optInt("startMin"))} – ${fmt(pl.optInt("endMin"))}"
                textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
                setPadding(0, dp(ctx, 2f), 0, dp(ctx, 16f))
            })
        }
        sheet.add(col)
        val del = iosButton(ctx, p, "Delete shift", p.red)
        val cancel = iosButton(ctx, p, "Cancel", p.fill)
        cancel.setTextColor(p.label)
        sheet.add(LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 16f), 0, dp(ctx, 16f), 0)
            addView(del); addView(cancel)
            (cancel.layoutParams as? LinearLayout.LayoutParams)?.topMargin = dp(ctx, 8f)
        })
        del.setOnClickListener {
            sheet.dismiss()
            db.deleteSchedule(s.clientId)
            GigFlowApi.deleteSchedule(settings.syncBaseUrl, settings.syncToken, s.clientId)
            Toast.makeText(ctx, "Deleted", Toast.LENGTH_SHORT).show()
            refresh()
        }
        cancel.setOnClickListener { sheet.dismiss() }
        sheet.show()
    }
}
