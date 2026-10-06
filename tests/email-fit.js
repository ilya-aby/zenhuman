(async () => {
  const report = document.getElementById('report');
  const checks = [];
  const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const fits = body => body.scrollWidth <= body.clientWidth + 1;
  function check(condition, label) { if (!condition) throw new Error(label); checks.push(label); }
  try {
    await tick();
    check(fits(wideBody), 'An oversized newsletter fits without horizontal scrolling');
    check(getComputedStyle(wideBody.querySelector('table')).fontSize === '16px' &&
      wideBody.querySelectorAll('td').length === 2 && wideBody.querySelector('table').getAttribute('width') === '874',
      'Scaling preserves the original table, columns, and CSS font size');
    check(document.querySelector('.summary').getBoundingClientRect().height === summaryHeight &&
      fittingBody.querySelector('table').getBoundingClientRect().width === 400 && !fits(ordinaryBody),
      'Summaries, fitting newsletters, and ordinary emails retain their original size');
    document.getElementById('wide').style.width = '480px'; await tick(); await tick();
    check(fits(wideBody), 'Resizing the reading pane recomputes the fit');
    wideBody.querySelector('table').setAttribute('width', '1100'); await tick();
    check(fits(wideBody), 'Changed email content is measured again without compounding zoom');
    document.getElementById('wide').style.width = '1200px'; await tick(); await tick();
    check(wideBody.querySelector('table').getBoundingClientRect().width === 1100,
      'Widening the pane restores the original size rather than enlarging the email');
    document.getElementById('wide').style.width = '636px'; await tick(); await tick();
    document.documentElement.classList.remove('zh-fit-wide-emails'); await tick();
    check(!fits(wideBody) && !wideBody.getRootNode().querySelector('[data-zh-email-fit]'),
      'Disabling the setting removes the workaround and restores the original rendering');
    document.documentElement.classList.add('zh-fit-wide-emails'); await tick();
    check(fits(wideBody), 'Re-enabling the setting fits the same email again');
    report.textContent = `PASS: ${checks.length} newsletter fit checks\n` + checks.map(label => `✓ ${label}`).join('\n');
    report.dataset.result = 'pass';
  } catch (error) {
    report.textContent = `FAIL: ${error.message}\n` + checks.join('\n'); report.dataset.result = 'fail';
  }
})();
