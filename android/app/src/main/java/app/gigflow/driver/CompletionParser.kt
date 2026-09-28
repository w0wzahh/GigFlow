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

    private val TIP_WORD = Regex("""tip|gratuit|borravaló""", RegexOption.IGNORE_CASE)

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
        val currencySymbol: String,
        val fingerprint: String,
    )

    fun parse(pkg: String, nodes: List<OfferParser.FlatNode>): Completion? {
        val texts = nodes.map { it.text }
        if (texts.none { COMPLETED.containsMatchIn(it) }) return null
        if (texts.any { PENDING.containsMatchIn(it) }) return null

        data class M(val amount: Double, val currency: String, val isTip: Boolean)
        val money = nodes.mapNotNull { n ->
            OfferParser.moneyOf(n.text)?.let { (a, c) ->
                M(a, c, TIP_WORD.containsMatchIn(n.text))
            }
        }
        val payout = money.filter { !it.isTip && it.amount > 0.5 }
            .maxOfOrNull { it.amount } ?: return null
        if (payout > 5000) return null // absurd — likely a substring artefact
        val currency = money.firstOrNull { it.amount == payout }?.currency ?: "$"

        val tip = money.filter { it.isTip }
            .maxOfOrNull { it.amount }

        return Completion(
            payoutCents = (payout * 100).toInt(),
            tipCents = tip?.let { (it * 100).toInt() },
            currencySymbol = currency,
            // Minute-bucket fingerprint: the same screen can't re-log within
            // the bucket, a new completion (different amount/time) can.
            fingerprint = "$pkg:${(payout * 100).toInt()}:${System.currentTimeMillis() / 300_000}",
        )
    }
}
