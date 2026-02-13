# Android VPN Client APK - Step-by-Step Guide

## Recommendation: Kotlin + ics-openvpn (Native Android)

**Why:** `ics-openvpn` is the same library behind the Play Store "OpenVPN for Android" app. Most reliable OpenVPN integration available, first-class Android TV support, standard build toolchain.

---

## Step 1: Install Android Studio

1. Go to https://developer.android.com/studio
2. Download for your OS (Windows/Mac/Linux) - ~1GB download, ~5GB installed
3. Run the installer, accept all defaults
4. On first launch, select "Standard" setup when prompted
5. Accept all SDK license agreements (click each tab and accept)
6. Let it download SDK components (this takes a while)

## Step 2: Install Additional Build Tools

**Inside Android Studio:**
1. Open Settings (File > Settings on Windows/Linux, Android Studio > Preferences on Mac)
2. Navigate to: Languages & Frameworks > Android SDK > SDK Tools tab
3. Check these boxes and click Apply:
   - **NDK (Side by side)** - needed for OpenVPN native code
   - **CMake** - needed for native builds

**In your system terminal:**
```bash
# Linux/Mac - install SWIG (required for ics-openvpn)
sudo apt install swig          # Ubuntu/Debian
brew install swig              # macOS

# Windows - download SWIG from http://www.swig.org/download.html and add to PATH
```

## Step 3: Create New Project

1. Open Android Studio
2. Click **New Project**
3. Select **Empty Activity** (the Jetpack Compose one)
4. Configure:
   - **Name:** `VPN Client` (or your brand name)
   - **Package name:** `com.yourcompany.vpnclient`
   - **Save location:** wherever you want on your local machine
   - **Language:** Kotlin
   - **Minimum SDK:** API 24 (Android 7.0) - covers 99% of devices
5. Click **Finish** and wait for Gradle sync to complete

## Step 4: Add ics-openvpn as a Submodule

In a terminal, navigate to your new project folder:
```bash
cd /path/to/VPNClient

# Add ics-openvpn as a git submodule
git init  # if not already a git repo
git submodule add https://github.com/schwabe/ics-openvpn.git ics-openvpn
```

Then edit two files in your project:

**`settings.gradle.kts`** - add this line at the bottom:
```kotlin
include(":ics-openvpn:main")
```

**`app/build.gradle.kts`** - add inside the `dependencies { }` block:
```kotlin
implementation(project(":ics-openvpn:main"))
```

Back in Android Studio, click **Sync Now** when the yellow bar appears.

> **Note:** You may need to modify `ics-openvpn/main/build.gradle.kts` to change `com.android.application` to `com.android.library` and remove the `applicationId` line. Android Studio error messages will guide you if needed.

## Step 5: Add Dependencies

Edit **`app/build.gradle.kts`** and add these inside `dependencies { }`:

```kotlin
// HTTP client for calling your API
implementation("com.squareup.retrofit2:retrofit:2.11.0")
implementation("com.squareup.retrofit2:converter-gson:2.11.0")
implementation("com.squareup.okhttp3:okhttp:4.12.0")

// Encrypted storage for auth tokens
implementation("androidx.security:security-crypto:1.1.0-alpha06")

// Navigation between screens
implementation("androidx.navigation:navigation-compose:2.7.7")

// ViewModel for state management
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.0")
```

Click **Sync Now** again.

## Step 6: Configure AndroidManifest.xml

Open `app/src/main/AndroidManifest.xml` and add:

```xml
<!-- Add these permissions before the <application> tag -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

<!-- Android TV support (add before <application>) -->
<uses-feature android:name="android.software.leanback" android:required="false" />
<uses-feature android:name="android.hardware.touchscreen" android:required="false" />

<!-- Inside the <activity> tag's <intent-filter>, add: -->
<category android:name="android.intent.category.LEANBACK_LAUNCHER" />
```

## Step 7: Write the App Code

The app needs these screens (all in Jetpack Compose / Kotlin):

### Screen 1: Login
- Username + password text fields
- Login button
- Calls `POST https://your-api-url/auth/login` with `{ username, password }`
- Receives `{ accessToken, refreshToken }` - store both securely

### Screen 2: Server List
- Calls `GET /configs/nodes` with Bearer token header
- Shows list of VPN server names
- Tap a server to connect

### Screen 3: Connection
- Calls `POST /configs/generate` with `{ deviceName: "android", vpnNodeId: "<selected>" }`
- Response includes `ovpnConfig` field - this is the raw .ovpn text
- Feed that string into ics-openvpn's service to establish VPN connection
- Show: Connected/Disconnected status, Disconnect button

