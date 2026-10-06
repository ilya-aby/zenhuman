// Serves only the test fixture and public extension files. Never serves credentials.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const files = new Map([
  ['/', ['../tests/browser.html', 'text/html']],
  ['/inbox/thread/fixture', ['../tests/browser.html', 'text/html']],
  ['/tests/browser.js', ['../tests/browser.js', 'text/javascript']],
  ['/tests/popup-mock.js', ['../tests/popup-mock.js', 'text/javascript']],
  ['/tests/background.html', ['../tests/background.html', 'text/html']],
  ['/tests/background.js', ['../tests/background.js', 'text/javascript']],
  ['/tests/prefetch.html', ['../tests/prefetch.html', 'text/html']],
  ['/tests/prefetch.js', ['../tests/prefetch.js', 'text/javascript']],
  ['/tests/email-fit.html', ['../tests/email-fit.html', 'text/html']],
  ['/tests/email-fit.js', ['../tests/email-fit.js', 'text/javascript']],
  ['/popup', ['../src/popup.html', 'text/html']],
  ['/assets/icon-zenhuman.png', ['../assets/icon-zenhuman.png', 'image/png']],
  ...['settings.js', 'email-text.js', 'content.js', 'summary-pane.js', 'summary-api.js', 'background.js', 'popup.js', 'superhuman-cache.js', 'email-fit.js'].map(name => [`/src/${name}`, [`../src/${name}`, 'text/javascript']]),
  ['/src/styles.css', ['../src/styles.css', 'text/css']]
]);
createServer((request, response) => {
  const file = files.get(request.url);
  if (!file) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
  let content = readFileSync(new URL(file[0], import.meta.url));
  if (request.url === '/popup') content = content.toString().replace('<script src="settings.js">', '<script src="/tests/popup-mock.js"></script><script src="/src/settings.js">').replace('src="popup.js"', 'src="/src/popup.js"');
  response.end(content);
}).listen(8769, '127.0.0.1', () => console.log('DOM regression fixture: http://127.0.0.1:8769/'));
