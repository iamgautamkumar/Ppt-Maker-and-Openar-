import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ShikshaSlide Studio — Capacitor configuration for the Android APK.
 *
 * The Next.js app is a full-stack server app (PostgreSQL API routes), so the
 * Android WebView loads the running Next.js server instead of a static bundle:
 *
 *  - Set CAPACITOR_SERVER_URL before `npx cap sync android` to bake a direct
 *    server URL into the app, e.g.:
 *      CAPACITOR_SERVER_URL=http://10.0.2.2:3000 npx cap sync android   (emulator)
 *      CAPACITOR_SERVER_URL=http://192.168.1.10:3000 npx cap sync android (device)
 *      CAPACITOR_SERVER_URL=https://your-deployed-app.example.com npx cap sync android
 *
 *  - If CAPACITOR_SERVER_URL is NOT set, the bundled `www/index.html` shell is
 *    loaded first; it lets the teacher type/pick the Next.js server URL once
 *    (persisted in WebView localStorage) and then redirects the WebView into
 *    the live app. Append `?reset=1` to the shell URL to change it later.
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.shikshaslide.studio",
  appName: "ShikshaSlide Studio",
  webDir: "www",
  server: {
    ...(serverUrl ? { url: serverUrl } : {}),
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: "#0F172A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0F172A",
      overlaysWebView: false,
    },
  },
};

export default config;
