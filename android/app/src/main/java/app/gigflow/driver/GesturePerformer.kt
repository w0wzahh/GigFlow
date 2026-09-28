package app.gigflow.driver

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect

/** Performs taps inside the target app via the accessibility gesture API. */
object GesturePerformer {

    fun tap(service: AccessibilityService, bounds: Rect, done: (Boolean) -> Unit = {}) {
        val path = Path().apply {
            moveTo(bounds.exactCenterX(), bounds.exactCenterY())
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        // dispatchGesture returns false when it can't dispatch at all —
        // neither callback fires then, so report failure ourselves.
        val dispatched = service.dispatchGesture(
            gesture,
            object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) = done(true)
                override fun onCancelled(g: GestureDescription?) = done(false)
            },
            null,
        )
        if (!dispatched) done(false)
    }

    /** Left→right swipe across [bounds] — Amazon Flex uses a "swipe to
     *  accept" slider where a plain tap does nothing. */
    fun swipeRight(service: AccessibilityService, bounds: Rect, done: (Boolean) -> Unit = {}) {
        val path = Path().apply {
            moveTo(bounds.left + bounds.width() * 0.15f, bounds.exactCenterY())
            lineTo(bounds.right - bounds.width() * 0.10f, bounds.exactCenterY())
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 350))
            .build()
        val dispatched = service.dispatchGesture(
            gesture,
            object : AccessibilityService.GestureResultCallback() {
                override fun onCompleted(g: GestureDescription?) = done(true)
                override fun onCancelled(g: GestureDescription?) = done(false)
            },
            null,
        )
        if (!dispatched) done(false)
    }
}
