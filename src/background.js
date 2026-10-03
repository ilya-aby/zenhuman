importScripts('settings.js', 'summary-api.js', 'email-text.js');
// Legacy personal installation fallback, ignored by Git.
try { importScripts('local-config.js'); } catch (_) { /* Configure a key in the popup instead. */ }

const trustedStorageReady = Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
]);
const pending = new Map();
const queue = [];
let activeRequests = 0;
let activePrefetches = 0;
let cacheWrite = Promise.resolve();

function remember(cacheKey, result) {
  // Concurrent completions must share one eviction/write sequence.
  const write = cacheWrite.then(async () => {
    const cache = await chrome.storage.session.get(null);
    const keys = Object.keys(cache).filter(name => name.startsWith('summary:') && name !== cacheKey);
    if (keys.length >= 60) await chrome.storage.session.remove(keys.slice(0, keys.length - 59));
    await chrome.storage.session.set({ [cacheKey]: result });
  });
  cacheWrite = write.catch(() => {});
  return write;
}

function drain() {
  while (activeRequests < 2) {
    let index = queue.findIndex(job => !job.prefetch);
    if (index < 0 && !activePrefetches) index = queue.findIndex(job => job.prefetch);
    if (index < 0) return;
    const job = queue.splice(index, 1)[0];
    job.started = true;
    activeRequests++;
    const speculative = job.prefetch;
    if (speculative) activePrefetches++;
    job.run(job.controller.signal).then(job.resolve, job.reject).finally(() => {
      activeRequests--;
      if (speculative) activePrefetches--;
      pending.delete(job.hash);
      drain();
    });
  }
}

function cancelPrefetch(tabId) {
  for (const job of pending.values()) {
    if (!job.prefetch || (tabId !== undefined && job.tabId !== tabId)) continue;
    // Keep a running neighbor useful for a possible foreground cache hit.
    // Disabling summaries cancels running speculation as well.
    if (job.started) { if (tabId === undefined) job.controller.abort(); continue; }
    const index = queue.indexOf(job);
    if (index >= 0) queue.splice(index, 1);
    pending.delete(job.hash);
    job.reject(new Error('Prefetch cancelled.'));
  }
}

async function getKey() {
  await trustedStorageReady;
  const { openaiApiKey } = await chrome.storage.local.get('openaiApiKey');
  return openaiApiKey || globalThis.ZENHUMAN_LOCAL_CONFIG?.openaiApiKey || '';
}

function isPopup(sender) {
  return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('src/popup.html') && !sender.tab;
}

async function notifyKeyUpdated() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://mail.superhuman.com/*' });
    await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'zh:key-updated' })));
  } catch (_) { /* Saving a key still succeeds if no content script is reachable. */ }
}

async function summarize(message, sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || !sender.url?.startsWith('https://mail.superhuman.com/')) {
    throw new Error('Summaries are only available inside Superhuman.');
  }
  const settings = await chrome.storage.sync.get(ZH_DEFAULT_SETTINGS);
  if (!settings.summarizeEmails) throw new Error('Enable email summaries in Zenhuman settings.');
  const text = message.text;
  if (typeof text !== 'string' || text.length > 120000 || typeof message.subject !== 'string' || message.subject.length > 1000) {
    throw new Error('This email is too large to summarize.');
  }
  const threshold = Math.min(10000, Math.max(1, Number(settings.summaryWordThreshold) || 200));
  if (ZenhumanEmailText.countWords(text) <= threshold) throw new Error('This email is below your summary threshold.');
  const key = await getKey();
  if (!key) throw new Error('Add an OpenAI API key in Zenhuman settings.');
  const preferencesKey = ZenhumanSettings.summaryKey(settings);
  if (message.preferencesKey && message.preferencesKey !== preferencesKey) throw new Error('Summary settings changed. Try again.');
  const input = JSON.stringify([ZenhumanSummaryAPI.PROMPT_VERSION, preferencesKey, message.subject, text]);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  const cacheKey = `summary:${hash}`;
  const cached = await chrome.storage.session.get(cacheKey);
  if (cached[cacheKey]) return cached[cacheKey];
  if (pending.has(hash)) {
    const job = pending.get(hash);
    if (!message.prefetch) { job.prefetch = false; drain(); }
    return job.promise;
  }
  if (message.prefetch && queue.filter(job => job.prefetch).length >= 2) throw new Error('Prefetch queue is full.');
  const job = { hash, tabId: sender.tab.id, prefetch: message.prefetch === true, started: false, controller: new AbortController() };
  job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
  job.run = async signal => {
    try {
      const latest = await chrome.storage.sync.get(ZH_DEFAULT_SETTINGS);
      if (!latest.summarizeEmails || ZenhumanSettings.summaryKey(latest) !== preferencesKey ||
          ZenhumanEmailText.countWords(text) <= Math.min(10000, Math.max(1, Number(latest.summaryWordThreshold) || 200))) {
        throw new Error('Summary settings changed.');
      }
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(ZenhumanSummaryAPI.requestBody(message.subject, text, settings)),
        // Return a retryable error before Chrome's 30s worker fetch limit.
        signal: AbortSignal.any([signal, AbortSignal.timeout(25000)])
      });
      if (!response.ok) throw new Error(ZenhumanSummaryAPI.apiError(response.status));
      const result = ZenhumanSummaryAPI.parseResponse(await response.json());
      await remember(cacheKey, result);
      return result;
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('The summary took too long. Try again.');
      if (error instanceof TypeError) throw new Error('Could not reach OpenAI. Check your connection and try again.');
      throw error;
    }
  };
  pending.set(hash, job);
  queue.push(job);
  drain();
  return job.promise;
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.summarizeEmails?.newValue === false) cancelPrefetch();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !['zh:summarize', 'zh:cancel-prefetch', 'zh:config', 'zh:set-key'].includes(message.type)) return;
  (async () => {
    if (message.type === 'zh:summarize') return { ok: true, summary: await summarize(message, sender) };
    if (message.type === 'zh:cancel-prefetch') {
      if (sender.id !== chrome.runtime.id || !sender.tab || !sender.url?.startsWith('https://mail.superhuman.com/')) throw new Error('Invalid sender.');
      cancelPrefetch(sender.tab.id);
      return { ok: true };
    }
    if (!isPopup(sender)) throw new Error('Open Zenhuman settings to configure the API.');
    if (message.type === 'zh:set-key') {
      await trustedStorageReady;
      if (typeof message.key !== 'string' || !/^sk-[A-Za-z0-9_-]{20,}$/.test(message.key)) throw new Error('Enter a valid OpenAI API key.');
      await chrome.storage.local.set({ openaiApiKey: message.key });
      await notifyKeyUpdated();
    }
    return { ok: true, configured: Boolean(await getKey()) };
  })().then(sendResponse, error => sendResponse({ ok: false, error: error.message || 'Could not create a summary.' }));
  return true;
});
