package app.gigflow.driver.ui

import android.animation.ValueAnimator
import android.app.Dialog
import android.content.Context
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.view.*
import android.widget.*
import app.gigflow.driver.ui.Ios.ANIM_FAST
import app.gigflow.driver.ui.Ios.ANIM_MS
import app.gigflow.driver.ui.Ios.EASE_OUT
import app.gigflow.driver.ui.Ios.Palette
import app.gigflow.driver.ui.Ios.SPRING
import app.gigflow.driver.ui.Ios.dp
import app.gigflow.driver.ui.Ios.haptic
import app.gigflow.driver.ui.Ios.pressable

private fun View.lp(w: Int, h: Int, margins: IntArray = intArrayOf(0, 0, 0, 0)): View {
    layoutParams = LinearLayout.LayoutParams(w, h).apply {
        setMargins(margins[0], margins[1], margins[2], margins[3])
    }
    return this
}

/** iOS-style toggle — track + thumb, spring-animated. */
class IosSwitch(ctx: Context, private val p: Palette) : View(ctx) {

    var isChecked = false
        private set
    var onChanged: ((Boolean) -> Unit)? = null

    private var t = 0f // 0 = off, 1 = on
    private var anim: ValueAnimator? = null

    init {
        val w = dp(ctx, 51f); val h = dp(ctx, 31f)
        minimumWidth = w; minimumHeight = h
        layoutParams = ViewGroup.LayoutParams(w, h)
        setOnClickListener { setChecked(!isChecked, true) }
    }

    fun setChecked(on: Boolean, animate: Boolean) {
        if (isChecked == on && t == (if (on) 1f else 0f)) return
        isChecked = on
        onChanged?.invoke(on)
        anim?.cancel()
        if (!animate) { t = if (on) 1f else 0f; invalidate(); return }
        anim = ValueAnimator.ofFloat(t, if (on) 1f else 0f).apply {
            duration = ANIM_FAST
            interpolator = SPRING
            addUpdateListener { t = it.animatedValue as Float; invalidate() }
            start()
        }
        haptic()
    }

    override fun onMeasure(wm: Int, hm: Int) {
        setMeasuredDimension(
            resolveSize(dp(context, 51f), wm),
            resolveSize(dp(context, 31f), hm),
        )
    }

    override fun onDraw(c: Canvas) {
        val w = width.toFloat(); val h = height.toFloat()
        val r = h / 2f
        val track = lerpColor(p.fill, p.green, t)
        val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = track }
        c.drawRoundRect(RectF(0f, 0f, w, h), r, r, trackPaint)

        val thumbR = r - dp(context, 2f)
        val thumbX = r + t * (w - 2 * r)
        val cy = r
        // subtle iOS thumb shadow
        val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(60, 0, 0, 0)
        }
        c.drawCircle(thumbX, cy + 1.5f, thumbR, shadow)
        val thumb = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
        c.drawCircle(thumbX, cy, thumbR, thumb)
    }

    private fun lerpColor(a: Int, b: Int, f: Float): Int {
        val ar = Color.red(a); val ag = Color.green(a); val ab = Color.blue(a)
        return Color.rgb(
            (ar + (Color.red(b) - ar) * f).toInt(),
            (ag + (Color.green(b) - ag) * f).toInt(),
            (ab + (Color.blue(b) - ab) * f).toInt(),
        )
    }
}

