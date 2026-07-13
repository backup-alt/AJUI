export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000/api',
  appName: 'AGB Supervisor',
  version: '1.0.0',
  qrLoginEndpoint: '/auth/verify-supervisor-invite',
  enableOfflineCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  fcmSenderId: 'YOUR_FCM_SENDER_ID',
};