const toggleNames = Object.keys(ZH_DEFAULT_SETTINGS).filter(name => typeof ZH_DEFAULT_SETTINGS[name] === 'boolean');
const status = document.getElementById('apiStatus');
const modelPicker = document.getElementById('summaryModel');
const speedPicker = document.getElementById('summarySpeed');
Object.entries(ZenhumanSettings.models).forEach(([value, label]) => modelPicker.add(new Option(label, value)));
Object.entries(ZenhumanSettings.speeds).forEach(([value, label]) => speedPicker.add(new Option(label, value)));
function showSpeed(options) {
  const ultrafast = speedPicker.querySelector('[value="ultrafast"]');
  ultrafast.disabled = !ZenhumanSettings.supportsUltrafast(options.summaryModel);
  ultrafast.textContent = ultrafast.disabled ? 'Ultrafast (Sol/Astra only)' : 'Ultrafast';
  speedPicker.value = options.summarySpeed;
}
chrome.storage.sync.get(ZenhumanSettings.storageDefaults, settings => {
  settings = { ...settings, ...ZenhumanSettings.summaryOptions(settings) };
  toggleNames.forEach(name => { document.getElementById(name).checked = settings[name]; });
  document.getElementById('summaryWordThreshold').value = settings.summaryWordThreshold;
  modelPicker.value = settings.summaryModel;
  showSpeed(settings);
  document.getElementById('summaryProperties').open = settings.summarizeEmails;
});
toggleNames.forEach(name => {
  const checkbox = document.getElementById(name);
  checkbox.addEventListener('change', () => {
    if (name === 'summarizeEmails') document.getElementById('summaryProperties').open = checkbox.checked;
    chrome.storage.sync.set({ [name]: checkbox.checked });
  });
});
modelPicker.addEventListener('change', () => {
  const options = ZenhumanSettings.summaryOptions({ summaryModel: modelPicker.value, summarySpeed: speedPicker.value });
  showSpeed(options); chrome.storage.sync.set(options);
});
speedPicker.addEventListener('change', () => chrome.storage.sync.set({ summarySpeed: speedPicker.value }));
document.getElementById('summaryWordThreshold').addEventListener('input', event => event.target.setCustomValidity(''));
document.getElementById('summaryWordThreshold').addEventListener('change', async event => {
  const value = Number(event.target.value);
  if (!Number.isInteger(value) || value < 1 || value > 10000) {
    event.target.setCustomValidity('Choose a whole number from 1 to 10,000.'); event.target.reportValidity(); return;
  }
  event.target.setCustomValidity(''); await chrome.storage.sync.set({ summaryWordThreshold: value });
});
async function showConfig() {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'zh:config' });
    status.textContent = result?.ok ? (result.configured ? 'API key ready' : 'Add an API key to enable summaries.') : (result?.error || 'Could not check API settings.');
  } catch (_) { status.textContent = 'Reload the extension to connect summaries.'; }
}
document.getElementById('apiKeyForm').addEventListener('submit', async event => {
  event.preventDefault();
  const field = document.getElementById('openaiApiKey'); const button = document.getElementById('saveApiKey'); button.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'zh:set-key', key: field.value.trim() });
    if (!result?.ok) throw new Error(result?.error || 'Could not save the API key.');
    field.value = ''; await showConfig();
  } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
});
showConfig();
