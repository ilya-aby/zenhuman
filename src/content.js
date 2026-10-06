/**
 * Zenhuman - A cleaner Superhuman experience
 */

function applySettings(settings) {
  const html = document.documentElement;
  html.classList.toggle('zh-hide-right-panel', settings.removeRightPanel);
  html.classList.toggle('zh-compact-header', settings.compactHeader);
  html.classList.toggle('zh-hide-hint-tooltips', settings.hideHintTooltips);
  html.classList.toggle('zh-simpler-inbox-zero', settings.simplerInboxZero);
  html.classList.toggle('zh-hide-achievement-popups', settings.hideAchievementPopups);
  html.classList.toggle('zh-summarize-emails', settings.summarizeEmails);
  html.classList.toggle('zh-fit-wide-emails', settings.fitWideEmails);
  html.classList.toggle('zh-fix-subject-overlap', settings.fixSubjectOverlap);
}

// Load settings and apply
chrome.storage.sync.get(ZH_DEFAULT_SETTINGS, applySettings);

// React to settings changes in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    chrome.storage.sync.get(ZH_DEFAULT_SETTINGS, applySettings);
  }
});
