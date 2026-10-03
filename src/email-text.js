/* Works with Superhuman's current shadow DOM and its older iframe renderer. */
(function (root) {
  const BOILERPLATE = /^(?:unsubscribe\b|manage (?:your )?(?:email )?(?:preferences|subscription)\b|view (?:this (?:email|newsletter) )?in (?:your )?browser\b|(?:sign up|subscribe) (?:for|to) (?:this |our |the )?newsletter\b|(?:more|less) like this\b|click to play audio\b|all rights reserved\b|sent (?:to|from)\b)/i;
  const BLOCKS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE']);
  const OMIT = 'script,style,noscript,svg,img,video,audio,button,input,textarea,select,nav,[hidden],[aria-hidden="true"],.gmail_quote,.yahoo_quoted,blockquote[type="cite"],[data-zh-summary],.zh-summary-card';

  function cleanText(text) {
    return String(text || '').replace(/\u00a0/g, ' ').split(/\n/)
      .map(line => line.replace(/[\t\r ]+/g, ' ').trim())
      .filter(line => line && !BOILERPLATE.test(line))
      .join('\n').trim();
  }

  function countWords(text) {
    return (String(text || '').match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || []).length;
  }

  function extractBody(body) {
    const bodyStyle = body.ownerDocument.defaultView?.getComputedStyle(body);
    if (bodyStyle && (bodyStyle.display === 'none' || bodyStyle.visibility === 'hidden' || bodyStyle.opacity === '0')) return '';
    const copy = body.cloneNode(true);
    // Remove hidden preheaders using the original DOM's computed styles.
    const originals = [body, ...body.querySelectorAll('*')];
    const copies = [copy, ...copy.querySelectorAll('*')];
    originals.forEach((element, index) => {
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      const inline = element.style;
      if ((style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) ||
          (inline && (inline.display === 'none' || inline.visibility === 'hidden' || inline.opacity === '0'))) {
        copies[index]?.remove();
      }
    });
    copy.querySelectorAll(OMIT).forEach(element => element.remove());
    // Only explicit ad containers are removed. Editorial discussion of advertising stays.
    copy.querySelectorAll('[data-sponsored],.sponsored,.advertisement,.ad-container').forEach(element => element.remove());
    copy.querySelectorAll('a').forEach(link => {
      if (BOILERPLATE.test(link.textContent.trim())) link.remove();
    });
    let text = '';
    function visit(node) {
      if (node.nodeType === 3) { text += node.textContent; return; }
      const block = BLOCKS.has(node.nodeName);
      if (block || node.nodeName === 'BR') text += '\n';
      node.childNodes.forEach(visit);
      if (block) text += '\n';
    }
    visit(copy);
    return cleanText(text);
  }

  function extractMessage(message) {
    const bodies = [];
    message.querySelectorAll('.SandboxedRender, .Shadowbox').forEach(host => {
      const body = host.shadowRoot?.querySelector('.ShadowBody');
      if (body && !bodies.includes(body)) bodies.push(body);
    });
    if (!bodies.length) {
      message.querySelectorAll('.MessagePane-iframe-wrapper iframe').forEach(frame => {
        try { if (frame.contentDocument?.body) bodies.push(frame.contentDocument.body); } catch (_) { /* Cross-origin email frame. */ }
      });
    }
    return bodies.map(extractBody).filter(Boolean).join('\n\n');
  }

  function extractHTML(html) {
    // Detached parser: never mount newsletter HTML or load its remote resources.
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    return extractBody(body);
  }

  const api = { cleanText, countWords, extractBody, extractMessage, extractHTML };
  root.ZenhumanEmailText = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
