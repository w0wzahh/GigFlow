package app.gigflow.driver

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Rolling on-device log of scored offers — capped at 200 entries. */
object OfferLog {

    private const val KEY = "offer_log"
    private const val MAX = 200

    data class Entry(
        val at: Long,
        val pkg: String,
        val payoutCents: Int,
        val distanceKm: Double?,
        val durationMin: Double?,
        val perMileCents: Int?,
        val perHourCents: Int?,
        val verdict: String,
        val action: String, // "shown" | "auto_accept" | "auto_decline" | "manual_accept" | "manual_decline"
        val lat: Double? = null,
        val lng: Double? = null,
        val reservation: Boolean = false,
        val currency: String = "$",
    )

    fun add(context: Context, e: Entry) {
        val prefs = context.getSharedPreferences("gigflow_log", Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        val o = JSONObject()
            .put("at", e.at)
            .put("pkg", e.pkg)
            .put("payout", e.payoutCents)
            .put("verdict", e.verdict)
            .put("action", e.action)
        e.distanceKm?.let { o.put("km", it) }
        e.durationMin?.let { o.put("min", it) }
        e.perMileCents?.let { o.put("perMile", it) }
        e.perHourCents?.let { o.put("perHour", it) }
        e.lat?.let { o.put("lat", it) }
        e.lng?.let { o.put("lng", it) }
        if (e.reservation) o.put("reservation", true)
        o.put("currency", e.currency)
        val next = JSONArray()
        next.put(o)
        for (i in 0 until minOf(arr.length(), MAX - 1)) next.put(arr.get(i))
        prefs.edit().putString(KEY, next.toString()).apply()
    }

    fun all(context: Context): List<Entry> {
        val prefs = context.getSharedPreferences("gigflow_log", Context.MODE_PRIVATE)
        val arr = JSONArray(prefs.getString(KEY, "[]"))
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Entry(
                at = o.getLong("at"),
                pkg = o.getString("pkg"),
                payoutCents = o.getInt("payout"),
                distanceKm = if (o.has("km")) o.getDouble("km") else null,
                durationMin = if (o.has("min")) o.getDouble("min") else null,
                perMileCents = if (o.has("perMile")) o.getInt("perMile") else null,
                perHourCents = if (o.has("perHour")) o.getInt("perHour") else null,
                verdict = o.getString("verdict"),
                action = o.getString("action"),
                lat = if (o.has("lat")) o.getDouble("lat") else null,
                lng = if (o.has("lng")) o.getDouble("lng") else null,
                reservation = o.optBoolean("reservation"),
                currency = o.optString("currency", "$"),
            )
        }
    }

    fun clear(context: Context) {
        context.getSharedPreferences("gigflow_log", Context.MODE_PRIVATE)
            .edit().remove(KEY).apply()
    }
}
