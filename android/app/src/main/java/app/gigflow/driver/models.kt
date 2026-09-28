package app.gigflow.driver

import android.graphics.Rect

/** A node from the target app's view tree we may want to tap. */
data class NodeRef(
    val bounds: Rect,
    val label: String,
)

/** An offer extracted from a driver app's screen. */
data class DetectedOffer(
    val appPackage: String,
    val payoutCents: Int,
    val tipCents: Int?,
    val distanceKm: Double?,
    val durationMin: Double?,
    val extraDistanceKm: Double?, // e.g. "delivery distance" vs "trip distance"
    val seenAt: Long = System.currentTimeMillis(),
    val acceptNode: NodeRef?,
    val declineNode: NodeRef?,
    val rawTexts: List<String>,
    /** True for scheduled/reservation work (e.g. "Reserved", "Scheduled")
     * rather than a live on-demand ping. */
    val isReservation: Boolean = false,
    /** Display symbol detected on the card — "$", "Ft", "€", … */
    val currencySymbol: String = "$",
    /** Seconds the offer gives the driver to decide, if shown on-card. */
    val expiresInSec: Int? = null,
) {
    /** Stable-ish key for dedupe within a short window. */
    val fingerprint: String
        get() = "$appPackage|$payoutCents|${distanceKm}|${durationMin}|${rawTexts.take(6).joinToString("|")}"
}

enum class Verdict { GOOD, MEH, BAD }

data class ScoredOffer(
    val offer: DetectedOffer,
    val perMileCents: Int?,
    val perHourCents: Int?,
    val verdict: Verdict,
    val reasons: List<String>,
)
