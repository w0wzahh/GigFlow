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

    private val TIP_WORD = Regex(
        """tip|gratuit|borraval|trinkgeld|napiw|pourboire|propina|mancia|dricks|drikkepenge|juomarah|spropitn|bahş|чаєв""",
        RegexOption.IGNORE_CASE,
    )

    // Phrases that only appear on post-trip / earnings-summary screens —
    // English first, then the locales Wolt/foodora ship in.
    private val COMPLETED = Regex(
        """you earned|you made|trip (fare|complete|ended|summary)|delivery complete|""" +
            """order (complete|delivered)|completed delivery|earnings? (today|summary)|""" +
            """total (earnings|payout)|payout|""" +
            """kiszállítva|teljesítve|keresett|jövedelem|verdient|abgeschlossen|""" +
            """zarobiłeś|zakończon|ukończon|vous avez gagné|livraison terminée|""" +
            """has ganado|entrega completada|leverans slutförd|du tjänade|""" +
            """levering fullført|du tjente|fuldført|toimitus valmis|ansaitsit|""" +
            """dokončen|vyděl|livrare finalizată|ai câștigat|teslimat tamamlandı|kazandın|""" +
            """завершено|заробили|consegna completata|hai guadagnato""",
        RegexOption.IGNORE_CASE,
    )

    // Words that mark a *pending* screen (offer still deciding) — never treat
    // those as completed work. Localized stems mirror OfferParser's set.
    private val PENDING = Regex(
        """accept|decline|incoming|new (order|delivery|ride)|elfogad|elutasít|akzept|akcept|""" +
            """prija|přijm|przyjm|hyväks|avvis|godta|annehm|ablehn|refus|reddet""",
        RegexOption.IGNORE_CASE,
    )

    data class Completion(
        val payoutCents: Int,
        val tipCents: Int?,
        val currencySymbol: String,
        val fingerprint: String,
    )

    fun parse(
        pkg: String,
        nodes: List<OfferParser.FlatNode>,
        extra: Regex? = null,
        extraSymbol: String = "$",
    ): Completion? {
        val texts = nodes.map { it.text }
        if (texts.none { COMPLETED.containsMatchIn(it) }) return null
        if (texts.any { PENDING.containsMatchIn(it) }) return null

        data class M(val amount: Double, val currency: String, val isTip: Boolean)
        val money = nodes.mapNotNull { n ->
            OfferParser.moneyOf(n.text, extra, extraSymbol)?.let { (a, c) ->
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