/** iOS segmented control — translucent track, bright pill on the selected cell. */
class IosSegmented(
    ctx: Context,
    private val p: Palette,
    options: List<String>,
    initial: Int = 0,
) : LinearLayout(ctx) {

    var selected = initial
        private set
    var onSelected: ((Int) -> Unit)? = null

    private val cells = mutableListOf<TextView>()
    private val thumbBg by lazy {
        Ios.rounded(7.5f, if (p.label == Color.WHITE) Color.parseColor("#636366") else Color.WHITE, context)
    }

    init {
        orientation = HORIZONTAL
        background = Ios.rounded(9f, p.fill, ctx)
        setPadding(dp(ctx, 2f), dp(ctx, 2f), dp(ctx, 2f), dp(ctx, 2f))
        options.forEachIndexed { i, label ->
            val cell = TextView(ctx).apply {
                text = label
                textSize = Ios.T_FOOTNOTE
                gravity = Gravity.CENTER
                setTextColor(p.label)
                setPadding(0, dp(ctx, 5f), 0, dp(ctx, 5f))
                isAllCaps = false
                setOnClickListener { select(i) }
            }
            addView(cell, LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            cells.add(cell)
        }
        post { applySelection(initial, animate = false) }
    }

    fun select(i: Int) {
        if (i == selected) return
        selected = i
        onSelected?.invoke(i)
        applySelection(i, animate = true)
    }

    private fun applySelection(i: Int, animate: Boolean) {
        cells.forEachIndexed { j, tv ->
            if (j == i) {
                tv.background = thumbBg.constantState?.newDrawable()
                tv.setTypeface(null, Typeface.BOLD)
                if (animate) {
                    tv.animate().scaleX(1f).scaleY(1f).setDuration(0).start()
                    tv.haptic()
                }
            } else {
                tv.background = null
                tv.setTypeface(null, Typeface.NORMAL)
            }
            tv.alpha = if (j == i) 1f else 0.6f
        }
    }
}

/** Builds an iOS grouped-list section: header label + rounded card of rows. */
object Sections {

    fun header(ctx: Context, p: Palette, title: String): TextView =
        TextView(ctx).apply {
            text = title.uppercase()
            textSize = Ios.T_FOOTNOTE
            setTextColor(p.label2)
            setPadding(dp(ctx, 16f), dp(ctx, 20f), dp(ctx, 16f), dp(ctx, 6f))
        }

    fun card(ctx: Context, p: Palette): LinearLayout =
        LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = Ios.cardBg(p, ctx)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT,
            ).apply { setMargins(dp(ctx, 16f), 0, dp(ctx, 16f), 0) }
        }

    fun separator(ctx: Context, p: Palette): View =
        View(ctx).apply {
            setBackgroundColor(Color.argb(30, Color.red(p.label2), Color.green(p.label2), Color.blue(p.label2)))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1,
            ).apply { setMargins(dp(ctx, 16f), 0, 0, 0) }
        }

    /** A settings/list row: [icon?] title ... value/chevron. */
    fun row(
        ctx: Context, p: Palette,
        title: String,
        subtitle: String? = null,
        value: String? = null,
        iconGlyph: String? = null,
        iconTint: Int? = null,
        chevron: Boolean = false,
        onClick: (() -> Unit)? = null,
    ): View {
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(ctx, 16f), dp(ctx, 11f), dp(ctx, 16f), dp(ctx, 11f))
            minimumHeight = dp(ctx, 44f)
        }
        if (iconGlyph != null) {
            val badge = FrameLayout(ctx).apply {
                background = Ios.rounded(7f, iconTint ?: p.tint, ctx)
                addView(Icons.view(ctx, iconGlyph, Color.WHITE, 16f),
                    FrameLayout.LayoutParams(dp(ctx, 16f), dp(ctx, 16f), Gravity.CENTER))
            }
            row.addView(badge.lp(dp(ctx, 29f), dp(ctx, 29f), intArrayOf(0, 0, dp(ctx, 12f), 0)))
        }
        val texts = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            row.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        texts.addView(TextView(ctx).apply {
            text = title; textSize = Ios.T_BODY; setTextColor(p.label)
        })
        subtitle?.let {
            texts.addView(TextView(ctx).apply {
                text = it; textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
                setPadding(0, dp(ctx, 1f), 0, 0)
            })
        }
        value?.let {
            row.addView(TextView(ctx).apply {
                text = it; textSize = Ios.T_BODY; setTextColor(p.label2)
                setPadding(dp(ctx, 8f), 0, 0, 0)
            })
        }
        if (chevron) {
            row.addView(Icons.view(ctx, "chevron.right", p.label3, 14f)
                .lp(dp(ctx, 12f), dp(ctx, 14f), intArrayOf(dp(ctx, 6f), 0, 0, 0)))
        }
        if (onClick != null) {
            row.pressable()
            row.setOnClickListener { row.haptic(); onClick() }
        }
        return row
    }

    /** Row containing a right-aligned switch. */
    fun switchRow(
        ctx: Context, p: Palette,
        title: String, subtitle: String? = null,
        checked: Boolean, onChange: (Boolean) -> Unit,
    ): Pair<View, IosSwitch> {
        val sw = IosSwitch(ctx, p)
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(ctx, 16f), dp(ctx, 8f), dp(ctx, 16f), dp(ctx, 8f))
            minimumHeight = dp(ctx, 44f)
        }
        val texts = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            row.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        texts.addView(TextView(ctx).apply {
            text = title; textSize = Ios.T_BODY; setTextColor(p.label)
        })
        subtitle?.let {
            texts.addView(TextView(ctx).apply {
                text = it; textSize = Ios.T_FOOTNOTE; setTextColor(p.label2)
            })
        }
        sw.onChanged = onChange
        sw.setChecked(checked, false)
        row.addView(sw)
        row.setOnClickListener { sw.setChecked(!sw.isChecked, true) }
        return row to sw
    }

    /** iOS form row: label above filled input, inside grouped card. */
    fun field(ctx: Context, p: Palette, hint: String, value: String, numeric: Boolean = true): EditText {
        return EditText(ctx).apply {
            this.hint = hint
            setHintTextColor(p.label3)
            setTextColor(p.label)
            textSize = Ios.T_BODY
            setText(value)
            setBackgroundColor(Color.TRANSPARENT)
            setPadding(dp(ctx, 16f), dp(ctx, 11f), dp(ctx, 16f), dp(ctx, 11f))
            inputType = if (numeric)
                InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            else InputType.TYPE_CLASS_TEXT
            setSingleLine()
        }
    }

    /**
     * iOS Settings-style form row: gray label on the left, editable value on
     * the right. Returns (rowView, editText).
     */
    fun formField(
        ctx: Context, p: Palette,
        label: String, value: String,
        numeric: Boolean = true,
        hint: String = "",
    ): Pair<View, EditText> {
        val field = EditText(ctx).apply {
            this.hint = hint
            setHintTextColor(p.label3)
            setTextColor(p.label)
            textSize = Ios.T_BODY
            setText(value)
            setBackgroundColor(Color.TRANSPARENT)
            gravity = Gravity.END
            inputType = if (numeric)
                InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            else InputType.TYPE_CLASS_TEXT
            setSingleLine()
        }
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(ctx, 16f), 0, dp(ctx, 16f), 0)
            minimumHeight = dp(ctx, 46f)
            addView(TextView(ctx).apply {
                text = label; textSize = Ios.T_BODY; setTextColor(p.label2)
            })
            addView(field, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        return row to field
    }
}

