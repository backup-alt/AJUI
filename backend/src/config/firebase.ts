import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { env } from "./env.js";

let initialized = false;

function loadFirebaseCredentials(): admin.ServiceAccount | null {
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
    return {
      projectId: env.FIREBASE_PROJECT_ID,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
    };
  }

  const bundledPath = resolve("firebase-service-account.json");
  const serviceAccountPath = env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? resolve(env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : bundledPath;

  if (!existsSync(serviceAccountPath)) return null;

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as {
      project_id?: string;
      private_key?: string;
      client_email?: string;
    };
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      console.warn("[Firebase] Service-account file is missing required fields");
      return null;
    }
    return {
      projectId: serviceAccount.project_id,
      privateKey: serviceAccount.private_key,
      clientEmail: serviceAccount.client_email,
    };
  } catch (error) {
    console.error("[Firebase] Could not read service-account file:", (error as Error).message);
    return null;
  }
}

export function initFirebase(): void {
  const credentials = loadFirebaseCredentials();
  if (!credentials) {
    console.warn("[Firebase] Credentials not set - push notifications disabled");
    return;
  }

  if (initialized) return;

  try {
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    initialized = true;
    console.log(`[Firebase] Initialized (project: ${credentials.projectId})`);
  } catch (error) {
    console.error("[Firebase] Init failed:", error);
  }
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!initialized) {
    console.log(`[Firebase:Mock] To: ${fcmToken} | Title: ${title}`);
    return false;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "agb_updates",
          sound: "default",
        },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
    });
    return true;
  } catch (error) {
    console.error("[Firebase] Send failed:", error);
    return false;
  }
}

export async function sendMulticast(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!initialized || fcmTokens.length === 0) return 0;

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "agb_updates",
          sound: "default",
        },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
    });
    return response.successCount;
  } catch (error) {
    console.error("[Firebase] Multicast failed:", error);
    return 0;
  }
}

export { admin };
