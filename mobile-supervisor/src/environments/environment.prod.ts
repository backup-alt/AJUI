export const environment = {
  production: true,
  apiUrl: 'https://agb-o3cc.onrender.com/api',
  appName: 'AGB Supervisor',
  version: '1.0.0',
  qrLoginEndpoint: '/auth/verify-supervisor-invite',
  enableOfflineCache: true,
  cacheTTL: 5 * 60 * 1000,
  fcmSenderId: 'YOUR_FCM_SENDER_ID',
};