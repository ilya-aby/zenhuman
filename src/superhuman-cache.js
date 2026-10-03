/* Runs in MAIN world. Read-only adapter for Superhuman's private, cached presenters.
 * No provider requests, navigation actions, credentials, or extension APIs here.
 * Keep this dependency isolated: missing internals simply disable prefetching. */
(() => {
  const REQUEST = 'zh:cached-email-request';
  const RESPONSE = 'zh:cached-email-response';

  function propsAbove(element, predicate) {
    if (!element) return null;
    const key = Object.keys(element).find(name => /^__react(?:InternalInstance|Fiber)\$/.test(name));
    let fiber = element[key];
    for (let depth = 0; fiber && depth < 40; depth++, fiber = fiber.return) {
      if (predicate(fiber.memoizedProps || {})) return fiber.memoizedProps;
    }
    return null;
  }

  function cachedMessage(presenter, messageId) {
    const metadata = presenter?.metadata;
    const message = metadata?.messages?.find(item => item.id === messageId);
    if (!message || message.isEditableDraft?.() || message.isReadOnlyDraft?.() || message.isHiddenMessage?.()) return null;
    const render = presenter.renders?.[messageId];
    // Read existing strings only; never call load/preload/getPresenter APIs.
    const html = render?._raw?.unquotedHtml;
    if (typeof html !== 'string' || !html || html.length > 250000) return null;
    return { threadId: presenter.id, messageId, subject: String(metadata.subject || '').slice(0, 1000), html };
  }

  function snapshot(mode) {
    const pane = [...document.querySelectorAll('.ThreadPaneView.isVisible')].find(node => node.getClientRects().length);
    const messages = pane ? [...pane.querySelectorAll('.MessagePane-expanded')].filter(node => node.getClientRects().length) : [];
    const message = messages.find(node => node.classList.contains('isFocus')) || messages.at(-1);
    const props = propsAbove(message, props => props.account && props.viewState && props.messageId && props.threadId);
    if (!props) return null;
    const account = props.account;
    const presenter = account.threads?.identityMap?.get(props.threadId);
    const current = cachedMessage(presenter, props.messageId);
    if (mode === 'current') return { current };
    const state = props.viewState.threadListState;
    if (!state || props.viewState.getThreadId() !== props.threadId) return null;
    const rank = state.getRank(props.threadId);
    if (!Number.isInteger(rank)) return null;
    const candidates = [];
    let bytes = 0;
    for (const direction of [-1, 1]) {
      // Use the existing archive anchor without calling its consuming getter.
      const anchor = state._autoAdvanceAnchor;
      const anchorId = anchor?.forThreadId === props.threadId
        ? (direction === -1 ? anchor.aboveThreadId : anchor.belowThreadId) : null;
      const anchorRank = anchorId ? state.getRank(anchorId) : undefined;
      const start = Number.isInteger(anchorRank) ? anchorRank : rank + direction;
      for (let offset = 0; offset < 5; offset++) {
        const item = state.getByRank(start + offset * direction);
        if (!item) break;
        if (item.id === props.threadId || item.transition === 'OUT' || state._transitions?.isTransitioningOut(item.id)) continue;
        const neighbor = account.threads.identityMap.get(item.id);
        const eligible = neighbor?.metadata?.messages?.filter(item =>
          !item.isEditableDraft?.() && !item.isReadOnlyDraft?.() && !item.isHiddenMessage?.());
        const cached = cachedMessage(neighbor, eligible?.at(-1)?.id);
        if (!cached || bytes + cached.html.length > 750000) continue;
        bytes += cached.html.length;
        candidates.push({ ...cached, direction });
      }
    }
    return { current, candidates };
  }

  document.addEventListener(REQUEST, event => {
    if (typeof event.detail !== 'string' || event.detail.length > 200) return;
    let request;
    try { request = JSON.parse(event.detail); } catch (_) { return; }
    if (!['current', 'neighbors'].includes(request?.mode) || typeof request.id !== 'string') return;
    let result = null;
    try { result = snapshot(request.mode); } catch (_) { /* App update or cache miss: DOM summary still works. */ }
    document.dispatchEvent(new CustomEvent(RESPONSE, { detail: JSON.stringify({ id: request.id, result }) }));
  });
})();
