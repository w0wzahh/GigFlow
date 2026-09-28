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
        versionCode = 23
        versionName = "1.6.2"
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
    // FileProvider for handing the downloaded update APK to the installer.
    implementation("androidx.core:core:1.13.1")
}

