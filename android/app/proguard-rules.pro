# Accessibility services are instantiated by the system — keep entry points.
-keep class app.gigflow.driver.GigFlowAccessibilityService { *; }
-keep class * extends android.accessibilityservice.AccessibilityService { *; }
