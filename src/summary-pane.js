/* Focused email UI plus bounded prefetch of cached neighbors; never open emails. */
(() => {
  let settings = { ...ZH_DEFAULT_SETTINGS };
  let current = null;
  let timer;
  let route = location.href;
  const summaries = new Map();
  const prefetching = new Set();
  let prefetchTimer;
  let prefetchEpoch = 0;
  let bridgeSequence = 0;
  let canonical = null;
  let reading = null;

  function readCache(mode) {
    const id = String(++bridgeSequence);
    let result = null;
    const receive = event => {
      if (typeof event.detail !== 'string' || event.detail.length > 1100000) return;
      try { const response = JSON.parse(event.detail); if (response.id === id) result = response.result; } catch (_) { /* Ignore page data. */ }
    };
    document.addEventListener('zh:cached-email-response', receive);
    document.dispatchEvent(new CustomEvent('zh:cached-email-request', { detail: JSON.stringify({ id, mode }) }));
    document.removeEventListener('zh:cached-email-response', receive);
    return result;
  }

  function cachedInput(email) {
    if (!email || typeof email.html !== 'string' || email.html.length > 250000 || typeof email.subject !== 'string') return null;
    const text = ZenhumanEmailText.extractHTML(email.html);
    if (!text || text.length > 120000) return null;
    return { subject: email.subject.slice(0, 1000), text };
  }

  function remember(key, summary) {
    summaries.set(key, summary);
    if (summaries.size > 30) summaries.delete(summaries.keys().next().value);
  }

  function stopPrefetch() {
    clearTimeout(prefetchTimer); prefetchTimer = null; prefetchEpoch++;
    if (chrome.runtime?.id) chrome.runtime.sendMessage({ type: 'zh:cancel-prefetch' }).catch(() => {});
  }

  function schedulePrefetch(state) {
    clearTimeout(prefetchTimer);
    const epoch = ++prefetchEpoch;
    prefetchTimer = setTimeout(async () => {
      prefetchTimer = null;
      if (reading !== state || !settings.summarizeEmails || location.href !== state.route) return;
      const snapshot = readCache('neighbors');
      if (!Array.isArray(snapshot?.candidates)) return;
      const threshold = Math.min(10000, Math.max(1, Number(settings.summaryWordThreshold) || 200));
      for (const direction of [1, -1]) {
        if (epoch !== prefetchEpoch || reading !== state || !settings.summarizeEmails) return;
        const candidate = snapshot.candidates.filter(email => email.direction === direction).map(cachedInput)
          .find(email => email && ZenhumanEmailText.countWords(email.text) > threshold);
        if (!candidate) continue;
        const key = JSON.stringify([state.preferencesKey, candidate.subject, candidate.text]);
        if (summaries.has(key) || prefetching.has(key)) continue;
        prefetching.add(key);
        try {
          const response = await chrome.runtime.sendMessage({ type: 'zh:summarize', ...candidate, preferencesKey: state.preferencesKey, prefetch: true });
          if (response?.ok) remember(key, response.summary);
        } catch (_) { /* Speculation never produces UI errors. */ }
        finally { prefetching.delete(key); }
      }
    }, 800);
  }
  const observedRoots = new Map();
  const observer = new MutationObserver(records => {
    if (records.some(record => {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target?.closest('.zh-summary-card')) return false;
      return target?.closest('.ThreadPaneView') || [...record.addedNodes].some(node =>
        node.nodeType === 1 && (node.matches('.ThreadPaneView') || node.querySelector('.ThreadPaneView')));
    })) schedule();
  });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function discard() { if (current || reading) stopPrefetch(); current?.card.remove(); current = null; reading = null; }
  function schedule() {
    if (current && current.route !== location.href) discard();
    // Coalesce updates without waiting for the rest of Superhuman to go quiet.
    if (settings.summarizeEmails && !timer) timer = requestAnimationFrame(() => { timer = null; update(); });
  }

  function discoverBodies(message) {
    for (const [entry, owner] of observedRoots) {
      if (!owner.isConnected || !message.contains(owner)) {
        entry.observer.disconnect(); observedRoots.delete(entry);
      }
    }
    message.querySelectorAll('.SandboxedRender, .Shadowbox, iframe').forEach(host => {
      let body;
      try { body = host.shadowRoot || host.contentDocument?.body; } catch (_) { /* Cross-origin iframe. */ }
      if (!body || [...observedRoots.keys()].some(entry => entry.body === body)) return;
      const bodyObserver = new MutationObserver(schedule);
      bodyObserver.observe(body, { subtree: true, childList: true, characterData: true });
      observedRoots.set({ body, observer: bodyObserver }, host);
    });
  }

  function createCard(words) {
    const card = element('section', 'zh-summary-card is-loading');
    card.setAttribute('aria-label', 'Email summary in plain English');
    card.dataset.zhSummary = '';
    const toggle = element('button', 'zh-summary-toggle');
    toggle.type = 'button'; toggle.setAttribute('aria-expanded', 'true');
    const mark = element('span', 'zh-summary-mark', '✦');
    mark.setAttribute('aria-hidden', 'true');
    const title = element('span', 'zh-summary-title', 'Summarizing...');
    toggle.append(mark, title);
    const meta = element('span', 'zh-summary-meta', `${words.toLocaleString()} words`);
    const chevron = element('span', 'zh-summary-chevron');
    chevron.setAttribute('aria-hidden', 'true'); toggle.append(meta, chevron);
    const body = element('div', 'zh-summary-content');
    body.setAttribute('aria-live', 'polite'); body.setAttribute('aria-busy', 'true');
    body.append(element('span', 'zh-summary-loading-label', 'Generating summary'));
    toggle.addEventListener('click', event => {
      event.stopPropagation(); body.hidden = !body.hidden;
      toggle.setAttribute('aria-expanded', String(!body.hidden));
    });
    toggle.addEventListener('keydown', event => event.stopPropagation());
    const header = element('div', 'zh-summary-header'); header.append(toggle);
    card.append(header, body); return { card, body, title };
  }

  function render(state, summary) {
    const { gist, points, actions } = summary;
    state.body.replaceChildren(element('p', 'zh-summary-gist', gist));
    if (points.length) {
      const list = element('ul', 'zh-summary-points');
      points.forEach(point => {
        const item = element('li');
        item.append(element('strong', 'zh-summary-point-label', `${point.label}: `), document.createTextNode(point.text));
        list.append(item);
      }); state.body.append(list);
    }
    if (actions.length) {
      const section = element('div', 'zh-summary-actions');
      section.append(element('span', 'zh-summary-action-label', 'For you'));
      actions.forEach(action => section.append(element('p', '', action))); state.body.append(section);
    }
    state.body.setAttribute('aria-busy', 'false');
    state.card.classList.remove('is-loading');
    state.title.textContent = 'Summary';
  }

  async function load(state) {
    const cacheKey = JSON.stringify([state.preferencesKey, state.subject, state.text]);
    if (summaries.has(cacheKey)) { render(state, summaries.get(cacheKey)); return; }
    state.body.replaceChildren(element('span', 'zh-summary-loading-label', 'Generating summary'));
    state.card.classList.add('is-loading');
    state.title.textContent = 'Summarizing...';
    state.body.setAttribute('aria-busy', 'true');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'zh:summarize', subject: state.subject, text: state.text, preferencesKey: state.preferencesKey });
      if (!response?.ok) throw new Error(response?.error || 'Could not create a summary. Try again.');
      remember(cacheKey, response.summary);
      if (current !== state || !state.card.isConnected || location.href !== state.route) return;
      render(state, response.summary);
    } catch (error) {
      if (current !== state || !state.card.isConnected || location.href !== state.route) return;
      const invalidated = !chrome.runtime?.id;
      state.body.replaceChildren(element('p', 'zh-summary-status', invalidated ? 'Reload Superhuman to reconnect Zenhuman.' : error.message));
      if (!invalidated) {
        const retry = element('button', 'zh-summary-retry', 'Try again'); retry.type = 'button';
        retry.addEventListener('click', event => { event.stopPropagation(); load(state); });
        retry.addEventListener('keydown', event => event.stopPropagation()); state.body.append(retry);
      }
    } finally {
      state.body.setAttribute('aria-busy', 'false'); state.card.classList.remove('is-loading');
      state.title.textContent = 'Summary';
    }
  }

  function update() {
    if (!settings.summarizeEmails || !/\/thread\/[^/]+/.test(location.pathname)) { discard(); return; }
    const pane = [...document.querySelectorAll('.ThreadPaneView.isVisible')].find(node => node.getClientRects().length);
    const messages = pane ? [...pane.querySelectorAll('.MessagePane-expanded')].filter(node => node.getClientRects().length) : [];
    const message = messages.find(node => node.classList.contains('isFocus')) || messages.at(-1);
    if (!message) { discard(); return; }
    discoverBodies(message);
    const wrapper = message.querySelector('.MessagePane-iframe-wrapper');
    const cached = readCache('current')?.current;
    let input = null;
    if (cached) {
      if (canonical?.html !== cached.html || canonical?.subject !== cached.subject) canonical = { html: cached.html, subject: cached.subject, input: cachedInput(cached) };
      input = canonical.input;
    }
    const text = input?.text || ZenhumanEmailText.extractMessage(message);
    const words = ZenhumanEmailText.countWords(text);
    const threshold = Math.min(10000, Math.max(1, Number(settings.summaryWordThreshold) || 200));
    const subject = input?.subject ?? pane.querySelector('.ThreadPane-subject')?.textContent.trim() ?? '';
    const preferencesKey = ZenhumanSettings.summaryKey(settings);
    if (!wrapper) { discard(); return; }
    if (words <= threshold) {
      if (current) discard();
      if (reading?.message !== message || reading.route !== location.href || reading.preferencesKey !== preferencesKey) {
        reading = { message, preferencesKey, route: location.href }; schedulePrefetch(reading);
      }
      return;
    }
    if (current?.message === message && current.text === text && current.subject === subject && current.preferencesKey === preferencesKey && current.route === location.href && current.card.isConnected) {
      if (reading !== current) { reading = current; schedulePrefetch(reading); }
      return;
    }
    discard();
    const { card, body, title } = createCard(words); wrapper.before(card);
    current = { card, body, title, text, subject, message, preferencesKey, route: location.href }; reading = current; load(current); schedulePrefetch(reading);
  }

  function apply(next) {
    if (settings.summaryWordThreshold !== next.summaryWordThreshold) { stopPrefetch(); reading = null; }
    settings = next;
    if (!settings.summarizeEmails) {
      stopPrefetch(); canonical = null;
      cancelAnimationFrame(timer); timer = null; discard();
      observedRoots.forEach((_, entry) => entry.observer.disconnect()); observedRoots.clear();
    } else schedule();
  }

  function start() {
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('load', schedule, true);
    // History changes and new shadow roots can occur without a document mutation.
    setInterval(() => {
      if (route !== location.href) { route = location.href; discard(); schedule(); }
      if (settings.summarizeEmails && !current) schedule();
    }, 250);
    chrome.storage.sync.get(ZH_DEFAULT_SETTINGS, apply);
  }
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') chrome.storage.sync.get(ZH_DEFAULT_SETTINGS, apply);
    if (namespace === 'local' && changes.openaiApiKey && current) load(current);
  });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
