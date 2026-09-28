package app.gigflow.driver

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

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

    /** Currency symbol used in labels — thresholds are plain numbers, so a
     * Wolt driver sets Ft amounts and sees "Ft / km" instead of "$ / km". */
    var currencySymbol: String
        get() = prefs.getString("currency_symbol", "$") ?: "$"
        set(v) = prefs.edit().putString("currency_symbol",
            v.trim().ifEmpty { "$" }).apply()

    /** Display unit: "MI" or "KM". */
    var distanceUnit: String
        get() = prefs.getString("distance_unit", "MI") ?: "MI"
        set(v) = prefs.edit().putString("distance_unit", v).apply()

    /** Seconds the verdict overlay stays on screen; 0 = until the card disappears. */
    var overlaySeconds: Int
        get() = prefs.getInt("overlay_seconds", 0)
        set(v) = prefs.edit().putInt("overlay_seconds", v).apply()

    /** Haptic feedback on taps/toggles. */
    var haptics: Boolean
        get() = prefs.getBoolean("haptics", true)
        set(v) = prefs.edit().putBoolean("haptics", v).apply()

    /** Speak offer verdicts aloud — Mystro-style voice alerts. */
    var voiceAlerts: Boolean
        get() = prefs.getBoolean("voice_alerts", false)
        set(v) = prefs.edit().putBoolean("voice_alerts", v).apply()

    /** Seconds before auto-accept fires; user can cancel from the overlay. */
    var autoAcceptDelaySec: Int
        get() = prefs.getInt("auto_accept_delay", 5)
        set(v) = prefs.edit().putInt("auto_accept_delay", v).apply()

    /**
     * Start GPS shift tracking automatically when a watched driver app comes
     * to the foreground, and stop after a stretch away from them. Still needs
     * location permission — without it this silently does nothing.
     */
    var autoTrackShift: Boolean
        get() = prefs.getBoolean("auto_track_shift", false)
        set(v) = prefs.edit().putBoolean("auto_track_shift", v).apply()

    /** Auto-record earnings from post-trip summary screens. */
    var autoLogEarnings: Boolean
        get() = prefs.getBoolean("auto_log_earnings", true)
        set(v) = prefs.edit().putBoolean("auto_log_earnings", v).apply()

    /** Whether the auto-accept countdown also fires on scheduled/reserved work. */
    var autoAcceptReservations: Boolean
        get() = prefs.getBoolean("auto_accept_reservations", true)
        set(v) = prefs.edit().putBoolean("auto_accept_reservations", v).apply()

    // ---- Per-app rule overrides (Mystro's per-service filters) ----

    private fun overrides(): JSONObject =
        JSONObject(prefs.getString("platform_rules", "{}") ?: "{}")

    /** Stored override object for a package, or null to inherit globals. */
    fun platformOverride(pkg: String): JSONObject? =
        overrides().optJSONObject(pkg)

    fun setPlatformOverride(pkg: String, o: JSONObject) {
        prefs.edit().putString("platform_rules",
            overrides().put(pkg, o).toString()).apply()
    }

    fun clearPlatformOverride(pkg: String) {
        // JSONObject.remove() returns the removed value (null if absent) —
        // mutate the object, don't stringify the return.
        val o = overrides()
        o.remove(pkg)
        prefs.edit().putString("platform_rules", o.toString()).apply()
    }

    /** Global rules merged with the package's overrides, if any exist. */
    fun rulesFor(pkg: String): RulePrefs {
        val base = rules()
        val o = platformOverride(pkg) ?: return base
        return base.copy(
            autoAccept = o.optBoolean("autoAccept", base.autoAccept),
            autoDecline = o.optBoolean("autoDecline", base.autoDecline),
            minPerMileCents = if (o.has("minPerMileCents")) o.getInt("minPerMileCents") else base.minPerMileCents,
            minPerHourCents = if (o.has("minPerHourCents")) o.getInt("minPerHourCents") else base.minPerHourCents,
            minPayoutCents = if (o.has("minPayoutCents")) o.getInt("minPayoutCents") else base.minPayoutCents,
            maxDistanceKm = if (o.has("maxDistanceKm")) o.getDouble("maxDistanceKm") else base.maxDistanceKm,
        )
    }

    fun rules() = RulePrefs(
        enabled = enabled,
        autoAccept = autoAccept,
        autoDecline = autoDecline,
        minPerMileCents = minPerMileCents,
        minPerHourCents = minPerHourCents,
        minPayoutCents = minPayoutCents,
        maxDistanceKm = maxDistanceKm,
        overlaySeconds = overlaySeconds,
    )
}
