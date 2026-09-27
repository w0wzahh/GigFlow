package app.gigflow.driver.ui

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Point
import android.graphics.RadialGradient
import android.graphics.Shader
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.Projection
import org.osmdroid.views.overlay.Overlay
import app.gigflow.driver.LocalDb

/**
 * Heatmap overlay — draws the driver's own recorded activity (shift GPS
 * breadcrumbs + geotagged offers) as weighted radial glows. Hotter = more
 * observations in that ~100m cell. All data comes from this device; there is
 * no external "demand" feed behind it.
 */
class HeatOverlay(
    private val points: List<LocalDb.Point>,
    private val accent: Int,
) : Overlay() {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val scratch = Point()

    override fun draw(canvas: Canvas, map: MapView, shadow: Boolean) {
        if (shadow || points.isEmpty()) return
        val proj: Projection = map.projection
        val maxW = points.maxOf { it.weight }.coerceAtLeast(1)
        // Glow radius scales with zoom so blobs stay neighborhood-sized.
        val meters = map.boundingBox?.let { it.diagonalLengthInMeters / 40.0 } ?: 120.0
        val radiusPx = proj.metersToPixels(meters.toFloat()).coerceIn(18f, 220f)

        for (pt in points) {
            proj.toPixels(GeoPoint(pt.lat, pt.lng), scratch)
            val w = (pt.weight.toFloat() / maxW).coerceIn(0.15f, 1f)
            paint.shader = RadialGradient(
                scratch.x.toFloat(), scratch.y.toFloat(), radiusPx,
                withAlpha(accent, (200 * w).toInt()),
                Color.TRANSPARENT,
                Shader.TileMode.CLAMP,
            )
            canvas.drawCircle(scratch.x.toFloat(), scratch.y.toFloat(), radiusPx, paint)
        }
    }

    private fun withAlpha(color: Int, a: Int): Int =
        Color.argb(a.coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))
}
