package app.gigflow.driver.ui

import android.content.Context
import android.graphics.*
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/** Dashboard — today's numbers, week chart, assistant status. */
class DashboardScreen(
    private val activity: android.app.Activity,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(activity, p, "Dashboard")
    private val ctx: Context = activity
    private var summary: JSONObject? = null

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(greeting())
        c.addView(heroCard())
        c.addView(Sections.header(ctx, p, "This week"))
        c.addView(weekChartCard())
        c.addView(Sections.header(ctx, p, "Assistant"))
        c.addView(assistantCard())
        c.addView(Sections.header(ctx, p, "Recent activity"))
        c.addView(todayRecordsCard())
        c.addView(gap(24f))

        if (GigFlowApi.configured(settings.syncBaseUrl, settings.syncToken)) {
            GigFlowApi.fetchSummary(settings.syncBaseUrl, settings.syncToken) { s ->
                summary = s
                if (s != null) rebuild()
            }
        }
        screen.animateIn()
    }

    private fun rebuild() { refresh() }

    private fun greeting(): View = TextView(ctx).apply {
        val h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        text = when {
            h < 5 -> "Working late"
            h < 12 -> "Good morning"
            h < 17 -> "Good afternoon"
            h < 22 -> "Good evening"
            else -> "Working late"
        }
        textSize = Ios.T_SUBHEAD
        setTextColor(p.label2)
        setPadding(dp(ctx, 17f), 0, dp(ctx, 16f), dp(ctx, 2f))
    }

    private fun gap(h: Float) = View(ctx).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(ctx, h))
    }

    private fun todayFromWeb() = summary?.optJSONObject("today")
    private fun weekFromWeb() = summary?.optJSONObject("week")

    private fun heroCard(): View {
        val card = Sections.card(ctx, p)
        val web = todayFromWeb()
        val dayStart = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val local = db.totals(dayStart)

        val gross = web?.optInt("grossCents", -1)?.takeIf { it >= 0 } ?: local.earnedCents
        val net = web?.optInt("netCents", Int.MIN_VALUE)?.takeIf { it != Int.MIN_VALUE }
            ?: (local.earnedCents - local.spentCents)
        val hours = web?.optDouble("hours", Double.NaN)?.takeIf { !it.isNaN() }
        val offers = web?.optInt("offers", -1)?.takeIf { it >= 0 }

        val pad = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 18f), dp(ctx, 16f), dp(ctx, 18f), dp(ctx, 16f))
        }
        pad.addView(TextView(ctx).apply {
            text = "TODAY'S NET"
            textSize = Ios.T_CAPTION
            setTextColor(p.label2)
            letterSpacing = 0.08f
        })
        pad.addView(TextView(ctx).apply {
            text = Ios.money(net)
            textSize = 44f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(if (net >= 0) p.label else p.red)
            setPadding(0, dp(ctx, 2f), 0, dp(ctx, 14f))
        })
        pad.addView(View(ctx).apply {
            background = Ios.rounded(1f, p.separator, ctx)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 0.8f),
            ).apply { bottomMargin = dp(ctx, 12f) }
        })
        pad.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(miniStat("Gross", Ios.money(gross)))
            addView(miniStat("Hours", hours?.let { "%.1f".format(it) } ?: "—"))
            addView(miniStat("\$/hr", web?.optInt("perHourCents", -1)?.takeIf { it >= 0 }
                ?.let { Ios.money(it) } ?: "—"))
            addView(miniStat("Offers", offers?.toString() ?: OfferLog.all(ctx).size.toString()))
        })
        card.addView(pad)
        return card
    }

    private fun miniStat(label: String, value: String): View =
        LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addView(TextView(ctx).apply {
                text = value; textSize = Ios.T_HEADLINE
                setTypeface(typeface, Typeface.BOLD); setTextColor(p.label)
            })
            addView(TextView(ctx).apply {
                text = label; textSize = Ios.T_CAPTION; setTextColor(p.label2)
            })
        }

    /** 7-day gross bar chart. */
    private fun weekChartCard(): View {
        val card = Sections.card(ctx, p)
        val pad = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 18f), dp(ctx, 14f), dp(ctx, 18f), dp(ctx, 14f))
        }
        pad.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(TextView(ctx).apply {
                text = "This week"; textSize = Ios.T_HEADLINE
                setTypeface(typeface, Typeface.BOLD); setTextColor(p.label)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
            val wk = weekFromWeb()?.optInt("grossCents", -1) ?: -1
            addView(TextView(ctx).apply {
                text = if (wk >= 0) Ios.money(wk) else "—"
                textSize = Ios.T_HEADLINE; setTextColor(p.label2)
            })
        })
        val days = summary?.optJSONArray("series")
        val vals = FloatArray(7)
        val labels = arrayOf("M","T","W","T","F","S","S")
        if (days != null) {
            for (i in 0 until minOf(days.length(), 7)) {
                vals[i + (7 - minOf(days.length(), 7))] = days.getJSONObject(i).optInt("grossCents").toFloat()
            }
        }
        pad.addView(WeekBars(ctx, p, vals, labels).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 84f),
            ).apply { topMargin = dp(ctx, 10f) }
        })
        card.addView(pad)
        return card
    }

    private fun assistantCard(): View {
        val card = Sections.card(ctx, p)
        val on = OverlayController.isServiceEnabled(ctx)
        card.addView(Sections.row(ctx, p,
            title = "Offer Assistant",
            subtitle = if (on) "Watching your driver apps for offers" else "Off — offers won't be scored",
            value = null,
            iconGlyph = "bolt",
            iconTint = if (on) p.green else p.gray,
        ))
        if (!on) {
            card.addView(Sections.separator(ctx, p))
            card.addView(Sections.row(ctx, p,
                title = "Enable in Settings",
                subtitle = "Takes 10 seconds — Android accessibility settings",
                chevron = true,
                iconGlyph = "slider", iconTint = p.tint,
            ) {
                ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))
            })
        }
        return card
    }

    private fun todayRecordsCard(): View {
        val card = Sections.card(ctx, p)
        val recent = db.all(5)
        if (recent.isEmpty()) {
            card.addView(TextView(ctx).apply {
                text = "Nothing logged yet — use the Track tab."
                textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                setPadding(dp(ctx, 18f), dp(ctx, 14f), dp(ctx, 18f), dp(ctx, 14f))
            })
        } else {
            recent.forEachIndexed { i, r ->
                if (i > 0) card.addView(Sections.separator(ctx, p))
                card.addView(recordRow(r))
            }
        }
        return card
    }

    private fun recordRow(r: LocalDb.Row): View {
        val (glyph, tint, label, amount) = when (r.type) {
            "earning" -> Quad("bolt", p.green, "Earning", "+${Ios.money(r.payload.optInt("amountCents"))}")
            "expense" -> Quad("tag", p.red, "Expense", "-${Ios.money(r.payload.optInt("amountCents"))}")
            else -> Quad("speed", p.tint, "Mileage", distanceText(r.payload.optDouble("distanceKm")))
        }
        return Sections.row(ctx, p,
            title = label,
            subtitle = SimpleDateFormat("h:mm a", Locale.US).format(Date(r.createdAt)) +
                if (!r.synced) " · pending sync" else "",
            value = amount,
            iconGlyph = glyph, iconTint = tint,
        )
    }

    private fun distanceText(km: Double) = if (settings.distanceUnit == "KM")
        "%.1f km".format(km) else "%.1f mi".format(km * 0.621371)

    private data class Quad(val a: String, val b: Int, val c: String, val d: String)

    /** Minimal 7-bar chart, iOS-tinted, rounded tops. */
    private class WeekBars(ctx: Context, private val p: Palette, private val vals: FloatArray, private val labels: Array<String>) : View(ctx) {
        private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.tint }
        private val ghostPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.fill }
        private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = p.label2; textSize = Ios.dp(ctx, 10f).toFloat(); textAlign = Paint.Align.CENTER
        }
        override fun onDraw(c: Canvas) {
            val n = vals.size
            val slot = width / n.toFloat()
            val bw = slot * 0.42f
            val max = (vals.maxOrNull() ?: 1f).coerceAtLeast(1f)
            val labelH = height * 0.2f
            val chartH = height - labelH
            for (i in 0 until n) {
                val cx = slot * i + slot / 2
                val h = if (vals[i] <= 0) dp(context, 4f).toFloat() else (vals[i] / max) * (chartH - dp(context, 4f)) + dp(context, 4f)
                val paint = if (vals[i] <= 0) ghostPaint else barPaint
                c.drawRoundRect(RectF(cx - bw / 2, chartH - h, cx + bw / 2, chartH), bw / 2, bw / 2, paint)
                c.drawText(labels[i], cx, height - dp(context, 2f).toFloat(), textPaint)
            }
        }
    }
}
