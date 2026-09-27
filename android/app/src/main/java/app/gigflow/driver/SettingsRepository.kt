package app.gigflow.driver

import android.content.Context
import android.content.SharedPreferences

class SettingsRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("gigflow_prefs", Context.MODE_PRIVATE)

    var enabled: Boolean
        get() = prefs.getBoolean("enabled", true)
        set(v) = prefs.edit().putBoolean("enabled", v).apply()

    var autoAccept: Boolean
        get() = prefs.getBoolean("auto_accept", false)
        set(v) = prefs.edit().putBoolean("auto_accept", v).apply()

    var autoDecline: Boolean
        get() = prefs.getBoolean("auto_decline", false)
        set(v) = prefs.edit().putBoolean("auto_decline", v).apply()

    var minPerMileCents: Int
        get() = prefs.getInt("min_per_mile", 150)
        set(v) = prefs.edit().putInt("min_per_mile", v).apply()

    var minPerHourCents: Int
        get() = prefs.getInt("min_per_hour", 2000)
        set(v) = prefs.edit().putInt("min_per_hour", v).apply()

    var minPayoutCents: Int
        get() = prefs.getInt("min_payout", 400)
        set(v) = prefs.edit().putInt("min_payout", v).apply()

    var maxDistanceKm: Double
        get() = prefs.getFloat("max_distance_km", 40f).toDouble()
        set(v) = prefs.edit().putFloat("max_distance_km", v.toFloat()).apply()

    /** GigFlow web app base URL, e.g. https://app.gigflow.example — empty = off. */
    var syncBaseUrl: String
        get() = prefs.getString("sync_base_url", "") ?: ""
        set(v) = prefs.edit().putString("sync_base_url", v.trim().removeSuffix("/")).apply()

    /** Personal mobile API token generated in Settings → Security. */
    var syncToken: String
        get() = prefs.getString("sync_token", "") ?: ""
        set(v) = prefs.edit().putString("sync_token", v.trim()).apply()

    fun rules() = RulePrefs(
        enabled = enabled,
        autoAccept = autoAccept,
        autoDecline = autoDecline,
        minPerMileCents = minPerMileCents,
        minPerHourCents = minPerHourCents,
        minPayoutCents = minPayoutCents,
        maxDistanceKm = maxDistanceKm,
    )
}
