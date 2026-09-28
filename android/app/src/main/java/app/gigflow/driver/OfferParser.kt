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

    // Money: symbol/code-prefixed ($12.50, €8.90) or code-suffixed (850 Ft,
    // 12,50 EUR). Drivers in Europe get Ft/kr/zł cards — $-only parsing
    // means nothing is ever detected. Deliberately case-sensitive: lowercase
    // "ft" is feet, not forint. (?U) makes \b Unicode-aware so tokens ending
    // in ł/č/₺ still match at end-of-string.
    val MONEY = Regex(
        "(?U)([$€£₺₴]|USD|EUR|GBP)\\s*(\\d(?:[\\d., '\\u00A0]{0,12}\\d)?)|" +
            "(\\d(?:[\\d., '\\u00A0]{0,12}\\d)?)\\s*" +
            "(Ft|HUF|huf|EUR|eur|kr|Kr|KR|SEK|NOK|DKK|PLN|pln|zł|Zł|RON|ron|" +
            "lei|CZK|czk|Kč|TL|TRY|uah|UAH|₺|₴|USD|usd)(?![\\p{L}\\p{N}])",
    )
    private val CURRENCY_WORDS = mapOf(
        "$" to "$", "€" to "€", "£" to "£",
        "ft" to "Ft", "huf" to "Ft", "eur" to "€", "gbp" to "£",
        "kr" to "kr", "sek" to "kr", "nok" to "kr", "dkk" to "kr",
        "pln" to "zł", "zł" to "zł", "ron" to "lei", "lei" to "lei",
        "czk" to "Kč", "kč" to "Kč", "tl" to "₺", "try" to "₺", "₺" to "₺",
        "uah" to "₴", "₴" to "₴", "usd" to "$",
    )

    /**
     * Locale-safe amount parse: "12,50"→12.5, "1.850"→1850 (3+ digits after
     * the last separator = thousands), "2 340"→2340, "1,234.56"→1234.56.
     */
    private fun parseAmount(raw: String): Double? {
        val s = raw.replace(" ", "").replace(" ", "").replace("'", "")
        val lastSep = maxOf(s.lastIndexOf('.'), s.lastIndexOf(','))
        val normalized = if (lastSep >= 0 && s.length - lastSep - 1 in 1..2) {
            s.substring(0, lastSep).filter { it.isDigit() } + "." + s.substring(lastSep + 1)
        } else {
            s.filter { it.isDigit() }
        }
        return normalized.toDoubleOrNull()
    }

    /**
     * Money matcher for the user's *configured* currency, covering symbols
     * the built-in set doesn't know (R$, ₩, "KSh", …). Both the symbol and
     * the ISO code match, prefix or suffix. Cached — building a regex on
     * every 350ms scan would be wasteful.
     */
    private var extraKey = ""
    private var extraRe: Regex? = null

    /** ISO codes that double as everyday words — "TOP 100 drivers" must not
     *  parse as 100 pa'anga. The symbol still matches for these currencies. */
    private val WORDY_CODES = setOf(
        "ALL", "AND", "ARE", "BAM", "BOB", "BUT", "CAN", "FOR", "GEL", "GET",
        "HAS", "HIT", "HOT", "MAD", "MAN", "NEW", "NOW", "OFF", "ONE", "PAY",
        "PEN", "PER", "RON", "SAR", "SEE", "SOS", "TOP", "TRY", "TWO", "USE",
        "VES", "WON", "YER", "CUSTOM",
    )

    fun extraMoney(code: String, symbol: String): Regex? {
        val toks = listOf(symbol, code)
            .map { it.trim() }
            .filter {
                it.isNotEmpty() &&
                    it.lowercase() !in CURRENCY_WORDS &&
                    it.uppercase() !in WORDY_CODES
            }
            .distinct()
        if (toks.isEmpty()) return null
        val key = toks.joinToString("|")
        if (key == extraKey) return extraRe
        val alt = toks.joinToString("|") { Regex.escape(it) }
        val num = "(\\d(?:[\\d., '\\u00A0]{0,12}\\d)?)"
        // Lookahead, not \b — \b can't anchor after non-word symbols (₺, ₩, R$)
        // so "100 ₺" would silently fail at end-of-string.
        extraRe = Regex("(?U)(?:$alt)\\s*$num|$num\\s*(?:$alt)(?![\\p{L}\\p{N}])")
        extraKey = key
        return extraRe
    }

    /** Extract amount + display symbol from a text, or null. [extra] is the
     *  configured-currency matcher from [extraMoney]; its hits report
     *  [extraSymbol] as the currency. */
    fun moneyOf(text: String, extra: Regex? = null, extraSymbol: String = "$"): Pair<Double, String>? {
        MONEY.find(text)?.let { m ->
            val amount = parseAmount(m.groupValues[2].ifEmpty { m.groupValues[3] })
                ?: return@let
            val token = m.groupValues[1].ifEmpty { m.groupValues[4] }
            return amount to (CURRENCY_WORDS[token.lowercase()] ?: "$")
        }
        val m = extra?.find(text) ?: return null
        val amount = parseAmount(m.groupValues[1].ifEmpty { m.groupValues[2] })
            ?: return null
        return amount to extraSymbol
    }
    private val MILES = Regex("""(\d{1,3}(?:\.\d+)?)\s*(mi|miles?|mile)\b""", RegexOption.IGNORE_CASE)
    private val KM = Regex("""(\d{1,3}(?:\.\d+)?)\s*km\b""", RegexOption.IGNORE_CASE)
    private val MINUTES = Regex("""(\d{1,3})\s*min""", RegexOption.IGNORE_CASE)
    private val HOURS_MIN = Regex("""(\d+)\s*hr?\s*(\d+)?\s*min""", RegexOption.IGNORE_CASE)
    private val TIP_WORD = Regex("""tip|gratuit""", RegexOption.IGNORE_CASE)

    private val ACCEPT_WORDS = Regex("""accept|confirm|match me|claim|grab it|start delivery""", RegexOption.IGNORE_CASE)
    private val DECLINE_WORDS = Regex("""decline|pass|reject|no thanks|skip""", RegexOption.IGNORE_CASE)
    private val TIMER_HINTS = Regex("""^\d{1,2}$|seconds""") // countdown numbers — ignore for duration
    // Offer expiry countdown: "0:12", "12s", "12 sec", "expires in 12".
    private val EXPIRY = Regex(
        """^(\d{1,2}):(\d{2})$|^(\d{1,2})\s*(s|sec|seconds?)\b|expires? in (\d{1,2})""",
        RegexOption.IGNORE_CASE,
    )
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

    fun parse(
        pkg: String,
        nodes: List<FlatNode>,
        extra: Regex? = null,
        extraSymbol: String = "$",
    ): DetectedOffer? {
        val texts = nodes.map { it.text }

        // Collect money figures with their context. The card total is usually
        // the largest standalone amount; "incl. tip" lines become tips.
        data class Money(val node: FlatNode, val amount: Double, val currency: String, val raw: String)
        val moneyNodes = nodes.mapNotNull { n ->
            moneyOf(n.text, extra, extraSymbol)?.let { (amount, cur) -> Money(n, amount, cur, n.text) }
        }
        if (moneyNodes.isEmpty()) return null

        val payout = moneyNodes
            .filter { it.amount > 0.5 && !TIP_WORD.containsMatchIn(it.raw) }
            .maxOfOrNull { it.amount } ?: return null
        val currency = moneyNodes.firstOrNull { it.amount == payout }?.currency ?: "$"

        val tip = moneyNodes
            .filter { TIP_WORD.containsMatchIn(it.raw) }
            .maxOfOrNull { it.amount }

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

        // Expiry countdown — "0:15" / "12s" style, Mystro shows it ticking.
        val expiresInSec = texts.mapNotNull { t ->
            EXPIRY.find(t.trim())?.let { m ->
                val mm = m.groupValues[1].toIntOrNull()
                if (mm != null) mm * 60 + (m.groupValues[2].toIntOrNull() ?: 0)
                else (m.groupValues[3].ifEmpty { m.groupValues[5] }).toIntOrNull()
            }
        }.filter { it in 1..120 }.minOrNull()

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
            currencySymbol = currency,
            expiresInSec = expiresInSec,
            isReservation = texts.any { RESERVATION.containsMatchIn(it) },
        )
    }
}
