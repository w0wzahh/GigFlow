package app.gigflow.driver

import android.graphics.Rect
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Heuristic offer-card extractor.
 *
 * Driver apps change their layouts constantly and don't publish view-tree
 * contracts, so this intentionally works off *textual patterns* rather than
 * view IDs: find currency figures, distance and duration text, and the
 * accept/decline affordances. Tuned per-app where a reliable anchor exists.
 */
object OfferParser {

    val MONEY = Regex("""\$\s*(\d{1,4}(?:[.,]\d{2})?)""")
    private val MILES = Regex("""(\d{1,3}(?:\.\d+)?)\s*(mi|miles?|mile)\b""", RegexOption.IGNORE_CASE)
    private val KM = Regex("""(\d{1,3}(?:\.\d+)?)\s*km\b""", RegexOption.IGNORE_CASE)
    private val MINUTES = Regex("""(\d{1,3})\s*min""", RegexOption.IGNORE_CASE)
    private val HOURS_MIN = Regex("""(\d+)\s*hr?\s*(\d+)?\s*min""", RegexOption.IGNORE_CASE)
    private val TIP_WORD = Regex("""tip|gratuit""", RegexOption.IGNORE_CASE)

    private val ACCEPT_WORDS = Regex("""accept|confirm|match me|claim|grab it|start delivery""", RegexOption.IGNORE_CASE)
    private val DECLINE_WORDS = Regex("""decline|pass|reject|no thanks|skip""", RegexOption.IGNORE_CASE)
    private val TIMER_HINTS = Regex("""^\d{1,2}$|seconds""") // countdown numbers — ignore for duration
    private val RESERVATION = Regex("""reserv|scheduled""", RegexOption.IGNORE_CASE)

    data class FlatNode(
        val text: String,
        val viewId: String?,
        val bounds: Rect,
        val clickable: Boolean,
    )

    fun flatten(root: AccessibilityNodeInfo): List<FlatNode> {
        val out = ArrayList<FlatNode>(64)
        val stack = ArrayDeque<AccessibilityNodeInfo>()
        stack.add(root)
        while (stack.isNotEmpty()) {
            val n = stack.removeFirst()
            val t = n.text?.toString()?.trim().orEmpty()
            val cd = n.contentDescription?.toString()?.trim().orEmpty()
            val label = if (t.isNotEmpty()) t else cd
            if (label.isNotEmpty()) {
                val r = Rect()
                n.getBoundsInScreen(r)
                out.add(FlatNode(label, n.viewIdResourceName, r, n.isClickable))
            }
            for (i in 0 until n.childCount) {
                n.getChild(i)?.let(stack::add)
            }
        }
        return out
    }

    fun parse(pkg: String, nodes: List<FlatNode>): DetectedOffer? {
        val texts = nodes.map { it.text }

        // Collect money figures with their context. The card total is usually
        // the largest standalone $ amount; "incl. tip" lines become tips.
        val moneyNodes = nodes.mapNotNull { n ->
            MONEY.find(n.text)?.let { Triple(n, it.groupValues[1].replace(",", ".").toDoubleOrNull(), n.text) }
        }
        if (moneyNodes.isEmpty()) return null

        val payout = moneyNodes
            .filter { (_, amount, raw) ->
                amount != null && amount > 0.5 && !TIP_WORD.containsMatchIn(raw)
            }
            .maxOfOrNull { it.second!! } ?: return null

        val tip = moneyNodes
            .filter { (_, amount, raw) -> amount != null && TIP_WORD.containsMatchIn(raw) }
            .maxOfOrNull { it.second!! }

        // Distances: take the largest plausible one (total trip distance).
        val distanceKm = texts.mapNotNull { t ->
            MILES.find(t)?.groupValues?.get(1)?.toDoubleOrNull()?.times(1.609344)
                ?: KM.find(t)?.groupValues?.get(1)?.toDoubleOrNull()
        }.filter { it in 0.2..500.0 }.maxOrNull()

        // Duration: ignore countdown timers (tiny ints, "seconds").
        val durationMin = texts.mapNotNull { t ->
            if (TIMER_HINTS.containsMatchIn(t)) return@mapNotNull null
            HOURS_MIN.find(t)?.let { m ->
                val h = m.groupValues[1].toDouble()
                val mnt = m.groupValues.getOrNull(2)?.toDoubleOrNull() ?: 0.0
                h * 60 + mnt
            } ?: MINUTES.find(t)?.groupValues?.get(1)?.toDoubleOrNull()
        }.filter { it in 1.0..600.0 }.maxOrNull()

        // Need at least payout + one of distance/duration to call it an offer.
        if (distanceKm == null && durationMin == null) return null

        fun nodeMatching(re: Regex, clickableOnly: Boolean): NodeRef? =
            nodes.firstOrNull { n ->
                re.containsMatchIn(n.text) && (!clickableOnly || n.clickable) && n.bounds.width() > 0
            }?.let { NodeRef(it.bounds, it.text) }

        val accept = nodeMatching(ACCEPT_WORDS, clickableOnly = true)
            ?: nodeMatching(ACCEPT_WORDS, clickableOnly = false)
        val decline = nodeMatching(DECLINE_WORDS, clickableOnly = true)
            ?: nodeMatching(DECLINE_WORDS, clickableOnly = false)

        return DetectedOffer(
            appPackage = pkg,
            payoutCents = (payout * 100).toInt(),
            tipCents = tip?.let { (it * 100).toInt() },
            distanceKm = distanceKm?.let { Math.round(it * 10) / 10.0 },
            durationMin = durationMin,
            extraDistanceKm = null,
            acceptNode = accept,
            declineNode = decline,
            rawTexts = texts,
            isReservation = texts.any { RESERVATION.containsMatchIn(it) },
        )
    }
}
