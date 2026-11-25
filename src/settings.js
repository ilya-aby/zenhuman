/* Shared by the popup and content script. Secrets never belong in sync storage. */
const ZH_DEFAULT_SETTINGS = Object.freeze({
  removeRightPanel: true,
  compactHeader: true,
  hideHintTooltips: true,
  simplerInboxZero: true,
  hideAchievementPopups: true,
  fitWideEmails: true,
  fixSubjectOverlap: true,
  fixInvisibleSender: true,
  summarizeEmails: false,
  summaryWordThreshold: 200,
  summarySpeed: 'ultrafast',
  summaryModel: 'gpt-6.2-sol'
});

/* One preference vocabulary for the popup, page cache, and API requests. */
(function (root) {
  const models = Object.freeze({
    'gpt-6-luna': 'GPT-6 Luna',
    'gpt-6.2-sol': 'GPT-6.2 Sol',
    'gpt-6.2-astra': 'GPT-6.2 Astra'
  });
  const speeds = Object.freeze({ normal: 'Normal', fast: 'Fast', ultrafast: 'Ultrafast' });
  const previousModels = { 'gpt-6.1-sol': 'gpt-6.2-sol', 'gpt-6-astra': 'gpt-6.2-astra' };
  // Keep absent speed distinguishable from the new default when reading old settings.
  const storageDefaults = Object.freeze({ ...ZH_DEFAULT_SETTINGS, summarySpeed: null, summaryFastMode: null });
  function supportsUltrafast(model) { return ['gpt-6.2-sol', 'gpt-6.2-astra'].includes(model); }
  function summaryOptions(settings = {}) {
    const selectedModel = previousModels[settings.summaryModel] || settings.summaryModel;
    const summaryModel = Object.hasOwn(models, selectedModel) ? selectedModel : ZH_DEFAULT_SETTINGS.summaryModel;
    // Upgrade the old Fast default to Ultrafast, but preserve an explicit Normal choice.
    let summarySpeed = Object.hasOwn(speeds, settings.summarySpeed) ? settings.summarySpeed
      : settings.summaryFastMode === false ? 'normal' : ZH_DEFAULT_SETTINGS.summarySpeed;
    if (summarySpeed === 'ultrafast' && !supportsUltrafast(summaryModel)) summarySpeed = 'fast';
    return {
      summaryModel,
      summarySpeed
    };
  }
  function summaryKey(settings) { return JSON.stringify(summaryOptions(settings)); }
  const api = { defaults: ZH_DEFAULT_SETTINGS, storageDefaults, models, speeds, supportsUltrafast, summaryOptions, summaryKey };
  root.ZenhumanSettings = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
