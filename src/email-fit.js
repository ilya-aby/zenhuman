/* Fit oversized newsletter designs without rewriting their tables or images. */
(() => {
  const entries = new Map();
  let frame;
  const enabled = () => document.documentElement.classList.contains('zh-fit-wide-emails');
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = null; update(); });
  }
  const resize = new ResizeObserver(records => {
    for (const record of records) {
      const entry = [...entries.values()].find(entry => entry.body === record.target);
      const width = record.contentRect.width;
      // Scaling changes height; only available-width changes require another fit.
      if (entry && entry.width !== width) { entry.width = width; schedule(); }
    }
  });
  function remove(host, entry) {
    entry.observer.disconnect();
    entry.body.removeEventListener('load', schedule, true);
    resize.unobserve(entry.body); entry.style.remove(); entries.delete(host);
  }
  function update() {
    const hosts = enabled() ? [...document.querySelectorAll(
      '.ThreadPaneView.isVisible .MessagePane-expanded.isMarketing .SandboxedRender, ' +
      '.ThreadPaneView.isVisible .MessagePane-expanded.isMarketing .Shadowbox'
    )] : [];
    for (const [host, entry] of entries) {
      if (!hosts.includes(host) || host.shadowRoot?.querySelector('.ShadowBody') !== entry.body) remove(host, entry);
    }
    for (const host of hosts) {
      const body = host.shadowRoot?.querySelector('.ShadowBody');
      if (!body) continue;
      let entry = entries.get(host);
      if (!entry) {
        const style = document.createElement('style'); style.dataset.zhEmailFit = '';
        host.shadowRoot.append(style);
        const observer = new MutationObserver(schedule);
        observer.observe(body, { subtree: true, childList: true, characterData: true, attributes: true });
        entry = { body, style, observer, width: null }; entries.set(host, entry);
        body.addEventListener('load', schedule, true); resize.observe(body);
      }
      // Measure the original design each time; never compound the previous zoom.
      entry.style.textContent = '';
      const available = body.clientWidth;
      if (!available || !body.querySelector(':scope > .ShadowWrapper')) continue;
      const natural = body.scrollWidth;
      if (natural <= available + 1) continue;
      const scale = available / natural;
      entry.style.textContent = `.ShadowBody > .ShadowWrapper { zoom: ${scale}; }`;
    }
  }
  new MutationObserver(records => {
    if (records.some(record => record.target === document.documentElement ||
        (record.target.nodeType === 1 && record.target.closest('.ThreadPaneView')) ||
        [...record.addedNodes].some(node => node.nodeType === 1 &&
          (node.matches('.ThreadPaneView') || node.querySelector('.ThreadPaneView'))))) schedule();
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  schedule();
})();
