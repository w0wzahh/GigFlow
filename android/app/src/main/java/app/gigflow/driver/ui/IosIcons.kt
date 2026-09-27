package app.gigflow.driver.ui

import android.graphics.*
import android.graphics.drawable.Drawable

/**
 * SF-Symbol-style line icons drawn on canvas — thin stroke, round caps.
 * Glyph names map loosely to SF Symbols semantics.
 */
class IosIcon(
    private val glyph: String,
    private val tint: Int,
    private val strokeWidthPx: Float,
) : Drawable() {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = tint
        style = Paint.Style.STROKE
        strokeWidth = strokeWidthPx
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    override fun draw(canvas: Canvas) {
        val b = bounds
        val w = b.width().toFloat()
        val h = b.height().toFloat()
        val cx = b.exactCenterX()
        val cy = b.exactCenterY()
        val s = Math.min(w, h) * 0.5f // half-extent
        val p = Path()

        when (glyph) {
            "house" -> {
                p.moveTo(cx - s * 0.8f, cy + s * 0.1f)
                p.lineTo(cx, cy - s * 0.75f)
                p.lineTo(cx + s * 0.8f, cy + s * 0.1f)
                p.moveTo(cx - s * 0.6f, cy)
                p.lineTo(cx - s * 0.6f, cy + s * 0.7f)
                p.lineTo(cx + s * 0.6f, cy + s * 0.7f)
                p.lineTo(cx + s * 0.6f, cy - s * 0.02f)
            }
            "tag" -> {
                val r = s * 0.14f
                p.addRoundRect(
                    RectF(cx - s * 0.75f, cy - s * 0.55f, cx + s * 0.6f, cy + s * 0.55f),
                    r, r, Path.Direction.CW,
                )
                canvas.drawPath(p, paint)
                paint.style = Paint.Style.FILL
                canvas.drawCircle(cx - s * 0.35f, cy - s * 0.12f, strokeWidthPx * 0.9f, paint)
                paint.style = Paint.Style.STROKE
                p.reset()
                p.moveTo(cx + s * 0.6f, cy - s * 0.3f)
                p.lineTo(cx + s * 0.9f, cy - s * 0.55f)
            }
            "plus.circle" -> {
                canvas.drawCircle(cx, cy, s * 0.75f, paint)
                canvas.drawLine(cx - s * 0.4f, cy, cx + s * 0.4f, cy, paint)
                canvas.drawLine(cx, cy - s * 0.4f, cx, cy + s * 0.4f, paint)
            }
            "chart.bar" -> {
                val bw = s * 0.26f
                val bottoms = cy + s * 0.7f
                floatArrayOf(0.45f, 0.85f, 0.6f).forEachIndexed { i, f ->
                    val x = cx - s * 0.6f + i * s * 0.6f
                    canvas.drawRoundRect(
                        RectF(x - bw / 2, bottoms - s * 1.3f * f, x + bw / 2, bottoms),
                        bw * 0.3f, bw * 0.3f, paint,
                    )
                }
            }
            "slider" -> {
                val ys = floatArrayOf(cy - s * 0.45f, cy, cy + s * 0.45f)
                val xs = floatArrayOf(cx + s * 0.15f, cx - s * 0.3f, cx + s * 0.35f)
                for (i in ys.indices) {
                    canvas.drawLine(cx - s * 0.7f, ys[i], cx + s * 0.7f, ys[i], paint)
                    canvas.drawCircle(xs[i], ys[i], s * 0.18f, paint)
                }
            }
            "car" -> {
                p.moveTo(cx - s * 0.7f, cy + s * 0.15f)
                p.lineTo(cx - s * 0.55f, cy - s * 0.3f)
                p.quadTo(cx - s * 0.45f, cy - s * 0.55f, cx - s * 0.2f, cy - s * 0.55f)
                p.lineTo(cx + s * 0.25f, cy - s * 0.55f)
                p.quadTo(cx + s * 0.5f, cy - s * 0.55f, cx + s * 0.6f, cy - s * 0.3f)
                p.lineTo(cx + s * 0.72f, cy - s * 0.15f)
                p.quadTo(cx + s * 0.78f, cy, cx + s * 0.72f, cy + s * 0.15f)
                p.lineTo(cx + s * 0.72f, cy + s * 0.45f)
                p.lineTo(cx - s * 0.72f, cy + s * 0.45f)
                p.close()
                canvas.drawPath(p, paint)
                paint.style = Paint.Style.FILL
                canvas.drawCircle(cx - s * 0.35f, cy + s * 0.45f, s * 0.16f, paint)
                canvas.drawCircle(cx + s * 0.38f, cy + s * 0.45f, s * 0.16f, paint)
                paint.style = Paint.Style.STROKE
            }
            "bolt" -> {
                p.moveTo(cx + s * 0.1f, cy - s * 0.8f)
                p.lineTo(cx - s * 0.45f, cy + s * 0.15f)
                p.lineTo(cx - s * 0.02f, cy + s * 0.15f)
                p.lineTo(cx - s * 0.1f, cy + s * 0.8f)
                p.lineTo(cx + s * 0.45f, cy - s * 0.15f)
                p.lineTo(cx + s * 0.02f, cy - s * 0.15f)
                p.close()
                paint.style = Paint.Style.FILL
                canvas.drawPath(p, paint)
                paint.style = Paint.Style.STROKE
            }
            "chevron.right" -> {
                p.moveTo(cx - s * 0.25f, cy - s * 0.5f)
                p.lineTo(cx + s * 0.3f, cy)
                p.lineTo(cx - s * 0.25f, cy + s * 0.5f)
                canvas.drawPath(p, paint)
            }
            "checkmark" -> {
                p.moveTo(cx - s * 0.45f, cy + s * 0.05f)
                p.lineTo(cx - s * 0.08f, cy + s * 0.45f)
                p.lineTo(cx + s * 0.55f, cy - s * 0.4f)
                canvas.drawPath(p, paint)
            }
            "doc" -> {
                val r = s * 0.15f
                p.addRoundRect(
                    RectF(cx - s * 0.55f, cy - s * 0.7f, cx + s * 0.55f, cy + s * 0.7f),
                    r, r, Path.Direction.CW,
                )
                canvas.drawPath(p, paint)
                canvas.drawLine(cx - s * 0.3f, cy - s * 0.25f, cx + s * 0.3f, cy - s * 0.25f, paint)
                canvas.drawLine(cx - s * 0.3f, cy, cx + s * 0.3f, cy, paint)
                canvas.drawLine(cx - s * 0.3f, cy + s * 0.25f, cx + s * 0.1f, cy + s * 0.25f, paint)
            }
            "mappin" -> {
                p.moveTo(cx, cy + s * 0.75f)
                p.cubicTo(cx - s * 0.8f, cy - s * 0.1f, cx - s * 0.45f, cy - s * 0.75f, cx, cy - s * 0.75f)
                p.cubicTo(cx + s * 0.45f, cy - s * 0.75f, cx + s * 0.8f, cy - s * 0.1f, cx, cy + s * 0.75f)
                canvas.drawPath(p, paint)
                canvas.drawCircle(cx, cy - s * 0.22f, s * 0.18f, paint)
            }
        }
        if (glyph in listOf("house", "car", "mappin")) canvas.drawPath(p, paint)
    }

    override fun setAlpha(alpha: Int) { paint.alpha = alpha }
    override fun setColorFilter(cf: ColorFilter?) { paint.colorFilter = cf }
    @Deprecated("deprecated") override fun getOpacity() = PixelFormat.TRANSLUCENT
}
