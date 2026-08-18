plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.manavdesai.journeysync"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.manavdesai.journeysync"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "FLIGHT_API_BASE_URL", "\"https://journeysync-travel-planner.manavdesai.workers.dev\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        getByName("debug") {
            storeFile = rootProject.file(".android/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.16.0"))
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.android.gms:play-services-auth:21.3.0")
    implementation("androidx.annotation:annotation:1.9.1")
    testImplementation("junit:junit:4.13.2")
}
