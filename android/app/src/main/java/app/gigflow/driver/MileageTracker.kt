package app.gigflow.driver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.IBinder
import org.json.JSONObject

/**
 * Shift mileage tracker — Gridwise-style on/off tracking. Started from the
 * Track tab, runs as a location-type foreground service so it keeps working
 * while the driver is in a driver app. GPS fixes accumulate distance locally.
 *
 * Everything stays on-device — nothing leaves the phone.
 */
class MileageTracker : Service(), LocationListener {

    companion object {
        const val ACTION_START = "app.gigflow.driver.action.START_TRACKING"
        const val ACTION_STOP = "app.gigflow.driver.action.STOP_TRACKING"
        private const val CHANNEL = "mileage_tracking"
        private const val NOTIF_ID = 42

        /** Live-ish state readable by the UI. */
        @Volatile var running = false
            private set
        @Volatile var kmSoFar = 0.0
            private set
        @Volatile var startedAt = 0L
            private set

        fun startIntent(ctx: Context) =
            Intent(ctx, MileageTracker::class.java).setAction(ACTION_START)
        fun stopIntent(ctx: Context) =
            Intent(ctx, MileageTracker::class.java).setAction(ACTION_STOP)

        fun hasLocationPermission(ctx: Context): Boolean =
            ctx.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
            ctx.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
    }

    private var lm: LocationManager? = null
    private var last: Location? = null
    private var db: LocalDb? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
            else -> if (running) stopTracking() else stopSelf()
        }
        return START_STICKY
    }

    private fun startTracking() {
        if (running) return
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            mgr.createNotificationChannel(NotificationChannel(
                CHANNEL, "Mileage tracking", NotificationManager.IMPORTANCE_LOW))
        }
        startForeground(NOTIF_ID, buildNotification("Shift active — tap to open"))

        running = true
        kmSoFar = 0.0
        startedAt = System.currentTimeMillis()
        db = LocalDb(this)

        lm = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            lm?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 2_000L, 5f, this,
            )
            // Network provider fills gaps where GPS drops (tunnels, urban canyons).
            lm?.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, 8_000L, 25f, this,
            )
        } catch (_: SecurityException) {
            stopTracking()
        }
    }

    override fun onLocationChanged(location: Location) {
        if (!running) return
        // Discard noisy fixes — a "moved" reading with bad accuracy or too
        // small a displacement would inflate the odometer.
        if (location.accuracy > 30f) return
        val prev = last
        if (prev != null) {
            val d = prev.distanceTo(location)
            if (d < 5f || d > 500f) return // stationary jitter or a teleport
            kmSoFar += d / 1000.0
            updateNotification()
        }
        last = location
    }

    /** Same notification shape every time — a rebuilt notification must
     *  re-attach the tap-to-open intent and Stop action or they vanish
     *  after the first odometer update. */
    private fun buildNotification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, stopIntent(this), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL)
            .setContentTitle("GigFlow is tracking mileage")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "Stop shift", stop).build())
            .setOngoing(true)
            .build()
    }

    private fun updateNotification() {
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        mgr.notify(NOTIF_ID, buildNotification("%.1f km so far".format(kmSoFar)))
    }

    private fun stopTracking() {
        if (!running) { stopSelf(); return }
        running = false
        try { lm?.removeUpdates(this) } catch (_: SecurityException) {}
        lm = null
        val km = kmSoFar
        val started = startedAt
        kmSoFar = 0.0
        startedAt = 0L
        if (km >= 0.05 && db != null) {
            db!!.insert("mileage", JSONObject()
                .put("distanceKm", km)
                .put("purpose", "WORK")
                .put("description", "Auto-tracked shift")
                .put("date", started))
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (running) stopTracking()
        super.onDestroy()
    }
}
