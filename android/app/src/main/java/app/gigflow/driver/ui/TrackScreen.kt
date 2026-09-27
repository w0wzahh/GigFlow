package app.gigflow.driver.ui

import android.content.Context
import android.graphics.Typeface
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * Track — quick-add earnings / expenses / mileage in iOS grouped-form style.
 * Saves locally first (works offline), then pushes to the web workspace.
 */
class TrackScreen(
    ctx: Context,
    private val p: Palette,
    private val db: LocalDb,
    private val settings: SettingsRepository,
) {
    val screen = Screen(ctx, p, "Track")
    private val ctx: Context = ctx
    private var kind = 0 // 0 earning, 1 expense, 2 mileage

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        // Segmented picker
        c.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 16f), dp(ctx, 4f), dp(ctx, 16f), dp(ctx, 8f))
            addView(IosSegmented(ctx, p, listOf("Earning", "Expense", "Mileage"), initial = kind).apply {
                onSelected = { kind = it; refresh() }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        })

        c.addView(Sections.header(ctx, p, when (kind) {
            0 -> "New earning"; 1 -> "New expense"; else -> "New mileage"
        }))
        val card = Sections.card(ctx, p)
        buildForm(card)
        c.addView(card)

        val unsynced = db.unsyncedCount()
        c.addView(Sections.header(ctx, p, "Recent"))
        val recentCard = Sections.card(ctx, p)
        val rows = db.all(8)
        if (rows.isEmpty()) {
            recentCard.addView(TextView(ctx).apply {
                text = "Records you add appear here."
                textSize = Ios.T_SUBHEAD; setTextColor(p.label2)
                setPadding(dp(ctx, 16f), dp(ctx, 14f), dp(ctx, 16f), dp(ctx, 14f))
            })
        } else {
            rows.forEachIndexed { i, r ->
                if (i > 0) recentCard.addView(Sections.separator(ctx, p))
                recentCard.addView(recentRow(r))
            }
        }
        c.addView(recentCard)

        if (unsynced > 0) {
            c.addView(TextView(ctx).apply {
                text = "$unsynced record${if (unsynced == 1) "" else "s"} will sync when you're online."
                textSize = Ios.T_FOOTNOTE
                setTextColor(p.label2)
                setPadding(dp(ctx, 20f), dp(ctx, 6f), 0, 0)
            })
        }
        screen.animateIn()
    }

    private fun buildForm(card: LinearLayout) {
        when (kind) {
            0 -> { // Earning
                val (rAmount, amount) = Sections.formField(ctx, p, "Amount", "", hint = "0.00")
                val (rTip, tip) = Sections.formField(ctx, p, "Tip", "", hint = "0.00")
                val (rHours, hours) = Sections.formField(ctx, p, "Hours", "", hint = "optional")
                card.addView(rAmount); card.addView(Sections.separator(ctx, p))
                card.addView(rTip); card.addView(Sections.separator(ctx, p))
                card.addView(rHours)
                addSaveRow(card, "Log earning") {
                    val amt = amount.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter an amount")
                    save("earning", JSONObject()
                        .put("amountCents", (amt * 100).toInt())
                        .put("tipCents", ((tip.text.toString().toDoubleOrNull() ?: 0.0) * 100).toInt())
                        .put("hours", hours.text.toString().toDoubleOrNull() ?: 0.0))
                }
            }
            1 -> { // Expense
                val (rAmount, amount) = Sections.formField(ctx, p, "Amount", "", hint = "0.00")
                val (rNote, note) = Sections.formField(ctx, p, "Note", "", numeric = false, hint = "gas, toll…")
                card.addView(rAmount); card.addView(Sections.separator(ctx, p))
                card.addView(rNote)
                addSaveRow(card, "Log expense") {
                    val amt = amount.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter an amount")
                    save("expense", JSONObject()
                        .put("amountCents", (amt * 100).toInt())
                        .put("category", "OTHER")
                        .put("description", note.text.toString().ifBlank { null }))
                }
            }
            else -> { // Mileage
                val (rDist, dist) = Sections.formField(ctx, p, "Miles", "", hint = "0.0")
                val (rFrom, from) = Sections.formField(ctx, p, "From", "", numeric = false, hint = "optional")
                card.addView(rDist); card.addView(Sections.separator(ctx, p))
                card.addView(rFrom)
                addSaveRow(card, "Log mileage") {
                    val mi = dist.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter a distance")
                    save("mileage", JSONObject()
                        .put("distanceKm", mi * 1.60934)
                        .put("purpose", "WORK")
                        .put("startLocation", from.text.toString().ifBlank { null }))
                }
            }
        }
    }

    private fun addSaveRow(card: LinearLayout, label: String, onSave: () -> Unit) {
        val btn = iosButton(ctx, p, label)
        card.addView(Sections.separator(ctx, p))
        card.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f))
            addView(btn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            btn.setOnClickListener { onSave() }
        })
    }

    private fun err(msg: String) {
        android.widget.Toast.makeText(ctx, msg, android.widget.Toast.LENGTH_SHORT).show()
    }

    private fun save(type: String, payload: JSONObject) {
        val row = db.insert(type, payload)
        GigFlowApi.pushRecord(settings.syncBaseUrl, settings.syncToken, row.payload) { ok ->
            if (ok) db.markSynced(row.clientId)
        }
        err("Saved")
        refresh()
    }

    private fun recentRow(r: LocalDb.Row): View {
        val (label, amount, tint) = when (r.type) {
            "earning" -> Triple("Earning", "+${Ios.money(r.payload.optInt("amountCents"))}", p.green)
            "expense" -> Triple(r.payload.optString("description").ifBlank { "Expense" }, "-${Ios.money(r.payload.optInt("amountCents"))}", p.red)
            else -> Triple("Mileage", "%.1f mi".format(r.payload.optDouble("distanceKm") * 0.621371), p.tint)
        }
        return Sections.row(ctx, p,
            title = label,
            subtitle = SimpleDateFormat("MMM d, h:mm a", Locale.US).format(Date(r.createdAt)) +
                if (!r.synced) " · pending" else "",
            value = amount,
        )
    }
}
