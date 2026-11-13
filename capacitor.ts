import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

/**
 * Native bridge helpers for the Capacitor Android APK.
 * Every function is a safe no-op when running in a normal browser, so the
 * web build is completely unaffected.
 */
export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

let bridgeInitialized = false;

interface CapacitorBridgeCallbacks {
  /** Returns the current hardware-back-button handler. Return true if handled. */
  getBackHandler: () => () => boolean;
  /** Called whenever the device network connectivity changes. */
  onNetworkChange: (online: boolean) => void;
}

/**
 * Initializes native-only behavior exactly once:
 *  - hides the native splash screen once the web app has booted
 *  - styles the Android status bar to match the app theme
 *  - wires the hardware back button (editor -> dashboard -> exit app)
 *  - mirrors real device connectivity into the app's online/offline indicator
 */
export async function initCapacitorBridge(
  callbacks: CapacitorBridgeCallbacks
): Promise<void> {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  if (bridgeInitialized) return;
  bridgeInitialized = true;

  try {
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {
    /* plugin unavailable */
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#0F172A" });
  } catch {
    /* plugin unavailable */
  }

  App.addListener("backButton", () => {
    let handled = false;
    try {
      handled = callbacks.getBackHandler()();
    } catch {
      handled = false;
    }
    if (!handled) {
      App.exitApp();
    }
  });

  try {
    const status = await Network.getStatus();
    callbacks.onNetworkChange(status.connected);
  } catch {
    /* keep browser default */
  }

  Network.addListener("networkStatusChange", (s) => {
    callbacks.onNetworkChange(s.connected);
  });
}

/** Keeps the Android status bar in sync with the app's dark/light UI mode. */
export async function syncStatusBar(darkMode: boolean): Promise<void> {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: darkMode ? Style.Light : Style.Dark });
    await StatusBar.setBackgroundColor({
      color: darkMode ? "#020617" : "#F8FAFC",
    });
  } catch {
    /* plugin unavailable */
  }
}
