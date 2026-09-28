package app.gigflow.driver.ui

import android.content.Context
import android.graphics.*
import android.view.Gravity
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

/**
 * Dashboard — today at a glance plus the full analytics section:
 * period toggle, rates, platform breakdown, daily chart, goals, insights.
 */
class DashboardScreen(
    private val activity: android.app.Activity,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(activity, p, "Dashboard")
    private val ctx: Context = activity
    private var summary: JSONObject? = null
    private var period = 0 // 0 week, 1 month

    private var lastSummaryFetch = 0L

    fun refresh(animate: Boolean = true, fetch: Boolean = true) {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(greeting())
        if (!OverlayController.isServiceEnabled(ctx)) c.addView(serviceBanner())
        c.addView(heroCard())
        c.addView(shareRow())
        c.addView(Sections.header(ctx, p, "Analytics"))
        c.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 16f), 0, dp(ctx, 16f), dp(ctx, 10f))
            addView(IosSegmented(ctx, p, listOf("This week", "This month"), initial = period).apply {
                // Silent rebuild — replaying animateIn() here made a simple
                // period toggle look like a full page refresh.
                onSelected = { period = it; refresh(animate = false) }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        })
        c.addView(periodHeroCard())
        c.addView(gap(10f))
        c.addView(gridCard())
        platformCard()?.let {
            c.addView(Sections.header(ctx, p, "By platform")); c.addView(it)
        }
        c.addView(Sections.header(ctx, p, "Daily gross"))
        c.addView(chartCard())
        c.addView(Sections.header(ctx, p, "Assistant"))
        c.addView(assistantCard())
        goalsCard()?.let { c.addView(Sections.header(ctx, p, "Goals")); c.addView(it) }
        insightsCard()?.let { c.addView(Sections.header(ctx, p, "Insights")); c.addView(it) }
        c.addView(Sections.header(ctx, p, "Recent activity"))
        c.addView(todayRecordsCard())
        c.addView(gap(24f))

        val now = System.currentTimeMillis()
        if (fetch && now - lastSummaryFetch > 30_000 &&
            GigFlowApi.configured(settings.syncBaseUrl, settings.syncToken)) {
            lastSummaryFetch = now
            GigFlowApi.fetchSummary(settings.syncBaseUrl, settings.syncToken) { s ->
                summary = s
                if (s != null) screen.post { refresh(animate = false, fetch = false) }
            }
        }
        if (animate) screen.animateIn()
    }

    /** Loud top-of-page warning — without the service the app is just a
     * manual tracker, which is the #1 "it doesn't work" complaint. */
    private fun serviceBanner(): View {
        val card = Sections.card(ctx, p)
        card.addView(Sections.row(ctx, p,
            title = "Offer assistant is off",
            subtitle = "Offers can't be scored or auto-accepted until you enable the accessibility service",
            iconGlyph = "bolt", iconTint = p.orange,
        ))
        card.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 16f), 0, dp(ctx, 16f), dp(ctx, 14f))
            val btn = iosButton(ctx, p, "Enable now — takes 10 seconds")
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            btn.setOnClickListener {
                ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        })
        return card
    }

    /** Mystro-style share: today's numbers as plain text via the share sheet. */
    private fun shareRow(): View {
        val card = Sections.card(ctx, p)
        card.addView(Sections.row(ctx, p,
            title = "Share today's summary",
            subtitle = "Sends your stats as text — nothing else leaves the phone",
            iconGlyph = "link", iconTint = p.tint, chevron = true,
        ) {
            val dayStart = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val local = db.totals(dayStart)
            val todayOffers = OfferLog.all(ctx).filter { it.at >= dayStart }
            val good = todayOffers.count { it.verdict == "GOOD" }
            val text = buildString {
                append("Today's GigFlow summary\n")
                append("Net: ${money(local.earnedCents - local.spentCents, settings.currencySymbol)}\n")
                append("Earned: ${money(local.earnedCents, settings.currencySymbol)}")
                append(" · Spent: ${money(local.spentCents, settings.currencySymbol)}\n")
                if (local.km > 0) append("Distance: ${dist(local.km)}\n")
                append("Offers scored: ${todayOffers.size}")
                if (good > 0) append(" ($good good)")
            }
            val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(android.content.Intent.EXTRA_TEXT, text)
            }
            ctx.startActivity(android.content.Intent.createChooser(send, "Share today's summary"))
        })
        return card
    }

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

    private fun money(cents: Int?, symbol: String = settings.currencySymbol) =
        Ios.money(cents, symbol)

    private fun todayFromWeb() = summary?.optJSONObject("today")
    private fun isKm() = settings.distanceUnit == "KM"
    private fun dist(km: Double) = if (isKm()) "%.1f km".format(km)
        else "%.1f mi".format(km * 0.621371)
    private fun perDist(centsPerKm: Int?) = centsPerKm?.let {
        money(if (isKm()) it else (it * 1.609344).toInt())
    } ?: "—"

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
            text = money(net)
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
            addView(miniStat("Gross", money(gross)))
            addView(miniStat("Hours", hours?.let { "%.1f".format(it) } ?: "—"))
            addView(miniStat("${settings.currencySymbol}/hr", web?.optInt("perHourCents", -1)?.takeIf { it >= 0 }
                ?.let { money(it) } ?: "—"))
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

    // ---- analytics (period-scoped) -----------------------------------------

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

    private fun periodHeroCard(): View {
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
                text = money(a.net)
                textSize = 34f; setTypeface(typeface, Typeface.BOLD)
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
                append("${money(a.gross)} earned · ${money(a.spent)} spent")
                if (a.tips > 0) append(" · ${money(a.tips)} tips")
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
        val perHr = if (a.hours > 0) money((a.gross / a.hours).toInt()) else "—"
        val perD = if (a.km > 0) perDist((a.gross / a.km).toInt()) else "—"
        val card = Sections.card(ctx, p)
        card.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(ctx, 12f), dp(ctx, 6f), dp(ctx, 12f), dp(ctx, 6f))
            addView(stat("${settings.currencySymbol} / hour", perHr))
            addView(stat("${settings.currencySymbol} / ${if (isKm()) "km" else "mi"}", perD))
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
                        text = money(pl.optInt("grossCents")) +
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
            db.dailyGross(7).copyInto(vals)
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

    // ---- assistant / goals / insights / activity ---------------------------

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

    /** Goal progress rows — mirrors the web goals panel. */
    private fun goalsCard(): View? {
        val goals = summary?.optJSONArray("goals") ?: return null
        if (goals.length() == 0) return null
        val card = Sections.card(ctx, p)
        for (i in 0 until goals.length()) {
            val g = goals.getJSONObject(i)
            if (i > 0) card.addView(Sections.separator(ctx, p))
            card.addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(ctx, 16f), dp(ctx, 12f), dp(ctx, 16f), dp(ctx, 12f))
                addView(LinearLayout(ctx).apply {
                    orientation = LinearLayout.HORIZONTAL
                    addView(TextView(ctx).apply {
                        text = g.optString("name")
                        textSize = Ios.T_SUBHEAD; setTextColor(p.label)
                        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    })
                    addView(TextView(ctx).apply {
                        text = "${money(g.optInt("progressCents"))} / ${money(g.optInt("targetCents"))}"
                        textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
                    })
                })
                addView(ProgressBar(ctx, p, g.optInt("progressPct")).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT, dp(ctx, 6f),
                    ).apply { topMargin = dp(ctx, 8f) }
                })
            })
        }
        return card
    }

    /** Insight strings computed on the server — shown when synced. */
    private fun insightsCard(): View? {
        val arr = summary?.optJSONArray("insights") ?: return null
        if (arr.length() == 0) return null
        val card = Sections.card(ctx, p)
        for (i in 0 until arr.length()) {
            if (i > 0) card.addView(Sections.separator(ctx, p))
            card.addView(Sections.row(ctx, p,
                title = arr.getString(i),
                iconGlyph = "bolt", iconTint = p.orange,
            ))
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
            "earning" -> Quad("bolt", p.green, "Earning", "+${money(r.payload.optInt("amountCents"))}")
            "expense" -> Quad("tag", p.red, "Expense", "-${money(r.payload.optInt("amountCents"))}")
            else -> Quad("speed", p.tint, "Mileage", dist(r.payload.optDouble("distanceKm")))
        }
        return Sections.row(ctx, p,
            title = label,
            subtitle = SimpleDateFormat("h:mm a", Locale.US).format(Date(r.createdAt)) +
                if (!r.synced) " · pending sync" else "",
            value = amount,
            iconGlyph = glyph, iconTint = tint,
        )
    }

    private data class Quad(val a: String, val b: Int, val c: String, val d: String)
}
