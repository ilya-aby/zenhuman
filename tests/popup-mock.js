/* Preview the production popup with isolated preferences. Never touches Chrome storage. */
const popupPreferences = JSON.parse(localStorage.getItem('zh-fixture-preferences') || '{}');
window.chrome = {
  storage: { sync: {
    get(defaults, callback) { callback({ ...defaults, ...popupPreferences }); },
    async set(update) {
      Object.assign(popupPreferences, update);
      localStorage.setItem('zh-fixture-preferences', JSON.stringify(popupPreferences));
    }
  } },
  runtime: { async sendMessage() { return { ok: true, configured: true }; } }
};
