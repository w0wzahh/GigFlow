package app.gigflow.driver.ui

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import org.json.JSONObject
import java.util.*

/**
 * Stats — analytics parity with the web: period toggle, earnings vs
 * expenses, per-hour/per-distance rates, platform breakdown, weekly chart.
 * Uses the synced web summary when available; local records otherwise.
 */
class StatsScreen(
    ctx: Context,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(ctx, p, "Analytics")
    private val ctx: Context = ctx
    private var period = 0 // 0 week, 1 month
    private var summary: JSONObject? = null
    private var fetched = false

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 16f), dp(ctx, 4f), dp(ctx, 16f), dp(ctx, 8f))
            addView(IosSegmented(ctx, p, listOf("This week", "This month"), initial = period).apply {
                onSelected = { period = it; refresh() }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        })

        c.addView(heroCard())
        c.addView(Sections.header(ctx, p, "Breakdown"))
        c.addView(gridCard())
        platformCard()?.let { c.addView(Sections.header(ctx, p, "By platform")); c.addView(it) }
        c.addView(Sections.header(ctx, p, "Daily gross"))
        c.addView(chartCard())

        if (GigFlowApi.configured(settings.syncBaseUrl, settings.syncToken) && !fetched) {
            fetched = true
            GigFlowApi.fetchSummary(settings.syncBaseUrl, settings.syncToken) { s ->
                summary = s
                if (s != null) screen.post { refresh() }
            }
        }
        screen.animateIn()
    }

    private fun isKm() = settings.distanceUnit == "KM"
    private fun dist(km: Double) = if (isKm()) "%.1f km".format(km)
        else "%.1f mi".format(km * 0.621371)
    private fun perDist(centsPerKm: Int?) = centsPerKm?.let {
        Ios.money(if (isKm()) it else (it * 1.609344).toInt())
    } ?: "—"

    private fun local(): LocalDb.Stats {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0)
        if (period == 0) {
            cal.set(Calendar.DAY_OF_WEEK, cal.firstDayOfWeek)
            if (cal.timeInMillis > System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, -7)
        } else {
            cal.set(Calendar.DAY_OF_MONTH, 1)
        }
        return db.stats(cal.timeInMillis)
    }

    /** Effective aggregate — web summary if synced, else local records. */
    private fun agg(): Agg {
        val key = if (period == 0) "week" else "month"
        val w = summary?.optJSONObject(key)
        if (w != null) return Agg(
            gross = w.optInt("grossCents"), net = w.optInt("netCents"),
            spent = w.optInt("expensesCents"), hours = w.optDouble("hours"),
            km = w.optDouble("distanceKm"), jobs = -1, tips = 0,
        )
        val s = local()
        return Agg(s.earnedCents, s.earnedCents - s.spentCents, s.spentCents,
            s.hours, s.km, s.jobs, s.tipCents)
    }

    private data class Agg(
        val gross: Int, val net: Int, val spent: Int, val hours: Double,
        val km: Double, val jobs: Int, val tips: Int,
    )

    private fun heroCard(): View {
        val a = agg()
        val card = Sections.card(ctx, p)
        val pad = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 18f), dp(ctx, 16f), dp(ctx, 18f), dp(ctx, 16f))
        }
        pad.addView(TextView(ctx).apply {
            text = if (period == 0) "NET THIS WEEK" else "NET THIS MONTH"
            textSize = Ios.T_CAPTION; setTextColor(p.label2); letterSpacing = 0.08f
        })
        pad.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(ctx).apply {
                text = Ios.money(a.net)
                textSize = 40f; setTypeface(typeface, Typeface.BOLD)
                setTextColor(if (a.net >= 0) p.label else p.red)
            })
            // week-over-week delta chip
            if (period == 0) {
                val prev = summary?.optJSONObject("prevWeek")?.optInt("netCents")
                if (prev != null && prev > 0) {
                    val delta = ((a.net - prev) * 100f / prev).toInt()
                    addView(TextView(ctx).apply {
                        text = (if (delta >= 0) "↑ " else "↓ ") + kotlin.math.abs(delta) + "%"
                        textSize = Ios.T_SUBHEAD; setTypeface(typeface, Typeface.BOLD)
                        setTextColor(if (delta >= 0) p.green else p.red)
                        background = Ios.rounded(11f,
                            if (delta >= 0) Color.argb(40, 48, 209, 88)
                            else Color.argb(40, 255, 69, 58), ctx)
                        setPadding(dp(ctx, 10f), dp(ctx, 3f), dp(ctx, 10f), dp(ctx, 3f))
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT,
                        ).apply { leftMargin = dp(ctx, 12f) }
                    })
                }
            }
        })
        pad.addView(TextView(ctx).apply {
            text = buildString {
                append("${Ios.money(a.gross)} earned · ${Ios.money(a.spent)} spent")
                if (a.tips > 0) append(" · ${Ios.money(a.tips)} tips")
            }
            textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
            setPadding(0, dp(ctx, 6f), 0, 0)
        })
        card.addView(pad)
        return card
    }

    private fun stat(label: String, value: String): View =
        LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 4f), dp(ctx, 10f), dp(ctx, 4f), dp(ctx, 10f))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addView(TextView(ctx).apply {
                text = value; textSize = 19f; setTypeface(typeface, Typeface.BOLD)
                setTextColor(p.label)
            })
            addView(TextView(ctx).apply {
                text = label; textSize = Ios.T_CAPTION; setTextColor(p.label2)
                setPadding(0, dp(ctx, 2f), 0, 0)
            })
        }

    private fun gridCard(): View {
        val a = agg()
        val perHr = if (a.hours > 0) Ios.money((a.gross / a.hours).toInt()) else "—"
        val perD = if (a.km > 0) perDist((a.gross / a.km).toInt()) else "—"
        val card = Sections.card(ctx, p)
        card.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(ctx, 12f), dp(ctx, 6f), dp(ctx, 12f), dp(ctx, 6f))
            addView(stat("$ / hour", perHr))
            addView(stat("$ / ${if (isKm()) "km" else "mi"}", perD))
            addView(stat("Distance", dist(a.km)))
            addView(stat(if (a.jobs >= 0) "Jobs" else "Hours",
                if (a.jobs >= 0) a.jobs.toString() else "%.1f".format(a.hours)))
        })
        return card
    }

    private fun platformCard(): View? {
        val arr = summary?.optJSONArray("byPlatform") ?: return null
        if (arr.length() == 0) return null
        val card = Sections.card(ctx, p)
        val max = (0 until arr.length()).maxOf { arr.getJSONObject(it).optInt("grossCents") }.coerceAtLeast(1)
        for (i in 0 until arr.length()) {
            val pl = arr.getJSONObject(i)
            if (i > 0) card.addView(Sections.separator(ctx, p))
            card.addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(ctx, 16f), dp(ctx, 11f), dp(ctx, 16f), dp(ctx, 11f))
                addView(LinearLayout(ctx).apply {
                    orientation = LinearLayout.HORIZONTAL
                    addView(TextView(ctx).apply {
                        text = pl.optString("name")
                        textSize = Ios.T_BODY; setTextColor(p.label)
                        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    })
                    addView(TextView(ctx).apply {
                        val jobs = pl.optInt("jobs", 0)
                        text = Ios.money(pl.optInt("grossCents")) +
                            if (jobs > 0) " · $jobs job${if (jobs == 1) "" else "s"}" else ""
                        textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                    })
                })
                addView(ProgressBar(ctx, p,
                    (pl.optInt("grossCents") * 100 / max)).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 5f),
                    ).apply { topMargin = dp(ctx, 7f) }
                })
            })
        }
        return card
    }

    private fun chartCard(): View {
        val card = Sections.card(ctx, p)
        val days = summary?.optJSONArray("series")
        val vals = FloatArray(7)
        if (days != null && days.length() > 0) {
            val n = minOf(days.length(), 7)
            for (i in 0 until n) vals[i + (7 - n)] =
                days.getJSONObject(days.length() - n + i).optInt("grossCents").toFloat()
        } else {
            val local = db.dailyGross(7)
            local.copyInto(vals)
        }
        val labels = arrayOf("S", "M", "T", "W", "T", "F", "S")
        val dow = Calendar.getInstance().get(Calendar.DAY_OF_WEEK) - 1 // 0=Sun
        val ordered = Array(7) { labels[(dow - 6 + it + 7) % 7] }
        card.addView(WeekBars(ctx, p, vals, ordered).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 110f),
            ).apply { setMargins(dp(ctx, 16f), dp(ctx, 14f), dp(ctx, 16f), dp(ctx, 12f)) }
        })
        return card
    }
}
