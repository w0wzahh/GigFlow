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
import java.text.SimpleDateFormat
import java.util.*

/**
 * Dashboard — today at a glance plus the full analytics section:
 * period toggle, rates, platform breakdown, daily chart, recent activity.
 */
class DashboardScreen(
    private val activity: android.app.Activity,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(activity, p, "Dashboard")
    private val ctx: Context = activity
    private var period = 0 // 0 week, 1 month

    fun refresh(animate: Boolean = true) {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(greeting())
        if (!OverlayController.isServiceEnabled(ctx)) c.addView(serviceBanner())
        c.addView(heroCard())
        c.addView(gap(10f))
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
        c.addView(Sections.header(ctx, p, "Recent activity"))
        c.addView(todayRecordsCard())
        c.addView(gap(24f))

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

    private fun isKm() = settings.distanceUnit == "KM"
    private fun dist(km: Double) = if (isKm()) "%.1f km".format(km)
        else "%.1f mi".format(km * 0.621371)
    private fun perDist(centsPerKm: Int?) = centsPerKm?.let {
        money(if (isKm()) it else (it * 1.609344).toInt())
    } ?: "—"

    private fun heroCard(): View {
        val card = Sections.card(ctx, p)
        val dayStart = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        val local = db.totals(dayStart)

        val gross = local.earnedCents
        val net = local.earnedCents - local.spentCents
        val hours = db.stats(dayStart).hours.takeIf { it > 0 }
        val offers = OfferLog.all(ctx).count { it.at >= dayStart }

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
            addView(miniStat("${settings.currencySymbol}/hr",
                if (hours != null && hours > 0) money((gross / hours).toInt()) else "—"))
            addView(miniStat("Offers", offers.toString()))
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

    /** Effective aggregate — always computed from on-device records. */
    private fun agg(): Agg {
        val s = local()
        return Agg(s.earnedCents, s.earnedCents - s.spentCents, s.spentCents,
            s.hours, s.km, s.jobs, s.tipCents)
    }

    /** Net for the week before this one — powers the WoW delta chip. */
    private fun prevWeekNet(): Int {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            set(Calendar.DAY_OF_WEEK, firstDayOfWeek)
            if (timeInMillis > System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR, -7)
        }
        val weekStart = cal.timeInMillis
        val prevStart = weekStart - 7L * 24 * 3600 * 1000
        var net = 0
        db.all(500).forEach { r ->
            if (r.createdAt in prevStart until weekStart) {
                when (r.type) {
                    "earning" -> net += r.payload.optInt("amountCents")
                    "expense" -> net -= r.payload.optInt("amountCents")
                }
            }
        }
        return net
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
                val prev = prevWeekNet()
                if (prev > 0) {
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

    /** Per-platform gross — from locally logged/auto-captured earnings. */
    private fun platformCard(): View? {
        data class Pl(val key: String, var gross: Int, var jobs: Int)
        val byKey = linkedMapOf<String, Pl>()
        db.all(500).forEach { r ->
            if (r.type != "earning") return@forEach
            val key = r.payload.optString("platformKey").ifBlank { "other" }
            val pl = byKey.getOrPut(key) { Pl(key, 0, 0) }
            pl.gross += r.payload.optInt("amountCents"); pl.jobs++
        }
        if (byKey.isEmpty()) return null
        val names = mapOf(
            "uber" to "Uber", "lyft" to "Lyft", "doordash" to "DoorDash",
            "instacart" to "Instacart", "amazon-flex" to "Amazon Flex",
            "spark" to "Spark", "wolt" to "Wolt", "foodora" to "foodora",
            "other" to "Other",
        )
        val card = Sections.card(ctx, p)
        val max = byKey.values.maxOf { it.gross }.coerceAtLeast(1)
        byKey.values.sortedByDescending { it.gross }.forEachIndexed { i, pl ->
            if (i > 0) card.addView(Sections.separator(ctx, p))
            card.addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(ctx, 16f), dp(ctx, 11f), dp(ctx, 16f), dp(ctx, 11f))
                addView(LinearLayout(ctx).apply {
                    orientation = LinearLayout.HORIZONTAL
                    addView(TextView(ctx).apply {
                        text = names[pl.key] ?: pl.key.replaceFirstChar { it.uppercase() }
                        textSize = Ios.T_BODY; setTextColor(p.label)
                        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    })
                    addView(TextView(ctx).apply {
                        text = money(pl.gross) +
                            " · ${pl.jobs} job${if (pl.jobs == 1) "" else "s"}"
                        textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                    })
                })
                addView(ProgressBar(ctx, p, pl.gross * 100 / max).apply {
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
        val vals = FloatArray(7)
        db.dailyGross(7).copyInto(vals)
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
            subtitle = SimpleDateFormat("h:mm a", Locale.US).format(Date(r.createdAt)),
            value = amount,
            iconGlyph = glyph, iconTint = tint,
        )
    }

    private data class Quad(val a: String, val b: Int, val c: String, val d: String)
}
