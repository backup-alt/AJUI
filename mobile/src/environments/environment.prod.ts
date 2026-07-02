/**
 * Production environment for the AGB Supervisor mobile app.
 *
 * - backendUrl points at the Render-hosted Node.js API (the same one
 *   `src/environments/environment.prod.ts` on the web uses).
 * - Set this via the Render dashboard env var BACKEND_PUBLIC_URL when
 *   the mobile CI is built, or by editing this file before producing
 *   a release APK.
 */
export const environment = {
  production: true,
  backendUrl: 'https://agb-o3cc.onrender.com',
  appName: 'AGB(Annai Golden Builders)',
  // Production builds never accept the offline test token.
  testQrToken: '',
  testQrSupervisorName: '',
};