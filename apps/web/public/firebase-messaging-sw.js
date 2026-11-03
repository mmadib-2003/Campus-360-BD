// apps/web/public/firebase-messaging-sw.js
self.addEventListener('push', function (event) {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'Campus360 BD Notification';
  const options = {
    body: payload.body || '',
    data: { url: payload.action_url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
