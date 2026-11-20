/**
 * LINE LIFF SDK Helper for EduConnect360 Parent Portal
 * Supports strict LINE in-client verification, profile fetching,
 * and seamless fallback handling.
 */

declare global {
  interface Window {
    liff?: any;
  }
}

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

let liffInitPromise: Promise<any> | null = null;

/**
 * Dynamically loads the official LINE LIFF SDK script if not already present
 */
function loadLiffScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    if (window.liff) {
      resolve();
      return;
    }
    const existingScript = document.getElementById("line-liff-sdk");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }
    const script = document.createElement("script");
    script.id = "line-liff-sdk";
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.charset = "utf-8";
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error("Failed to load LINE LIFF SDK"));
    document.head.appendChild(script);
  });
}

/**
 * Initializes the LINE LIFF SDK with the configured LIFF ID.
 */
export async function initLiff(customLiffId?: string): Promise<any> {
  if (liffInitPromise) {
    return liffInitPromise;
  }

  const liffId =
    customLiffId ||
    import.meta.env.VITE_LINE_LIFF_ID ||
    "2012726688-SBKhhJZJ";

  liffInitPromise = (async () => {
    await loadLiffScript();
    if (!window.liff) {
      throw new Error("LINE LIFF SDK is unavailable");
    }

    if (!liffId) {
      console.warn(
        "VITE_LINE_LIFF_ID is not configured in .env. Running in uninitialized preview mode.",
      );
      return window.liff;
    }

    try {
      await window.liff.init({ liffId });
      return window.liff;
    } catch (err) {
      console.error("LIFF initialization error:", err);
      throw err;
    }
  })();

  return liffInitPromise;
}

/**
 * Checks if the web app is running inside the LINE In-App Browser
 */
export function isLiffInClient(): boolean {
  if (typeof window === "undefined" || !window.liff) return false;
  try {
    return window.liff.isInClient();
  } catch {
    return false;
  }
}

/**
 * Checks if user is logged into LINE via LIFF
 */
export function isLiffLoggedIn(): boolean {
  if (typeof window === "undefined" || !window.liff) return false;
  try {
    return window.liff.isLoggedIn();
  } catch {
    return false;
  }
}

/**
 * Retrieves the parent's LINE profile
 */
export async function getLiffProfile(): Promise<LiffProfile | null> {
  if (typeof window === "undefined" || !window.liff) return null;
  try {
    if (window.liff.isLoggedIn()) {
      const profile = await window.liff.getProfile();
      return {
        userId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
      };
    }
    return null;
  } catch (err) {
    console.error("Failed to get LIFF profile:", err);
    return null;
  }
}

/**
 * Triggers LIFF login if not logged in
 */
export function liffLogin(redirectUri?: string): void {
  if (typeof window !== "undefined" && window.liff) {
    window.liff.login({ redirectUri: redirectUri || window.location.href });
  }
}

/**
 * Closes the LIFF in-app window
 */
export function closeLiffWindow(): void {
  if (typeof window !== "undefined" && window.liff && window.liff.isInClient()) {
    window.liff.closeWindow();
  }
}
