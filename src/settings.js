/* Shared by the popup and content script. Secrets never belong in sync storage. */
const ZH_DEFAULT_SETTINGS = Object.freeze({
  removeRightPanel: true,
  compactHeader: true,
  hideHintTooltips: true,
  simplerInboxZero: true,
  hideAchievementPopups: true,
  summarizeEmails: false,
  summaryWordThreshold: 200,
  summaryFastMode: true,
  summaryModel: 'gpt-6.1-sol'
});

/* One preference vocabulary for the popup, page cache, and API requests. */
(function (root) {
  const models = Object.freeze({
    'gpt-6-luna': 'Luna',
    'gpt-6.1-sol': 'Sol 6.1',
    'gpt-6-astra': 'Astra'
  });
  function summaryOptions(settings = {}) {
    return {
      summaryModel: Object.hasOwn(models, settings.summaryModel) ? settings.summaryModel : ZH_DEFAULT_SETTINGS.summaryModel,
      summaryFastMode: typeof settings.summaryFastMode === 'boolean' ? settings.summaryFastMode : ZH_DEFAULT_SETTINGS.summaryFastMode
    };
  }
  function summaryKey(settings) { return JSON.stringify(summaryOptions(settings)); }
  const api = { defaults: ZH_DEFAULT_SETTINGS, models, summaryOptions, summaryKey };
  root.ZenhumanSettings = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
