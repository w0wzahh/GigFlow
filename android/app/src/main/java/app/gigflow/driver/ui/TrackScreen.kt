package app.gigflow.driver.ui

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import app.gigflow.driver.*
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.dp
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

/**
 * Track — quick-add earnings / expenses / mileage in iOS grouped-form style.
 * Tap a record → action sheet with Edit / Delete. Saves locally first
 * (works offline), then pushes to the web workspace.
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
    private var editing: LocalDb.Row? = null

    fun refresh() {
        screen.column.removeAllViews()
        val c = screen.column

        // Segmented picker
        c.addView(LinearLayout(ctx).apply {
            setPadding(dp(ctx, 16f), dp(ctx, 4f), dp(ctx, 16f), dp(ctx, 8f))
            addView(IosSegmented(ctx, p, listOf("Earning", "Expense", "Mileage"), initial = kind).apply {
                onSelected = { kind = it; editing = null; refresh() }
            }, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        })

        c.addView(Sections.header(ctx, p, if (editing != null) "Edit record" else when (kind) {
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
                text = "Records you add appear here. Tap one to edit or delete."
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
        val edit = editing
        val pl = edit?.payload
        when (kind) {
            0 -> { // Earning
                val (rAmount, amount) = Sections.formField(ctx, p, "Amount",
                    edit?.let { "%.2f".format(pl!!.optInt("amountCents") / 100.0) } ?: "", hint = "0.00")
                val (rTip, tip) = Sections.formField(ctx, p, "Tip",
                    edit?.let { "%.2f".format(pl!!.optInt("tipCents") / 100.0) } ?: "", hint = "0.00")
                val (rHours, hours) = Sections.formField(ctx, p, "Hours",
                    edit?.let { pl!!.optDouble("hours").takeIf { h -> h > 0 }?.toString() ?: "" } ?: "", hint = "optional")
                card.addView(rAmount); card.addView(Sections.separator(ctx, p))
                card.addView(rTip); card.addView(Sections.separator(ctx, p))
                card.addView(rHours)
                addSaveRow(card, if (edit != null) "Save earning" else "Log earning", edit != null) {
                    val amt = amount.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter an amount")
                    save("earning", JSONObject()
                        .put("amountCents", (amt * 100).toInt())
                        .put("tipCents", ((tip.text.toString().toDoubleOrNull() ?: 0.0) * 100).toInt())
                        .put("hours", hours.text.toString().toDoubleOrNull() ?: 0.0))
                }
            }
            1 -> { // Expense
                val (rAmount, amount) = Sections.formField(ctx, p, "Amount",
                    edit?.let { "%.2f".format(pl!!.optInt("amountCents") / 100.0) } ?: "", hint = "0.00")
                val (rNote, note) = Sections.formField(ctx, p, "Note",
                    edit?.let { pl!!.optString("description") } ?: "", numeric = false, hint = "gas, toll…")
                card.addView(rAmount); card.addView(Sections.separator(ctx, p))
                card.addView(rNote)
                addSaveRow(card, if (edit != null) "Save expense" else "Log expense", edit != null) {
                    val amt = amount.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter an amount")
                    save("expense", JSONObject()
                        .put("amountCents", (amt * 100).toInt())
                        .put("category", "OTHER")
                        .put("description", note.text.toString().ifBlank { null }))
                }
            }
            else -> { // Mileage
                val (rDist, dist) = Sections.formField(ctx, p, "Miles",
                    edit?.let { "%.1f".format(pl!!.optDouble("distanceKm") * 0.621371) } ?: "", hint = "0.0")
                val (rFrom, from) = Sections.formField(ctx, p, "From",
                    edit?.let { pl!!.optString("startLocation") } ?: "", numeric = false, hint = "optional")
                card.addView(rDist); card.addView(Sections.separator(ctx, p))
                card.addView(rFrom)
                addSaveRow(card, if (edit != null) "Save mileage" else "Log mileage", edit != null) {
                    val mi = dist.text.toString().toDoubleOrNull() ?: return@addSaveRow err("Enter a distance")
                    save("mileage", JSONObject()
                        .put("distanceKm", mi * 1.60934)
                        .put("purpose", "WORK")
                        .put("startLocation", from.text.toString().ifBlank { null }))
                }
            }
        }
    }

    private fun addSaveRow(card: LinearLayout, label: String, isEdit: Boolean, onSave: () -> Unit) {
        card.addView(Sections.separator(ctx, p))
        card.addView(LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f), dp(ctx, 12f))
            if (isEdit) {
                val cancel = iosButton(ctx, p, "Cancel", p.fill)
                cancel.setTextColor(p.label)
                addView(cancel, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    .apply { rightMargin = dp(ctx, 8f) })
                cancel.setOnClickListener { editing = null; refresh() }
            }
            val btn = iosButton(ctx, p, label)
            addView(btn, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            btn.setOnClickListener { onSave() }
        })
    }

    /** Action sheet for a record — iOS-style: details + Edit + destructive Delete. */
    private fun showRecordSheet(r: LocalDb.Row) {
        val sheet = IosSheet(ctx, p)
        val pad = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 20f), dp(ctx, 8f), dp(ctx, 20f), 0)
        }
        pad.addView(TextView(ctx).apply {
            text = when (r.type) {
                "earning" -> "Earning · " + Ios.money(r.payload.optInt("amountCents"))
                "expense" -> (r.payload.optString("description").ifBlank { "Expense" }) +
                    " · " + Ios.money(r.payload.optInt("amountCents"))
                else -> "Mileage · %.1f mi".format(r.payload.optDouble("distanceKm") * 0.621371)
            }
            textSize = Ios.T_HEADLINE
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(p.label)
        })
        pad.addView(TextView(ctx).apply {
            text = SimpleDateFormat("EEEE, MMM d 'at' h:mm a", Locale.US).format(Date(r.createdAt)) +
                if (r.synced) " · synced" else " · pending sync"
            textSize = Ios.T_FOOTNOTE
            setTextColor(p.label2)
            setPadding(0, dp(ctx, 2f), 0, dp(ctx, 16f))
        })
        sheet.add(pad)

        val editBtn = iosButton(ctx, p, "Edit")
        val delBtn = iosButton(ctx, p, "Delete", p.red)
        val cancel = iosButton(ctx, p, "Cancel", p.fill)
        cancel.setTextColor(p.label)
        val btnCol = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(ctx, 16f), 0, dp(ctx, 16f), 0)
            listOf(editBtn, delBtn, cancel).forEach { b ->
                addView(b, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply { bottomMargin = dp(ctx, 8f) })
            }
        }
        sheet.add(btnCol)

        editBtn.setOnClickListener {
            sheet.dismiss()
            editing = r
            kind = when (r.type) { "earning" -> 0; "expense" -> 1; else -> 2 }
            refresh()
        }
        delBtn.setOnClickListener {
            sheet.dismiss()
            db.delete(r.clientId)
            GigFlowApi.deleteRecord(settings.syncBaseUrl, settings.syncToken, r.type, r.clientId)
            Toast.makeText(ctx, "Deleted", Toast.LENGTH_SHORT).show()
            refresh()
        }
        cancel.setOnClickListener { sheet.dismiss() }
        sheet.show()
        sheet.onDismiss { }
    }

    private fun err(msg: String) {
        Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show()
    }

    private fun save(type: String, payload: JSONObject) {
        val edit = editing
        if (edit != null) {
            db.update(edit.clientId, type, payload)
            GigFlowApi.updateRecord(settings.syncBaseUrl, settings.syncToken, type, edit.clientId, payload) { ok ->
                if (ok) db.markSynced(edit.clientId)
            }
            editing = null
            err("Updated")
        } else {
            val row = db.insert(type, payload)
            GigFlowApi.pushRecord(settings.syncBaseUrl, settings.syncToken, row.payload) { ok ->
                if (ok) db.markSynced(row.clientId)
            }
            err("Saved")
        }
        refresh()
    }

    private fun recentRow(r: LocalDb.Row): View {
        val (label, amount, tint) = when (r.type) {
            "earning" -> Triple("Earning", "+${Ios.money(r.payload.optInt("amountCents"))}", p.green)
            "expense" -> Triple(r.payload.optString("description").ifBlank { "Expense" },
                "-${Ios.money(r.payload.optInt("amountCents"))}", p.red)
            else -> Triple("Mileage", "%.1f mi".format(r.payload.optDouble("distanceKm") * 0.621371), p.tint)
        }
        return Sections.row(ctx, p,
            title = label,
            subtitle = SimpleDateFormat("MMM d, h:mm a", Locale.US).format(Date(r.createdAt)) +
                if (!r.synced) " · pending" else "",
            value = amount,
            iconGlyph = when (r.type) { "earning" -> "bolt"; "expense" -> "tag"; else -> "car" },
            iconTint = tint,
            chevron = true,
        ) { showRecordSheet(r) }
    }
}