### Key code pattern for OpenVPN connection:
```kotlin
// The critical part - connecting using ics-openvpn
val vpnProfile = ProfileManager.getInstance(context)
// Import the .ovpn config string
val configParser = ConfigParser()
configParser.parseConfig(StringReader(ovpnConfigString))
val profile = configParser.convertProfile()
// Start the VPN
VPNLaunchHelper.startOpenVpn(profile, context)
```

> **Tip:** Search GitHub for "ics-openvpn client example" or look at the template project https://github.com/gayanvoice/android-vpn-client-ics-openvpn for working code you can reference.

## Step 8: Build the APK

### Debug APK (for testing):
1. In Android Studio menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
2. Wait for build to complete (first build is slow - compiles native OpenVPN code)
3. Click "locate" in the notification popup
4. Your APK is at: `app/build/outputs/apk/debug/app-debug.apk`

### Or from terminal:
```bash
cd /path/to/VPNClient
./gradlew assembleDebug
```

## Step 9: Test on Emulator

### Phone emulator:
1. Android Studio > Device Manager (right sidebar icon)
2. Click **Create Virtual Device**
3. Select **Pixel 7** > Next
4. Select **API 34** system image (download if needed) > Next > Finish
5. Click the play button on the virtual device
6. Click the green **Run** button in Android Studio toolbar - app deploys to emulator

### TV emulator:
1. Device Manager > Create Virtual Device
2. Category: **TV** > Select **Android TV (1080p)**
3. Select API 34 > Finish
4. Run the app on this device to test D-pad navigation

## Step 10: Test on Real Device

### Android phone/tablet:
1. On the device: Settings > About Phone > tap **Build Number** 7 times (enables Developer Options)
2. Settings > Developer Options > enable **USB Debugging**
3. Connect phone to computer via USB cable
4. Accept the debugging prompt on the phone
5. The device appears in Android Studio's device dropdown
6. Click Run - app installs and launches

### Android TV box:
1. On the TV box: Settings > Device Preferences > About > tap Build Number 7 times
2. Settings > Device Preferences > Developer Options > enable **Network debugging** (note the IP:port shown)
3. On your computer terminal:
   ```bash
   adb connect 192.168.1.XXX:5555    # use the TV box IP
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
4. The app appears in the TV launcher

## Step 11: Build Release APK (for distribution)

1. Android Studio: **Build > Generate Signed Bundle / APK**
2. Select **APK** > Next
3. **Create new keystore:**
   - Choose file location (keep this file safe - you need it for all future updates)
   - Set a password (remember it)
   - Fill in certificate info (name, org, etc.)
4. Select **release** build variant > Finish
5. Output: `app/build/outputs/apk/release/app-release.apk`

This APK can be sideloaded on any Android device or distributed via your website.

---

## Backend Change Required (1 file)

Before the Android app can talk to your API, update CORS:

**File:** `/opt/vpn/apps/api/src/main.ts` (line 12)

```typescript
// Change from:
app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3100', credentials: true });

// Change to:
app.enableCors({ origin: true, credentials: true });
```

This allows the Android HTTP client (which sends no browser origin) to reach the API. Safe because auth uses JWT Bearer tokens, not cookies.

**No new API endpoints needed.** Your existing API already has everything the Android client needs.

---

## Existing API Endpoints the App Will Use

| Screen | Endpoint | What it does |
|--------|----------|-------------|
| Login | `POST /auth/login` | Authenticate, get JWT tokens |
| Auto-login | `POST /auth/refresh` | Refresh expired access token |
| Logout | `POST /auth/logout` | Invalidate refresh token |
| Server list | `GET /configs/nodes` | List available VPN servers |
| Connect | `POST /configs/generate` | Generate .ovpn config for a server |
| Reconnect | `GET /configs/:certId/download/:vpnNodeId` | Re-download existing config |

---

## Verification Checklist

- [ ] Android Studio installed and SDK synced
- [ ] SWIG, NDK, CMake installed
- [ ] Project created and ics-openvpn submodule added
- [ ] Gradle sync succeeds
- [ ] CORS updated on backend API
- [ ] Login works (tokens received and stored)
- [ ] Server list loads
- [ ] VPN connects via ics-openvpn
- [ ] Session visible in admin dashboard
- [ ] Disconnect works cleanly
- [ ] APK installs on real phone
- [ ] APK installs on Android TV box
