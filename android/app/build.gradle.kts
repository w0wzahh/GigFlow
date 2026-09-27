plugins {
    id("com.android.application")
}

android {
    namespace = "app.gigflow.driver"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.gigflow.driver"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles("proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // osmdroid: Apache-2.0 map renderer on OpenStreetMap tiles — no API key,
    // tiles cache on-device for offline re-viewing. Powers the Plan heatmap.
    implementation("org.osmdroid:osmdroid-android:6.1.18")
}
