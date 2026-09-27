package app.gigflow.driver.ui

import android.content.Context
import android.graphics.*
import android.graphics.drawable.Drawable
import android.widget.ImageView
import app.gigflow.driver.R

/**
 * Glyph name → real vector icon (Material iconography, Apache-2.0).
 * Falls back to the hand-drawn [IosIcon] canvas glyph if unmapped.
 */
object Icons {
    private val map = mapOf(
        "house" to R.drawable.ic_home,
        "tag" to R.drawable.ic_offer,
        "plus.circle" to R.drawable.ic_add_circle,
        "slider" to R.drawable.ic_tune,
        "bolt" to R.drawable.ic_bolt,
        "car" to R.drawable.ic_car,
        "speed" to R.drawable.ic_speed,
        "doc" to R.drawable.ic_doc,
        "chevron.right" to R.drawable.ic_chevron_right,
        "checkmark" to R.drawable.ic_check,
        "grid" to R.drawable.ic_apps,
        "chart.bar" to R.drawable.ic_chart,
        "calendar" to R.drawable.ic_calendar,
        "heart" to R.drawable.ic_heart,
        "link" to R.drawable.ic_link,
        "trash" to R.drawable.ic_trash,
        "globe" to R.drawable.ic_globe,
        "person" to R.drawable.ic_person,
        "mappin" to R.drawable.ic_place,
        "history" to R.drawable.ic_history,
    )

    /** An ImageView with the glyph rendered at [sizeDp], tinted [tint]. */
    fun view(ctx: Context, glyph: String, tint: Int, sizeDp: Float): ImageView {
        val iv = ImageView(ctx)
        val res = map[glyph]
        if (res != null) {
            iv.setImageResource(res)
            iv.setColorFilter(tint, PorterDuff.Mode.SRC_IN)
        } else {
            iv.setImageDrawable(IosIcon(glyph, tint, Ios.dp(ctx, 1.8f).toFloat()))
        }
        return iv
    }
}

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
            "grid" -> {
                val cw = s * 0.62f
                for (gx in 0..1) for (gy in 0..1) {
                    val l = cx - s * 0.72f + gx * (cw + s * 0.22f)
                    val t = cy - s * 0.72f + gy * (cw + s * 0.22f)
                    p.addRoundRect(RectF(l, t, l + cw, t + cw), cw * 0.24f, cw * 0.24f, Path.Direction.CW)
                }
                canvas.drawPath(p, paint)
            }
            "heart" -> {
                p.moveTo(cx, cy + s * 0.6f)
                p.cubicTo(cx - s * 0.9f, cy - s * 0.05f, cx - s * 0.55f, cy - s * 0.85f, cx, cy - s * 0.32f)
                p.cubicTo(cx + s * 0.55f, cy - s * 0.85f, cx + s * 0.9f, cy - s * 0.05f, cx, cy + s * 0.6f)
                paint.style = Paint.Style.FILL
                canvas.drawPath(p, paint)
                paint.style = Paint.Style.STROKE
            }
            "link" -> {
                val r = s * 0.3f
                p.addArc(RectF(cx - s * 0.75f, cy - s * 0.35f, cx - s * 0.05f, cy + s * 0.35f), 90f, 270f)
                p.addArc(RectF(cx + s * 0.05f, cy - s * 0.35f, cx + s * 0.75f, cy + s * 0.35f), -90f, 270f)
                canvas.drawPath(p, paint)
                canvas.drawLine(cx - s * 0.3f, cy, cx + s * 0.3f, cy, paint)
            }
            "trash" -> {
                canvas.drawRoundRect(
                    RectF(cx - s * 0.5f, cy - s * 0.35f, cx + s * 0.5f, cy + s * 0.65f),
                    s * 0.12f, s * 0.12f, paint)
                canvas.drawLine(cx - s * 0.62f, cy - s * 0.45f, cx + s * 0.62f, cy - s * 0.45f, paint)
                canvas.drawLine(cx - s * 0.15f, cy - s * 0.45f, cx - s * 0.15f, cy - s * 0.6f, paint)
                canvas.drawLine(cx - s * 0.15f, cy - s * 0.6f, cx + s * 0.15f, cy - s * 0.6f, paint)
                canvas.drawLine(cx + s * 0.15f, cy - s * 0.6f, cx + s * 0.15f, cy - s * 0.45f, paint)
                canvas.drawLine(cx - s * 0.15f, cy - s * 0.05f, cx - s * 0.15f, cy + s * 0.4f, paint)
                canvas.drawLine(cx + s * 0.15f, cy - s * 0.05f, cx + s * 0.15f, cy + s * 0.4f, paint)
            }
            "globe" -> {
                canvas.drawCircle(cx, cy, s * 0.7f, paint)
                canvas.drawOval(RectF(cx - s * 0.32f, cy - s * 0.7f, cx + s * 0.32f, cy + s * 0.7f), paint)
                canvas.drawLine(cx - s * 0.66f, cy - s * 0.22f, cx + s * 0.66f, cy - s * 0.22f, paint)
                canvas.drawLine(cx - s * 0.66f, cy + s * 0.22f, cx + s * 0.66f, cy + s * 0.22f, paint)
            }
            "plus.circle" -> {
                canvas.drawCircle(cx, cy, s * 0.75f, paint)
                canvas.drawLine(cx - s * 0.36f, cy, cx + s * 0.36f, cy, paint)
                canvas.drawLine(cx, cy - s * 0.36f, cx, cy + s * 0.36f, paint)
            }
            "person" -> {
                canvas.drawCircle(cx, cy - s * 0.35f, s * 0.28f, paint)
                p.addArc(RectF(cx - s * 0.55f, cy + s * 0.02f, cx + s * 0.55f, cy + s * 1.1f), 180f, 180f)
                canvas.drawPath(p, paint)
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
