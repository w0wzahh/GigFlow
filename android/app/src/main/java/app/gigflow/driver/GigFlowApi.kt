package app.gigflow.driver

import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Talks to the GigFlow web app. Auth: `Authorization: Bearer <token>` —
 * generated in the web app's Settings → Security → Android companion app.
 *
 * All calls are best-effort and run on a background thread; failures are
 * silent because the local DB / offer log is the source of truth.
 */
object GigFlowApi {

    fun configured(baseUrl: String, token: String) = baseUrl.isNotBlank() && token.isNotBlank()

    fun pushOffer(baseUrl: String, token: String, s: ScoredOffer, action: String) {
        if (!configured(baseUrl, token)) return
        val o = s.offer
        post(baseUrl, token, "/api/mobile/offers", JSONObject()
            .put("platformKey", platformKeyFor(o.appPackage))
            .put("payoutCents", o.payoutCents)
            .put("tipCents", o.tipCents)
            .put("estDistanceKm", o.distanceKm)
            .put("estDurationMin", o.durationMin)
            .put("perMileCents", s.perMileCents)
            .put("perHourCents", s.perHourCents)
            .put("verdict", s.verdict.name)
            .put("action", action)
            .put("seenAt", o.seenAt),
        ) { /* fire and forget */ }
    }

    /** Push one locally-logged record (earning | expense | mileage). */
    fun pushRecord(baseUrl: String, token: String, payload: JSONObject, onDone: (Boolean) -> Unit = {}) {
        if (!configured(baseUrl, token)) { onDone(false); return }
        post(baseUrl, token, "/api/mobile/records", payload) { ok -> onDone(ok) }
    }

    /** Update a previously-pushed record, keyed by clientId. */
    fun updateRecord(baseUrl: String, token: String, type: String, clientId: String, fields: JSONObject, onDone: (Boolean) -> Unit = {}) {
        if (!configured(baseUrl, token)) { onDone(false); return }
        val body = JSONObject(fields.toString())
            .put("type", type)
            .put("clientId", clientId)
        request("PATCH", baseUrl, token, "/api/mobile/records", body) { ok -> onDone(ok) }
    }

    /** Delete a pushed record by clientId. */
    fun deleteRecord(baseUrl: String, token: String, type: String, clientId: String, onDone: (Boolean) -> Unit = {}) {
        if (!configured(baseUrl, token)) { onDone(false); return }
        request("DELETE", baseUrl, token, "/api/mobile/records", JSONObject()
            .put("type", type).put("clientId", clientId)) { ok -> onDone(ok) }
    }

    /** Flush all unsynced rows as one batch. */
    fun pushBatch(baseUrl: String, token: String, rows: List<LocalDb.Row>, onDone: (Boolean) -> Unit = {}) {
        if (!configured(baseUrl, token) || rows.isEmpty()) { onDone(false); return }
        val arr = JSONArray()
        rows.forEach { arr.put(it.payload) }
        request("PUT", baseUrl, token, "/api/mobile/records", arr) { ok -> onDone(ok) }
    }

    /** Pulls dashboard aggregates for the phone UI. Returns null on failure. */
    fun fetchSummary(baseUrl: String, token: String, onDone: (JSONObject?) -> Unit) {
        if (!configured(baseUrl, token)) { onDone(null); return }
        Thread {
            try {
                val conn = (URL("$baseUrl/api/mobile/summary").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    setRequestProperty("Authorization", "Bearer $token")
                    connectTimeout = 8_000
                    readTimeout = 8_000
                }
                val body = conn.inputStream.bufferedReader().readText()
                conn.disconnect()
                val data = JSONObject(body).optJSONObject("data")
                post { onDone(data) }
            } catch (_: Exception) {
                post { onDone(null) }
            }
        }.start()
    }

    private fun post(baseUrl: String, token: String, path: String, body: JSONObject, done: (Boolean) -> Unit) {
        request("POST", baseUrl, token, path, body, done)
    }

    private fun request(method: String, baseUrl: String, token: String, path: String, body: Any, done: (Boolean) -> Unit) {
        Thread {
            try {
                val conn = (URL("$baseUrl$path").openConnection() as HttpURLConnection).apply {
                    requestMethod = method
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 8_000
                    readTimeout = 8_000
                    doOutput = true
                }
                OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
                val ok = conn.responseCode in 200..299
                conn.disconnect()
                done(ok)
            } catch (_: Exception) {
                done(false)
            }
        }.start()
    }

    private fun post(block: () -> Unit) {
        android.os.Handler(android.os.Looper.getMainLooper()).post(block)
    }

    private fun platformKeyFor(pkg: String): String = when {
        "uber" in pkg -> "uber"
        "lyft" in pkg -> "lyft"
        "doordash" in pkg -> "doordash"
        "instacart" in pkg -> "instacart"
        "amazon" in pkg || "rabbit" in pkg -> "amazon-flex"
        "spark" in pkg || "walmart" in pkg -> "spark"
        else -> "other"
    }
}