/** Minimal bar chart — iOS-tinted bars with rounded tops. */
class WeekBars(
    ctx: Context, private val p: Palette,
    private val vals: FloatArray, private val labels: Array<String>,
) : View(ctx) {
    private val barPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.tint }
    private val ghostPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.fill }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = p.label2; textSize = Ios.dp(ctx, 10f).toFloat(); textAlign = Paint.Align.CENTER
    }
    override fun onDraw(c: Canvas) {
        val n = vals.size
        val slot = width / n.toFloat()
        val bw = slot * 0.42f
        val max = (vals.maxOrNull() ?: 1f).coerceAtLeast(1f)
        val labelH = height * 0.2f
        val chartH = height - labelH
        for (i in 0 until n) {
            val cx = slot * i + slot / 2
            val h = if (vals[i] <= 0) dp(context, 4f).toFloat() else (vals[i] / max) * (chartH - dp(context, 4f)) + dp(context, 4f)
            val paint = if (vals[i] <= 0) ghostPaint else barPaint
            c.drawRoundRect(RectF(cx - bw / 2, chartH - h, cx + bw / 2, chartH), bw / 2, bw / 2, paint)
            c.drawText(labels[i], cx, height - dp(context, 2f).toFloat(), textPaint)
        }
    }
}

/** Thin iOS progress bar — track + fill, animated width. */
class ProgressBar(ctx: Context, private val p: Palette, private var pct: Int) : View(ctx) {
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.fill }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = p.tint }
    fun set(v: Int) { pct = v; invalidate() }
    override fun onDraw(c: Canvas) {
        val r = height / 2f
        c.drawRoundRect(RectF(0f, 0f, width.toFloat(), height.toFloat()), r, r, track)
        val w = width * pct.coerceIn(0, 100) / 100f
        if (w > 0) c.drawRoundRect(RectF(0f, 0f, maxOf(w, height.toFloat()), height.toFloat()), r, r, fill)
    }
}

/** iOS filled button — tint, spring press. */
fun iosButton(ctx: Context, p: Palette, label: String, tint: Int? = null): Button {
    return Button(ctx).apply {
        text = label
        isAllCaps = false
        textSize = Ios.T_BODY
        setTextColor(Color.WHITE)
        setTypeface(typeface, Typeface.BOLD)
        background = Ios.rounded(Ios.R_BUTTON, tint ?: p.tint, ctx)
        minHeight = dp(ctx, 46f)
        stateListAnimator = null
        pressable(0.97f)
        setOnClickListener { haptic() }
    }
}

/**
 * iOS-style bottom sheet dialog — slides up over dim, grabber handle,
 * tap anywhere outside (or back) to dismiss.
 */
class IosSheet(ctx: Context, private val p: Palette) {

    private val dialog = Dialog(ctx, android.R.style.Theme_Translucent_NoTitleBar)
    private val container = LinearLayout(ctx)
    private val content = LinearLayout(ctx)

