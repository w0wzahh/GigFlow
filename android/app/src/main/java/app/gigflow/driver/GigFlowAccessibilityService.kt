package app.gigflow.driver

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject

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

    // Auto-shift tracking state
    private var lastDriverAppAt = 0L
    private var idleStopCheck: Runnable? = null
    private val loggedCompletions = mutableSetOf<String>()

    companion object {
        /** Auto-stop shift tracking after this long with no driver-app events. */
        private const val IDLE_STOP_MS = 30 * 60_000L

        /** Live instance while the service is enabled — null otherwise. */
        @Volatile var instance: GigFlowAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        settings = SettingsRepository(this)
        overlay = OverlayController(this)
        localDb = LocalDb(this)
        tts = TextToSpeech(this) { /* ready */ }
        instance = this
    }

    /**
     * Synthetic test offer — exercises score → overlay → voice without
     * logging or automation taps, so drivers can verify the pipeline before
     * going online. Called from Assist → "Send a test offer".
     */
    fun testOffer() {
        handler.post {
            val o = DetectedOffer(
                appPackage = "app.gigflow.test",
                payoutCents = (12.50 * 100).toInt(),
                tipCents = 200,
                distanceKm = 4.2,
                durationMin = 18.0,
                extraDistanceKm = null,
                acceptNode = null,
                declineNode = null,
                rawTexts = listOf("Test offer"),
                currencySymbol = settings.currencySymbol,
                expiresInSec = 12,
            )
            val scored = RuleEngine.score(o, settings.rules())
            overlay.show(scored) { overlay.hide() }
            if (settings.voiceAlerts) {
                tts?.speak(
                    "Test offer, ${"%.2f".format(o.payoutCents / 100.0)} ${currencyName(o.currencySymbol)}",
                    TextToSpeech.QUEUE_FLUSH, null, "test",
                )
            }
        }
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
        val pkg = event.packageName?.toString() ?: return
        val now = System.currentTimeMillis()

        // Events only arrive from watched driver apps (manifest filters), so
        // any event means the driver is inside a work app — feed the
        // auto-shift tracker before anything else.
        onDriverAppSeen(now)

        val prefs = settings.rulesFor(pkg) // per-app overrides over globals
        if (!prefs.enabled) return
        if (now - lastScanAt < 350) return // throttle contentChanged storms
        lastScanAt = now

        val root = rootInActiveWindow ?: run { offerGone(); return }
        if (root.packageName?.toString() != pkg) { offerGone(); return }

        val nodes = OfferParser.flatten(root)
        val offer = OfferParser.parse(pkg, nodes)
        if (offer == null) {
            // A screen with a money figure but no parse is a "miss" — the
            // card was probably there but the layout beat the heuristic.
            // Record it so Diagnostics can show what we saw.
            val hasMoney = nodes.any { OfferParser.MONEY.containsMatchIn(it.text) }
            Diagnostics.record(this, pkg, if (hasMoney) "miss" else "idle",
                nodes.map { it.text })
            maybeLogCompletion(pkg, nodes, now)
            offerGone()
            return
        }
        Diagnostics.record(this, pkg, "offer", offer.rawTexts)

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
            reservation = offer.isReservation,
            currency = offer.currencySymbol,
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
                "$label, ${"%.2f".format(offer.payoutCents / 100.0)} ${currencyName(offer.currencySymbol)}",
                TextToSpeech.QUEUE_FLUSH, null, "offer",
            )
        }

        val autoAcceptDelay =
            if (prefs.autoAccept && scored.verdict == Verdict.GOOD && offer.acceptNode != null &&
                (settings.autoAcceptReservations || !offer.isReservation))
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

    /**
     * Auto shift tracking (opt-in): opening any watched driver app starts GPS
     * mileage; 30 minutes without a watched app stops it. The overlay
     * permission we already hold exempts us from background-FGS limits, but
     * guard anyway — worst case is the user taps "Start shift" themselves.
     */
    private fun onDriverAppSeen(now: Long) {
        lastDriverAppAt = now
        if (!settings.autoTrackShift) return
        if (!MileageTracker.hasLocationPermission(this)) return
        if (!MileageTracker.running) {
            try {
                startForegroundService(MileageTracker.startIntent(this))
            } catch (_: Exception) { /* background-start blocked — manual start still works */ }
        }
        // Arm the idle-stop check; every driver-app event pushes it out.
        idleStopCheck?.let { handler.removeCallbacks(it) }
        val check = Runnable {
            if (System.currentTimeMillis() - lastDriverAppAt >= IDLE_STOP_MS &&
                MileageTracker.running
            ) {
                stopService(MileageTracker.stopIntent(this))
            }
        }
        idleStopCheck = check
        handler.postDelayed(check, IDLE_STOP_MS)
    }

    /**
     * Post-trip earnings capture — reads the completed-delivery / earnings
     * summary screen and records the payout as a local earning (syncs later).
     */
    private fun maybeLogCompletion(pkg: String, nodes: List<OfferParser.FlatNode>, now: Long) {
        if (!settings.autoLogEarnings) return
        val comp = CompletionParser.parse(pkg, nodes) ?: return
        if (!loggedCompletions.add(comp.fingerprint)) return // already logged this screen
        if (loggedCompletions.size > 200) loggedCompletions.clear()

        val payload = JSONObject()
            .put("amountCents", comp.payoutCents)
            .put("category", "TRIP")
            .put("platformKey", GigFlowApi.platformKeyFor(pkg))
            .put("notes", "Auto-captured")
            .put("earnedAt", now)
        comp.tipCents?.let { payload.put("tipCents", it) }

        val db = localDb ?: return
        val row = db.insert("earning", payload)
        GigFlowApi.pushRecord(settings.syncBaseUrl, settings.syncToken, row.payload) { ok ->
            if (ok) db.markSynced(row.clientId)
        }
        if (settings.voiceAlerts) {
            tts?.speak(
                "Logged ${"%.2f".format(comp.payoutCents / 100.0)} ${currencyName(comp.currencySymbol)}",
                TextToSpeech.QUEUE_ADD, null, "earn",
            )
        }
    }

    /** Spoken currency name for TTS — "Ft" reads as "forints", etc. */
    private fun currencyName(symbol: String): String = when (symbol) {
        "$" -> "dollars"
        "€" -> "euros"
        "£" -> "pounds"
        "Ft" -> "forints"
        "kr" -> "kroner"
        "zł" -> "zloty"
        "lei" -> "lei"
        "Kč" -> "koruna"
        "₺" -> "lira"
        "₴" -> "hryvnia"
        else -> symbol
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
            reservation = o.isReservation,
            currency = o.currencySymbol,
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
        instance = null
        cancelAutoAccept()
        overlay.hide()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}
