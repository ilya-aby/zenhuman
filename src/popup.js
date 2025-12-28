const DEFAULT_SETTINGS = { removeRightPanel: true, compactHeader: true, hideHintTooltips: true, simplerInboxZero: true };

const removeRightPanelCheckbox = document.getElementById('removeRightPanel');
const compactHeaderCheckbox = document.getElementById('compactHeader');
const hideHintTooltipsCheckbox = document.getElementById('hideHintTooltips');
const simplerInboxZeroCheckbox = document.getElementById('simplerInboxZero');

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
  removeRightPanelCheckbox.checked = settings.removeRightPanel;
  compactHeaderCheckbox.checked = settings.compactHeader;
  hideHintTooltipsCheckbox.checked = settings.hideHintTooltips;
  simplerInboxZeroCheckbox.checked = settings.simplerInboxZero;
});

removeRightPanelCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ removeRightPanel: removeRightPanelCheckbox.checked });
});

compactHeaderCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ compactHeader: compactHeaderCheckbox.checked });
});

hideHintTooltipsCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ hideHintTooltips: hideHintTooltipsCheckbox.checked });
});

simplerInboxZeroCheckbox.addEventListener('change', () => {
  chrome.storage.sync.set({ simplerInboxZero: simplerInboxZeroCheckbox.checked });
});
