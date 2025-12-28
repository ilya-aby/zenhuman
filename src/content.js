/**
 * Zenhuman - A cleaner Superhuman experience
 */

const DEFAULT_SETTINGS = {
  removeRightPanel: true,
  compactHeader: true,
  hideHintTooltips: true,
  simplerInboxZero: true
};

function applySettings(settings) {
  const html = document.documentElement;
  html.classList.toggle('zh-hide-right-panel', settings.removeRightPanel);
  html.classList.toggle('zh-compact-header', settings.compactHeader);
  html.classList.toggle('zh-hide-hint-tooltips', settings.hideHintTooltips);
  html.classList.toggle('zh-simpler-inbox-zero', settings.simplerInboxZero);
}

// Load settings and apply
chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);

// React to settings changes in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);
  }
});
