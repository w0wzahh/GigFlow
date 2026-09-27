package app.gigflow.driver

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.text.format.DateFormat
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import java.util.Date

class MainActivity : Activity() {

    private lateinit var prefs: SettingsRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        prefs = SettingsRepository(this)

        findViewById<Button>(R.id.enableBtn).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        val enabledSwitch = findViewById<Switch>(R.id.enabledSwitch)
        val autoAccept = findViewById<Switch>(R.id.autoAcceptSwitch)
        val autoDecline = findViewById<Switch>(R.id.autoDeclineSwitch)

        enabledSwitch.isChecked = prefs.enabled
        autoAccept.isChecked = prefs.autoAccept
        autoDecline.isChecked = prefs.autoDecline

        enabledSwitch.setOnCheckedChangeListener { _, on -> prefs.enabled = on }
        autoAccept.setOnCheckedChangeListener { _, on -> prefs.autoAccept = on }
        autoDecline.setOnCheckedChangeListener { _, on -> prefs.autoDecline = on }

        val minMile = findViewById<EditText>(R.id.minPerMileInput)
        val minHour = findViewById<EditText>(R.id.minPerHourInput)
        val minPayout = findViewById<EditText>(R.id.minPayoutInput)
        val maxDist = findViewById<EditText>(R.id.maxDistanceInput)

        minMile.setText("%.2f".format(prefs.minPerMileCents / 100.0))
        minHour.setText("%.2f".format(prefs.minPerHourCents / 100.0))
        minPayout.setText("%.2f".format(prefs.minPayoutCents / 100.0))
        maxDist.setText("%.1f".format(prefs.maxDistanceKm * 0.621371))

        findViewById<Button>(R.id.saveRulesBtn).setOnClickListener {
            prefs.minPerMileCents = ((minMile.text.toString().toDoubleOrNull() ?: 1.5) * 100).toInt()
            prefs.minPerHourCents = ((minHour.text.toString().toDoubleOrNull() ?: 20.0) * 100).toInt()
            prefs.minPayoutCents = ((minPayout.text.toString().toDoubleOrNull() ?: 4.0) * 100).toInt()
            prefs.maxDistanceKm = (maxDist.text.toString().toDoubleOrNull() ?: 25.0) / 0.621371
            toast("Rules saved")
        }

        val syncUrl = findViewById<EditText>(R.id.syncUrlInput)
        val syncToken = findViewById<EditText>(R.id.syncTokenInput)
        syncUrl.setText(prefs.syncBaseUrl)
        syncToken.setText(prefs.syncToken)
        findViewById<Button>(R.id.saveSyncBtn).setOnClickListener {
            prefs.syncBaseUrl = syncUrl.text.toString()
            prefs.syncToken = syncToken.text.toString()
            toast("Sync settings saved")
        }

        findViewById<Button>(R.id.clearLogBtn).setOnClickListener {
            OfferLog.clear(this)
            renderLog()
        }
    }

    override fun onResume() {
        super.onResume()
        val on = OverlayController.isServiceEnabled(this)
        findViewById<TextView>(R.id.statusText).apply {
            text = if (on) "Accessibility service is ON" else "Accessibility service is OFF"
            setTextColor(if (on) Color.parseColor("#16915A") else Color.parseColor("#D2432E"))
        }
        findViewById<TextView>(R.id.statusSub).text = if (on)
            "GigFlow is watching your driver apps for offer cards."
        else
            "Tap below, find “GigFlow Offer Assistant”, and turn it on. It only reads the driver apps listed there."
        findViewById<Button>(R.id.enableBtn).visibility = if (on) View.GONE else View.VISIBLE
        renderLog()
    }

    private fun renderLog() {
        val list = findViewById<LinearLayout>(R.id.logList)
        list.removeAllViews()
        val entries = OfferLog.all(this)
        if (entries.isEmpty()) {
            list.addView(TextView(this).apply {
                text = "No offers seen yet. Open a driver app and go online."
                textSize = 13f
                setTextColor(Color.parseColor("#5D6472"))
                setPadding(0, 12, 0, 4)
            })
            return
        }
        val dp = resources.displayMetrics.density
        for (e in entries.take(50)) {
            val color = when (e.verdict) {
                "GOOD" -> "#16915A"; "MEH" -> "#B07A0D"; else -> "#D2432E"
            }
            list.addView(TextView(this).apply {
                val whenStr = DateFormat.format("MMM d, h:mm a", Date(e.at))
                val mi = e.distanceKm?.let { " · ${"%.1f".format(it * 0.621371)} mi" } ?: ""
                val min = e.durationMin?.let { " · ${it.toInt()} min" } ?: ""
                val pm = e.perMileCents?.let { " · $${"%.2f".format(it / 100.0)}/mi" } ?: ""
                val act = if (e.action != "shown") " — ${e.action.replace('_', ' ')}" else ""
                text = "${"$"}${"%.2f".format(e.payoutCents / 100.0)}$mi$min$pm$act\n$whenStr"
                textSize = 13f
                setTextColor(Color.parseColor("#16181D"))
                setPadding(0, 10, 0, 10)
                compoundDrawablePadding = (8 * dp).toInt()
                setCompoundDrawablesWithIntrinsicBounds(
                    android.graphics.drawable.GradientDrawable().apply {
                        shape = android.graphics.drawable.GradientDrawable.OVAL
                        setColor(Color.parseColor(color))
                        setSize((10 * dp).toInt(), (10 * dp).toInt())
                    }, null, null, null,
                )
            })
        }
    }

    private fun toast(msg: String) {
        android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_SHORT).show()
    }
}
