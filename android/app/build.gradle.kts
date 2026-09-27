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
        versionCode = 1
        versionName = "0.1.0"
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
    // Intentionally zero third-party deps — the accessibility service,
    // overlay, and gesture dispatch are all platform APIs.
}
