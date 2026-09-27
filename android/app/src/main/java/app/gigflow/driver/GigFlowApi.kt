package app.gigflow.driver

import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Optional push of scored/accepted offers to the GigFlow web app.
 * Auth: `Authorization: Bearer <token>` where the token is generated in the
 * web app's Settings → Security → Companion app.
 */
object GigFlowApi {

    fun pushOffer(baseUrl: String, token: String, s: ScoredOffer, action: String) {
        if (baseUrl.isBlank() || token.isBlank()) return
        Thread {
            try {
                val o = s.offer
                val body = JSONObject()
                    .put("platformKey", platformKeyFor(o.appPackage))
                    .put("payoutCents", o.payoutCents)
                    .put("tipCents", o.tipCents)
                    .put("estDistanceKm", o.distanceKm)
                    .put("estDurationMin", o.durationMin)
                    .put("perMileCents", s.perMileCents)
                    .put("perHourCents", s.perHourCents)
                    .put("verdict", s.verdict.name)
                    .put("action", action)
                    .put("seenAt", o.seenAt)

                val conn = (URL("$baseUrl/api/mobile/offers").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Authorization", "Bearer $token")
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 8_000
                    readTimeout = 8_000
                    doOutput = true
                }
                OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }
                conn.responseCode // drain
                conn.disconnect()
            } catch (_: Exception) {
                // Offline or misconfigured — local log still has the record.
            }
        }.start()
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
