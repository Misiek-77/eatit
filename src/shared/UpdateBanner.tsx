import { useRegisterSW } from 'virtual:pwa-register/react';

/** How often a long-open app looks for a new version, besides every return to the foreground. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Says when a new version of the app has been downloaded and lets the person switch to it.
 *
 * A home screen app runs from its offline copy and on iPhone is rarely closed for real, so a silently
 * installed update could wait for days. The app looks for an update whenever it comes back to the
 * foreground, and once one is ready this bar offers to reload. Reloading is safe mid-workout: everything is
 * already saved on the device, only a running rest countdown starts over.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', check);
      setInterval(check, CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="banner banner-update" role="status">
      <span style={{ flex: 1 }}>Jest nowa wersja aplikacji.</span>
      <button type="button" className="btn btn-small btn-quiet" onClick={() => setNeedRefresh(false)}>
        Później
      </button>
      <button
        type="button"
        className="btn btn-small btn-primary"
        onClick={() => {
          void updateServiceWorker(true);
          // The new version reloads the page once it takes over. A page the old worker never controlled (the
          // first visit after installing) gets no such signal, so it reloads itself shortly after.
          setTimeout(() => window.location.reload(), 1500);
        }}
      >
        Odśwież
      </button>
    </div>
  );
}
