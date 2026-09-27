package app.gigflow.driver

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
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

    private val handler = Handler(Looper.getMainLooper())
    private var hideRunnable: Runnable? = null
    private var hideToken = ""
    private var tts: TextToSpeech? = null
    private var localDb: LocalDb? = null
    private var pendingAutoAccept: Runnable? = null
    private var countdownTicker: Runnable? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        settings = SettingsRepository(this)
        overlay = OverlayController(this)
        localDb = LocalDb(this)
        tts = TextToSpeech(this) { /* ready */ }
    }

    /** Last-known fix — good enough for tagging where an offer appeared. */
    private fun lastLocation(): Pair<Double, Double>? {
        if (!MileageTracker.hasLocationPermission(this)) return null
        val lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return try {
            (lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER))
                ?.let { it.latitude to it.longitude }
        } catch (_: SecurityException) { null }
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

        val loc = lastLocation()
        loc?.let { localDb?.addPoint(it.first, it.second) }

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
            lat = loc?.first,
            lng = loc?.second,
        ))
        GigFlowApi.pushOffer(settings.syncBaseUrl, settings.syncToken, scored, "shown")

        // Mystro-style voice alert for the verdict, when enabled.
        if (settings.voiceAlerts) {
            val label = when (scored.verdict) {
                Verdict.GOOD -> "Good offer"
                Verdict.MEH -> "Borderline offer"
                Verdict.BAD -> "Skip it"
            }
            tts?.speak(
                "$label, ${"%.2f".format(offer.payoutCents / 100.0)} dollars",
                TextToSpeech.QUEUE_FLUSH, null, "offer",
            )
        }

        val autoAcceptDelay =
            if (prefs.autoAccept && scored.verdict == Verdict.GOOD && offer.acceptNode != null)
                settings.autoAcceptDelaySec else 0

        overlay.show(scored, autoAcceptDelay) { action ->
            cancelAutoAccept()
            when (action) {
                OverlayController.Action.ACCEPT -> offer.acceptNode?.let {
                    GesturePerformer.tap(this, it.bounds)
                    recordAction(scored, "manual_accept")
                }
                OverlayController.Action.DECLINE -> offer.declineNode?.let {
                    GesturePerformer.tap(this, it.bounds)
                    recordAction(scored, "manual_decline")
                }
                OverlayController.Action.CANCEL_AUTO -> Unit
            }
            overlay.hide()
        }

        // Optional overlay timeout — 0 = stay until the card disappears.
        val secs = prefs.overlaySeconds
        if (secs > 0) {
            val token = offer.fingerprint
            hideToken = token
            hideRunnable?.let { handler.removeCallbacks(it) }
            val r = Runnable { if (hideToken == token) overlay.hide() }
            hideRunnable = r
            handler.postDelayed(r, secs * 1000L)
        }

        // Automation: only when the user explicitly enabled it, and only when
        // we actually found the button's bounds. Auto-accept runs on the
        // configured countdown (like Mystro's) so the driver can cancel.
        if (autoAcceptDelay > 0) {
            scheduleAutoAccept(scored, offer.acceptNode!!, autoAcceptDelay)
        } else if (prefs.autoDecline && scored.verdict == Verdict.BAD) {
            offer.declineNode?.let { node ->
                GesturePerformer.tap(this, node.bounds) { ok ->
                    if (ok) recordAction(scored, "auto_decline")
                }
            }
        }
    }

    /** Tick the overlay countdown down, then tap accept at 0. */
    private fun scheduleAutoAccept(scored: ScoredOffer, node: NodeRef, delaySec: Int) {
        var left = delaySec
        val ticker = object : Runnable {
            override fun run() {
                left--
                if (left <= 0) {
                    GesturePerformer.tap(this@GigFlowAccessibilityService, node.bounds) { ok ->
                        if (ok) recordAction(scored, "auto_accept")
                    }
                    overlay.hide()
                } else {
                    overlay.setCountdown(left)
                    handler.postDelayed(this, 1000)
                }
            }
        }
        countdownTicker = ticker
        pendingAutoAccept = Runnable { handler.removeCallbacks(ticker) }
        handler.postDelayed(ticker, 1000)
    }

    private fun cancelAutoAccept() {
        countdownTicker?.let { handler.removeCallbacks(it) }
        countdownTicker = null
        pendingAutoAccept = null
    }

    private fun recordAction(s: ScoredOffer, action: String) {
        val o = s.offer
        OfferLog.add(this, OfferLog.Entry(
            at = o.seenAt, pkg = o.appPackage, payoutCents = o.payoutCents,
            distanceKm = o.distanceKm, durationMin = o.durationMin,
            perMileCents = s.perMileCents, perHourCents = s.perHourCents,
            verdict = s.verdict.name, action = action,
            lat = null, lng = null,
        ))
        GigFlowApi.pushOffer(settings.syncBaseUrl, settings.syncToken, s, action)
    }

    private fun offerGone() {
        hideRunnable?.let { handler.removeCallbacks(it) }
        hideToken = ""
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
        cancelAutoAccept()
        overlay.hide()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}
