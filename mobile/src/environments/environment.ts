/**
 * Development environment.
 *
 * When running `ng serve` locally, the web app talks to the backend on
 * http://localhost:4000. The mobile app, when run in a browser tab, also
 * picks this up. On a real Android device, override backendUrl with the
 * LAN IP of the dev machine (e.g. http://192.168.1.42:4000) before
 * running `npx cap run android`.
 */
export const environment = {
  production: false,
  backendUrl: 'http://localhost:4000',
  appName: 'AGB(Annai Golden Builders)',
  // Used by the QR login flow as the *known* test token before the backend
  // is deployed. Once the real backend is online, remove this and let the
  // mobile app always validate against the verify endpoint.
  testQrToken: 'AGB-SUPERVISOR-2026-OFFLINE-TEST-TOKEN',
  testQrSupervisorName: 'Rajesh Kumar',
};