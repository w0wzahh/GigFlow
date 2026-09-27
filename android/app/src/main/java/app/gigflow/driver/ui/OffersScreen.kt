package app.gigflow.driver.ui

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import app.gigflow.driver.OfferLog
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import app.gigflow.driver.ui.Ios.haptic
import app.gigflow.driver.ui.Ios.pressable
import java.text.SimpleDateFormat
import java.util.*

/** Offers — the assistant's scored-offer feed with verdict filters. */
class OffersScreen(ctx: Context, private val p: Palette, private val settings: app.gigflow.driver.SettingsRepository) {

    val screen = Screen(ctx, p, "Offers")
    private val ctx: Context = ctx
    private var filter = 0 // 0 all, 1 good, 2 meh, 3 bad

    private fun isKm() = settings.distanceUnit == "KM"
    private fun distText(km: Double) =
        "%.1f %s".format(if (isKm()) km else km * 0.621371, if (isKm()) "km" else "mi")
    private fun perDistText(centsPerMile: Int) =
        "$%.2f/%s".format(
            (if (isKm()) centsPerMile / 1.609344 else centsPerMile.toDouble()) / 100f,
            if (isKm()) "km" else "mi",
        )

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        val segWrap = FrameLayout(ctx).apply {
            setPadding(dp(ctx, 16f), dp(ctx, 4f), dp(ctx, 16f), 0)
        }
        val seg = IosSegmented(ctx, p, listOf("All", "Good", "Borderline", "Skipped"), initial = filter)
        seg.onSelected = { filter = it; refresh() }
        segWrap.addView(seg)
        c.addView(segWrap)

        val entries = OfferLog.all(ctx).filter {
            when (filter) {
                1 -> it.verdict == "GOOD"
                2 -> it.verdict == "MEH"
                3 -> it.verdict == "BAD"
                else -> true
            }
        }

        if (entries.isEmpty()) {
            c.addView(emptyState())
            screen.animateIn()
            return
        }

