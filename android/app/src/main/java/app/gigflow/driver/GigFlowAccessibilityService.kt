package app.gigflow.driver

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Watches the configured driver apps' windows, extracts offer cards, scores
 * them against the user's rules, shows the floating verdict, and optionally
 * taps accept/decline when automation toggles are on.
 *
 * Everything runs on-device. No screen content leaves the phone — only the
 * distilled offer fields (payout, distance, duration, verdict) are pushed to
 * GigFlow if sync is configured.
 */
class GigFlowAccessibilityService : AccessibilityService() {

    private lateinit var settings: SettingsRepository
    private lateinit var overlay: OverlayController

    private var lastFingerprint = ""
    private var lastSeenAt = 0L
    private var lastScanAt = 0L
    private var activeOffer: ScoredOffer? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        settings = SettingsRepository(this)
        overlay = OverlayController(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val prefs = settings.rules()
        if (!prefs.enabled) return

        val pkg = event.packageName?.toString() ?: return
        val now = System.currentTimeMillis()
        if (now - lastScanAt < 350) return // throttle contentChanged storms
        lastScanAt = now

        val root = rootInActiveWindow ?: run { offerGone(); return }
        if (root.packageName?.toString() != pkg) { offerGone(); return }

        val nodes = OfferParser.flatten(root)
        val offer = OfferParser.parse(pkg, nodes)
        if (offer == null) { offerGone(); return }

        // Same card still on screen — don't rescore/re-overlay every frame.
        if (offer.fingerprint == lastFingerprint && now - lastSeenAt < 60_000) {
            lastSeenAt = now
            return
        }
        lastFingerprint = offer.fingerprint
        lastSeenAt = now

        val scored = RuleEngine.score(offer, prefs)
        activeOffer = scored

        OfferLog.add(this, OfferLog.Entry(
            at = offer.seenAt,
            pkg = pkg,
            payoutCents = offer.payoutCents,
            distanceKm = offer.distanceKm,
            durationMin = offer.durationMin,
            perMileCents = scored.perMileCents,
            perHourCents = scored.perHourCents,
            verdict = scored.verdict.name,
            action = "shown",
        ))
        GigFlowApi.pushOffer(settings.syncBaseUrl, settings.syncToken, scored, "shown")

        overlay.show(scored) { action ->
            when (action) {
                OverlayController.Action.ACCEPT -> offer.acceptNode?.let {
                    GesturePerformer.tap(this, it.bounds)
                    recordAction(scored, "manual_accept")
                }
                OverlayController.Action.DECLINE -> offer.declineNode?.let {
                    GesturePerformer.tap(this, it.bounds)
                    recordAction(scored, "manual_decline")
                }
            }
            overlay.hide()
        }

        // Automation: only when the user explicitly enabled it, and only when
        // we actually found the button's bounds.
        if (prefs.autoAccept && scored.verdict == Verdict.GOOD) {
            offer.acceptNode?.let { node ->
                GesturePerformer.tap(this, node.bounds) { ok ->
                    if (ok) recordAction(scored, "auto_accept")
                }
            }
        } else if (prefs.autoDecline && scored.verdict == Verdict.BAD) {
            offer.declineNode?.let { node ->
                GesturePerformer.tap(this, node.bounds) { ok ->
                    if (ok) recordAction(scored, "auto_decline")
                }
            }
        }
    }

    private fun recordAction(s: ScoredOffer, action: String) {
        val o = s.offer
        OfferLog.add(this, OfferLog.Entry(
            at = o.seenAt, pkg = o.appPackage, payoutCents = o.payoutCents,
            distanceKm = o.distanceKm, durationMin = o.durationMin,
            perMileCents = s.perMileCents, perHourCents = s.perHourCents,
            verdict = s.verdict.name, action = action,
        ))
        GigFlowApi.pushOffer(settings.syncBaseUrl, settings.syncToken, s, action)
    }

    private fun offerGone() {
        if (activeOffer != null) {
            activeOffer = null
            lastFingerprint = ""
            overlay.hide()
        }
    }

    override fun onInterrupt() {
        overlay.hide()
    }

    override fun onDestroy() {
        overlay.hide()
        super.onDestroy()
    }
}