    init {
        content.orientation = LinearLayout.VERTICAL
        container.orientation = LinearLayout.VERTICAL
        container.addView(View(ctx).apply {
            background = Ios.rounded(3f, p.sheetHandle, ctx)
            layoutParams = LinearLayout.LayoutParams(dp(ctx, 36f), dp(ctx, 5f)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = dp(ctx, 8f)
            }
        })
        container.addView(content)
        container.background = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(p.card, p.card),
        ).apply { cornerRadii = floatArrayOf(
            dp(ctx, Ios.R_SHEET).toFloat(), dp(ctx, Ios.R_SHEET).toFloat(),
            dp(ctx, Ios.R_SHEET).toFloat(), dp(ctx, Ios.R_SHEET).toFloat(), 0f, 0f, 0f, 0f,
        ) }
        container.setPadding(0, 0, 0, dp(ctx, 20f))

        // Full-height window with a tap-catcher behind the card — touches on
        // the dimmed area dismiss with the same slide-down animation (the
        // default dialog window only covered the card, so outside taps did
        // nothing).
        val scrim = View(ctx).apply {
            isClickable = true
            setOnClickListener { dismiss() }
        }
        val outer = FrameLayout(ctx).apply {
            addView(scrim, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            addView(container, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        }

        dialog.setContentView(outer)
        dialog.setCanceledOnTouchOutside(true)
        dialog.window?.let { w ->
            w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            w.attributes = w.attributes.apply {
                windowAnimations = 0
            }
            w.setDimAmount(0.4f)
            w.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        }
    }

    fun add(v: View): IosSheet { content.addView(v); return this }
    fun show(): IosSheet {
        dialog.show()
        container.translationY = container.height.toFloat().coerceAtLeast(300f)
        container.post {
            container.translationY = container.height.toFloat()
            container.animate().translationY(0f).setDuration(ANIM_MS)
                .setInterpolator(EASE_OUT).start()
        }
        return this
    }
    fun dismiss() {
        container.animate().translationY(container.height.toFloat())
            .setDuration(ANIM_FAST).setInterpolator(EASE_OUT)
            .withEndAction { dialog.dismiss() }.start()
    }
    fun onDismiss(l: () -> Unit) { dialog.setOnDismissListener { l() } }
}

/** Floating iOS tab bar — translucent pill, icon + label, animated accent. */
class TabBar(ctx: Context, private val p: Palette) : FrameLayout(ctx) {

    data class Tab(val glyph: String, val label: String)

    private val row = LinearLayout(ctx)
    private val cells = mutableListOf<LinearLayout>()
    private var tabs = listOf<Tab>()
    var onSelect: ((Int) -> Unit)? = null
    var selected = 0
        private set

    init {
        val bar = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            background = Ios.stroke(28f,
                if (p.label == Color.WHITE) Color.parseColor("#D91C1C1E") else Color.parseColor("#D9FFFFFF"),
                Color.argb(40, 120, 120, 128), ctx)
            elevation = dp(ctx, 12f).toFloat()
            setPadding(dp(ctx, 6f), dp(ctx, 6f), dp(ctx, 6f), dp(ctx, 6f))
        }
        row.orientation = LinearLayout.HORIZONTAL
        bar.addView(row, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(bar, FrameLayout.LayoutParams(
            LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT,
        ).apply {
            setMargins(dp(ctx, 14f), 0, dp(ctx, 14f), dp(ctx, 10f))
            gravity = Gravity.BOTTOM
        })
    }

    fun setTabs(tabs: List<Tab>) {
        this.tabs = tabs
        row.removeAllViews(); cells.clear()
        tabs.forEachIndexed { i, tab ->
            val cell = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(0, dp(context, 6f), 0, dp(context, 5f))
                pressable(0.92f)
                setOnClickListener { select(i) }
            }
            val icon = Icons.view(context, tab.glyph, p.gray, 24f)
            val label = TextView(context).apply {
                text = tab.label
                textSize = 10f
                gravity = Gravity.CENTER
                setTextColor(p.gray)
                setPadding(0, dp(context, 2f), 0, 0)
            }
            cell.addView(icon, LinearLayout.LayoutParams(
                dp(context, 24f), dp(context, 24f)).apply { gravity = Gravity.CENTER_HORIZONTAL })
            cell.addView(label, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
            row.addView(cell, LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f))
            cells.add(cell)
        }
    }

    fun select(i: Int) {
        selected = i
        onSelect?.invoke(i)
        cells.forEachIndexed { j, cell ->
            val icon = cell.getChildAt(0) as ImageView
            val label = cell.getChildAt(1) as TextView
            val tint = if (j == i) p.tint else p.gray
            icon.setColorFilter(tint, android.graphics.PorterDuff.Mode.SRC_IN)
            label.setTextColor(tint)
            if (j == i) {
                icon.animate().scaleX(1.12f).scaleY(1.12f).setDuration(ANIM_FAST)
                    .setInterpolator(SPRING).withEndAction {
                        icon.animate().scaleX(1f).scaleY(1f).setDuration(ANIM_FAST).start()
                    }.start()
                cell.haptic()
            }
        }
    }
}
