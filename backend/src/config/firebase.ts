import admin from "firebase-admin";
import { env } from "./env.js";

let initialized = false;

export function initFirebase(): void {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL) {
    console.warn("[Firebase] Credentials not set - push notifications disabled");
    return;
  }

  if (initialized) return;

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    initialized = true;
    console.log(`[Firebase] Initialized (project: ${env.FIREBASE_PROJECT_ID})`);
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
    });
    return response.successCount;
  } catch (error) {
    console.error("[Firebase] Multicast failed:", error);
    return 0;
  }
}

export { admin };
