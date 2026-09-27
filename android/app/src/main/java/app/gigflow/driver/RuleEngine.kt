package app.gigflow.driver

/**
 * Local mirror of GigFlow's web rule engine (src/lib/rules/engine.ts).
 * Same fields, same semantics — the phone evaluates the same way the web
 * "Test rules" panel does.
 */
data class RulePrefs(
    val enabled: Boolean = true,
    val autoAccept: Boolean = false,
    val autoDecline: Boolean = false,
    val minPerMileCents: Int = 150,
    val minPerHourCents: Int = 2000,
    val minPayoutCents: Int = 400,
    val maxDistanceKm: Double = 40.0,
    val overlaySeconds: Int = 0, // 0 = until offer disappears
)

object RuleEngine {

    fun score(offer: DetectedOffer, prefs: RulePrefs): ScoredOffer {
        val perMile = offer.distanceKm
            ?.takeIf { it > 0 }
            ?.let { (offer.payoutCents / (it / 1.609344)).toInt() } // $/mile
        val perHour = offer.durationMin
            ?.takeIf { it > 0 }
            ?.let { (offer.payoutCents * 60.0 / it).toInt() }

        val reasons = mutableListOf<String>()
        var score = 0
        var checks = 0

        if (perMile != null) {
            checks++
            if (perMile >= prefs.minPerMileCents) score++ else reasons.add("below $/mi target")
        }
        if (perHour != null) {
            checks++
            if (perHour >= prefs.minPerHourCents) score++ else reasons.add("below $/hr target")
        }
        checks++
        if (offer.payoutCents >= prefs.minPayoutCents) score++ else reasons.add("below payout floor")
        if (offer.distanceKm != null) {
            checks++
            if (offer.distanceKm <= prefs.maxDistanceKm) score++ else reasons.add("too far")
        }

        val verdict = when {
            checks == 0 -> Verdict.MEH
            score == checks -> Verdict.GOOD
            score >= checks / 2 -> Verdict.MEH
            else -> Verdict.BAD
        }

        return ScoredOffer(offer, perMile, perHour, verdict, reasons)
    }
}