        // Group by day, iOS-style sectioned list
        val byDay = entries.groupBy { dayKey(it.at) }
        byDay.forEach { (day, list) ->
            c.addView(Sections.header(ctx, p, day))
            val card = Sections.card(ctx, p)
            list.forEachIndexed { i, e ->
                if (i > 0) card.addView(Sections.separator(ctx, p))
                card.addView(offerRow(e))
            }
            c.addView(card)
        }
        screen.animateIn()
    }

    private fun offerRow(e: OfferLog.Entry): View {
        val verdictColor = when (e.verdict) {
            "GOOD" -> p.green; "MEH" -> p.orange; else -> p.red
        }
        val verdictLabel = when (e.verdict) {
            "GOOD" -> "Good offer"; "MEH" -> "Borderline"; else -> "Skipped"
        }
        val app = e.pkg.substringAfterLast('.')
            .replace("driverapp", "Dasher").replaceFirstChar { it.uppercase() }
        val stats = buildString {
            if (e.reservation) append("Reserved")
            e.distanceKm?.let { if (isNotEmpty()) append(" · "); append(distText(it)) }
            e.durationMin?.let { if (isNotEmpty()) append(" · "); append("${it.toInt()} min") }
            e.perMileCents?.let { if (isNotEmpty()) append(" · "); append(perDistText(it)) }
            if (e.action != "shown") {
                if (isNotEmpty()) append(" · ")
                append(e.action.replace('_', ' '))
            }
        }

        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(ctx, 16f), dp(ctx, 11f), dp(ctx, 16f), dp(ctx, 11f))
        }
        // verdict dot
        row.addView(View(ctx).apply {
            background = Ios.rounded(6f, verdictColor, ctx)
            layoutParams = LinearLayout.LayoutParams(dp(ctx, 10f), dp(ctx, 10f))
                .apply { rightMargin = dp(ctx, 12f) }
        })
        row.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                addView(TextView(ctx).apply {
                    text = Ios.money(e.payoutCents)
                    textSize = Ios.T_HEADLINE
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(p.label)
                })
                addView(TextView(ctx).apply {
                    text = "  $app"
                    textSize = Ios.T_SUBHEAD
                    setTextColor(p.label2)
                })
            })
            addView(TextView(ctx).apply {
                text = stats.ifEmpty { "Offer seen" }
                textSize = Ios.T_FOOTNOTE
                setTextColor(p.label2)
                setPadding(0, dp(ctx, 1f), 0, 0)
            })
        })
        row.addView(TextView(ctx).apply {
            text = verdictLabel
            textSize = Ios.T_CAPTION
            setTextColor(verdictColor)
            setTypeface(typeface, Typeface.BOLD)
        })
        row.pressable()
        row.setOnClickListener { row.haptic(); showDetail(e, verdictColor, verdictLabel) }
        return row
    }

    /** Offer detail sheet — full metrics + action taken. */
    private fun showDetail(e: OfferLog.Entry, tint: Int, verdictLabel: String) {
        val sheet = IosSheet(ctx, p)
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 20f), dp(ctx, 8f), dp(ctx, 20f), dp(ctx, 16f))
        }
        col.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(View(ctx).apply {
                background = Ios.rounded(7f, tint, ctx)
                layoutParams = LinearLayout.LayoutParams(dp(ctx, 12f), dp(ctx, 12f))
                    .apply { rightMargin = dp(ctx, 10f) }
            })
            addView(TextView(ctx).apply {
                text = "${Ios.money(e.payoutCents)} · $verdictLabel"
                textSize = Ios.T_HEADLINE; setTypeface(typeface, Typeface.BOLD); setTextColor(p.label)
            })
        })
        col.addView(TextView(ctx).apply {
            text = e.pkg.substringAfterLast('.') + " · " +
                SimpleDateFormat("EEE, MMM d 'at' h:mm a", Locale.US).format(Date(e.at))
            textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
            setPadding(0, dp(ctx, 4f), 0, dp(ctx, 14f))
        })
        val metrics = listOfNotNull(
            if (e.reservation) "Type" to "Reservation" else null,
            e.distanceKm?.let { "Distance" to distText(it) },
            e.durationMin?.let { "Duration" to "${it.toInt()} min" },
            e.perMileCents?.let { "Per ${if (isKm()) "kilometre" else "mile"}" to perDistText(it).substringBefore('/') },
            e.perHourCents?.let { "Per hour" to "$%.2f".format(it / 100f) },
            "Action" to (if (e.action == "shown") "Seen only" else e.action.replace('_', ' ')),
        )
        metrics.forEachIndexed { i, (k, v) ->
            if (i > 0) col.addView(Sections.separator(ctx, p))
            col.addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, dp(ctx, 9f), 0, dp(ctx, 9f))
                addView(TextView(ctx).apply {
                    text = k; textSize = Ios.T_BODY; setTextColor(p.label2)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                })
                addView(TextView(ctx).apply {
                    text = v; textSize = Ios.T_BODY; setTextColor(p.label)
                    setTypeface(typeface, Typeface.BOLD)
                })
            })
        }
        sheet.add(col).show()
    }

    private fun emptyState(): View = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(ctx, 40f), dp(ctx, 80f), dp(ctx, 40f), dp(ctx, 40f))
        addView(TextView(ctx).apply {
            text = "No offers yet"
            textSize = Ios.T_TITLE2
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(p.label)
            gravity = Gravity.CENTER
        })
        addView(TextView(ctx).apply {
            text = "Go online in a driver app — when an offer card appears, GigFlow scores it and it shows up here."
            textSize = Ios.T_SUBHEAD
            setTextColor(p.label2)
            gravity = Gravity.CENTER
            setPadding(0, dp(ctx, 8f), 0, 0)
        })
    }

    private fun dayKey(ts: Long): String {
        val cal = Calendar.getInstance().apply { timeInMillis = ts }
        val today = Calendar.getInstance()
        val yest = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
        return when {
            cal.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR) &&
                cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) -> "Today"
            cal.get(Calendar.DAY_OF_YEAR) == yest.get(Calendar.DAY_OF_YEAR) &&
                cal.get(Calendar.YEAR) == yest.get(Calendar.YEAR) -> "Yesterday"
            else -> SimpleDateFormat("EEEE, MMM d", Locale.US).format(Date(ts))
        }
    }
}
