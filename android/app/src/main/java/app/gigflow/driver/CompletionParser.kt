package app.gigflow.driver

/**
 * Completed-trip screen extractor — the other half of hands-free logging.
 *
 * After a delivery/trip finishes, driver apps show a summary ("You earned",
 * "Trip fare", "Delivery complete") with a payout figure. When GigFlow sees
 * that screen it records an earning automatically, so the driver never types
 * it in. Fingerprinted to avoid double-logging while the screen stays open.
 *
 * Same caveat as [OfferParser]: heuristic, layout-dependent, and only ever
 * *reads* the screen — the record it creates is editable/deletable.
 */
object CompletionParser {

    private val MONEY = Regex("""\$\s*(\d{1,4}(?:[.,]\d{2})?)""")
    private val TIP_WORD = Regex("""tip|gratuit""", RegexOption.IGNORE_CASE)

    // Phrases that only appear on post-trip / earnings-summary screens.
    private val COMPLETED = Regex(
        """you earned|you made|trip (fare|complete|ended|summary)|delivery complete|""" +
            """order (complete|delivered)|completed delivery|earnings? (today|summary)|""" +
            """total (earnings|payout)|payout""",
        RegexOption.IGNORE_CASE,
    )

    // Words that mark a *pending* screen (offer still deciding) — never treat
    // those as completed work.
    private val PENDING = Regex("""accept|decline|incoming|new (order|delivery|ride)""", RegexOption.IGNORE_CASE)

    data class Completion(
        val payoutCents: Int,
        val tipCents: Int?,
        val fingerprint: String,
    )

    fun parse(pkg: String, nodes: List<OfferParser.FlatNode>): Completion? {
        val texts = nodes.map { it.text }
        if (texts.none { COMPLETED.containsMatchIn(it) }) return null
        if (texts.any { PENDING.containsMatchIn(it) }) return null

        val money = nodes.mapNotNull { n ->
            MONEY.find(n.text)?.let {
                it.groupValues[1].replace(",", ".").toDoubleOrNull() to
                    TIP_WORD.containsMatchIn(n.text)
            }
        }
        val payout = money.filter { (a, tip) -> a != null && !tip && a > 0.5 }
            .maxOfOrNull { it.first!! } ?: return null
        if (payout > 5000) return null // absurd — likely a substring artefact

        val tip = money.filter { (_, tip) -> tip }
            .maxOfOrNull { it.first!! }

        return Completion(
            payoutCents = (payout * 100).toInt(),
            tipCents = tip?.let { (it * 100).toInt() },
            // Minute-bucket fingerprint: the same screen can't re-log within
            // the bucket, a new completion (different amount/time) can.
            fingerprint = "$pkg:${(payout * 100).toInt()}:${System.currentTimeMillis() / 300_000}",
        )
    }
}
