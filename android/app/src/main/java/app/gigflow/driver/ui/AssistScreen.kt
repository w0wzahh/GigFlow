package app.gigflow.driver.ui

import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp

/** Assist — assistant status, rules, automation switches, sync config. */
class AssistScreen(
    ctx: Context,
    private val p: Palette,
    private val settings: SettingsRepository,
    private val db: LocalDb,
) {
    val screen = Screen(ctx, p, "Assistant")
    private val ctx: Context = ctx

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        c.addView(statusCard())
        c.addView(Sections.header(ctx, p, "Automation"))
        c.addView(automationCard())
        c.addView(Sections.header(ctx, p, "Offer rules"))
        c.addView(rulesCard())
        c.addView(Sections.header(ctx, p, "Preferences"))
        c.addView(preferencesCard())
        c.addView(Sections.header(ctx, p, "GigFlow sync"))
        c.addView(syncCard())
        c.addView(Sections.header(ctx, p, "About"))
        c.addView(aboutCard())
        c.addView(Sections.header(ctx, p, "Credits"))
        c.addView(creditsCard())
        screen.animateIn()
    }

    private fun statusCard(): View {
        val card = Sections.card(ctx, p)
        val on = OverlayController.isServiceEnabled(ctx)
        card.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(dp(ctx, 16f), dp(ctx, 14f), dp(ctx, 16f), dp(ctx, 14f))
            addView(View(ctx).apply {
                background = Ios.rounded(14f, if (on) p.green else p.red, ctx)
                layoutParams = LinearLayout.LayoutParams(dp(ctx, 10f), dp(ctx, 10f))
                    .apply { rightMargin = dp(ctx, 12f) }
            })
            addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                addView(TextView(ctx).apply {
                    text = if (on) "Assistant is on" else "Assistant is off"
                    textSize = Ios.T_HEADLINE
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(p.label)
                })
                addView(TextView(ctx).apply {
                    text = if (on) "Scoring offers in your driver apps"
                    else "Enable it to score and auto-act on offers"
                    textSize = Ios.T_FOOTNOTE
                    setTextColor(p.label2)
                })
            })
            if (!on) {
                addView(iosButton(ctx, p, "Enable").apply {
                    minHeight = dp(ctx, 34f)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT, dp(ctx, 34f))
                    textSize = Ios.T_SUBHEAD
                    setOnClickListener {
                        ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                    }
                })
            }
        })
        return card
    }

    private fun automationCard(): View {
        val card = Sections.card(ctx, p)
        val (r1, _) = Sections.switchRow(ctx, p, "Monitoring",
            "Score offers as they appear", settings.enabled) { settings.enabled = it }
        val (r2, _) = Sections.switchRow(ctx, p, "Auto-accept good offers",
            "Only when every rule passes", settings.autoAccept) { settings.autoAccept = it }
        val (r3, _) = Sections.switchRow(ctx, p, "Auto-decline bad offers",
            "Only when most rules fail", settings.autoDecline) { settings.autoDecline = it }
        card.addView(r1); card.addView(Sections.separator(ctx, p))
        card.addView(r2); card.addView(Sections.separator(ctx, p))
        card.addView(r3)
        c_footer(card, "GigFlow only taps when the button is found clearly. It never touches other apps.")
        return card
    }

    private fun rulesCard(): View {
        val card = Sections.card(ctx, p)
        val isKm = settings.distanceUnit == "KM"
        val (rMile, mile) = Sections.formField(ctx, p,
            "Min $ / ${if (isKm) "km" else "mile"}",
            "%.2f".format(if (isKm) settings.minPerMileCents / 1.609344 / 100.0 else settings.minPerMileCents / 100.0))
        val (rHour, hour) = Sections.formField(ctx, p, "Min $ / hour", "%.2f".format(settings.minPerHourCents / 100.0))
        val (rPayout, payout) = Sections.formField(ctx, p, "Min payout", "%.2f".format(settings.minPayoutCents / 100.0), hint = "$")
        val (rDist, dist) = Sections.formField(ctx, p, "Max distance (${if (isKm) "km" else "mi"})",
            "%.1f".format(if (isKm) settings.maxDistanceKm else settings.maxDistanceKm * 0.621371))
        card.addView(rMile); card.addView(Sections.separator(ctx, p))
        card.addView(rHour); card.addView(Sections.separator(ctx, p))
        card.addView(rPayout); card.addView(Sections.separator(ctx, p))
        card.addView(rDist); card.addView(Sections.separator(ctx, p))
        card.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f))
            val btn = iosButton(ctx, p, "Save rules")
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            btn.setOnClickListener {
                val perDist = (mile.text.toString().toDoubleOrNull() ?: 1.5) * 100
                settings.minPerMileCents = (if (isKm) perDist * 1.609344 else perDist).toInt()
                settings.minPerHourCents = ((hour.text.toString().toDoubleOrNull() ?: 20.0) * 100).toInt()
                settings.minPayoutCents = ((payout.text.toString().toDoubleOrNull() ?: 4.0) * 100).toInt()
                settings.maxDistanceKm = (dist.text.toString().toDoubleOrNull() ?: 25.0).let {
                    if (isKm) it else it / 0.621371
                }
                Toast.makeText(ctx, "Saved", Toast.LENGTH_SHORT).show()
            }
        })
        return card
    }

    private fun syncCard(): View {
        val card = Sections.card(ctx, p)
        val (rUrl, url) = Sections.formField(ctx, p, "Web URL", settings.syncBaseUrl, numeric = false, hint = "http://192.168.1.5:3000")
        val (rToken, token) = Sections.formField(ctx, p, "Token", settings.syncToken, numeric = false, hint = "gf_…")
        token.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        card.addView(rUrl); card.addView(Sections.separator(ctx, p))
        card.addView(rToken); card.addView(Sections.separator(ctx, p))
        card.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f))
            val btn = iosButton(ctx, p, "Connect")
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            btn.setOnClickListener {
                settings.syncBaseUrl = url.text.toString()
                settings.syncToken = token.text.toString()
                // flush any offline records
                val pending = db.unsynced()
                if (pending.isNotEmpty()) {
                    GigFlowApi.pushBatch(settings.syncBaseUrl, settings.syncToken, pending) { ok ->
                        if (ok) pending.forEach { db.markSynced(it.clientId) }
                    }
                }
                Toast.makeText(ctx, if (settings.syncBaseUrl.isBlank()) "Sync off" else "Saved", Toast.LENGTH_SHORT).show()
            }
        })
        return card
    }

    private fun aboutCard(): View {
        val card = Sections.card(ctx, p)
        card.addView(Sections.row(ctx, p,
            title = "Watched apps",
            value = "${ctx.resources.getStringArray(app.gigflow.driver.R.array.watched_packages).size} driver apps",
            iconGlyph = "grid", iconTint = p.tint,
            chevron = true,
        ) { showWatchedApps() })
        card.addView(Sections.separator(ctx, p))
        card.addView(Sections.row(ctx, p,
            title = "Version",
            value = "0.1.0",
            iconGlyph = "doc", iconTint = p.gray,
        ))
        c_footer(card, "Everything stays on-device except the fields you sync. GigFlow isn't affiliated with any gig platform.")
        return card
    }

    /** Units, overlay timing, haptics, log management. */
    private fun preferencesCard(): View {
        val card = Sections.card(ctx, p)

        // Distance unit — segmented
        card.addView(prefSegmentedRow("Units", listOf("Miles", "Kilometres"),
            if (settings.distanceUnit == "KM") 1 else 0) {
            settings.distanceUnit = if (it == 1) "KM" else "MI"
        })
        card.addView(Sections.separator(ctx, p))

        // Overlay timeout — segmented
        val secs = listOf(0, 10, 30, 60)
        card.addView(prefSegmentedRow("Overlay shows for",
            listOf("Until gone", "10 s", "30 s", "60 s"),
            secs.indexOf(settings.overlaySeconds).coerceAtLeast(0)) {
            settings.overlaySeconds = secs[it]
        })
        card.addView(Sections.separator(ctx, p))

        // Haptics
        val (rHap, _) = Sections.switchRow(ctx, p, "Haptic feedback",
            "Vibrate on taps and toggles", settings.haptics) { settings.haptics = it }
        card.addView(rHap)
        card.addView(Sections.separator(ctx, p))

        // Clear offer log — destructive
        card.addView(Sections.row(ctx, p,
            title = "Clear offer log",
            subtitle = "Removes the local history of scored offers",
            iconGlyph = "trash", iconTint = p.red,
        ) {
            OfferLog.clear(ctx)
            Toast.makeText(ctx, "Offer log cleared", Toast.LENGTH_SHORT).show()
        })
        return card
    }

    private fun prefSegmentedRow(
        label: String, options: List<String>, initial: Int, onPick: (Int) -> Unit,
    ): View {
        return LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 16f), dp(ctx, 10f), dp(ctx, 16f), dp(ctx, 12f))
            addView(TextView(ctx).apply {
                text = label; textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                setPadding(0, 0, 0, dp(ctx, 8f))
            })
            addView(IosSegmented(ctx, p, options, initial = initial).apply {
                onSelected = onPick
            })
        }
    }

    private fun showWatchedApps() {
        val sheet = IosSheet(ctx, p)
        val names = listOf(
            "Uber Driver" to "com.uber.driver",
            "Lyft Driver" to "com.lyft.driver",
            "Dasher" to "com.doordash.driverapp",
            "Instacart Shopper" to "com.instacart.shopper",
            "Amazon Flex" to "com.amazon.rabbit",
            "Spark Driver" to "com.walmart.driver.spark",
            "Wolt Courier Partner" to "com.wolt.courierapp",
            "foodora rider" to "com.logistics.rider.foodora",
        )
        val col = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 20f), dp(ctx, 4f), dp(ctx, 20f), dp(ctx, 12f))
        }
        col.addView(TextView(ctx).apply {
            text = "Watched apps"
            textSize = Ios.T_HEADLINE
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(p.label)
            setPadding(0, 0, 0, dp(ctx, 10f))
        })
        names.forEach { (name, pkg) ->
            col.addView(LinearLayout(ctx).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, dp(ctx, 6f), 0, dp(ctx, 6f))
                addView(TextView(ctx).apply {
                    text = name; textSize = Ios.T_BODY; setTextColor(p.label)
                })
                addView(TextView(ctx).apply {
                    text = pkg; textSize = Ios.T_CAPTION; setTextColor(p.label3)
                })
            })
        }
        col.addView(TextView(ctx).apply {
            text = "The assistant only reads these apps. It can't see anything else on your phone."
            textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
            setPadding(0, dp(ctx, 8f), 0, 0)
        })
        sheet.add(col).show()
    }

    private fun creditsCard(): View {
        val card = Sections.card(ctx, p)
        card.addView(Sections.row(ctx, p,
            title = "Made by w0wzahh",
            subtitle = "Open source · feedback welcome",
            iconGlyph = "person", iconTint = p.tint,
        ))
        card.addView(Sections.separator(ctx, p))
        card.addView(Sections.row(ctx, p,
            title = "GitHub",
            subtitle = "github.com/w0wzahh",
            iconGlyph = "link", iconTint = p.gray,
            chevron = true,
        ) { openUrl("https://github.com/w0wzahh") })
        card.addView(Sections.separator(ctx, p))
        card.addView(Sections.row(ctx, p,
            title = "Support on Ko-fi",
            subtitle = "Buy the dev a coffee — ko-fi.com/w0wzahh",
            iconGlyph = "heart", iconTint = p.red,
            chevron = true,
        ) { openUrl("https://ko-fi.com/w0wzahh") })
        return card
    }

    private fun openUrl(url: String) {
        try {
            ctx.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
        } catch (_: Exception) {
            Toast.makeText(ctx, url, Toast.LENGTH_SHORT).show()
        }
    }

    private fun c_footer(card: LinearLayout, text: String) {
        card.addView(TextView(ctx).apply {
            this.text = text
            textSize = Ios.T_CAPTION
            setTextColor(p.label3)
            setPadding(dp(ctx, 16f), dp(ctx, 6f), dp(ctx, 16f), dp(ctx, 10f))
        })
    }
}
