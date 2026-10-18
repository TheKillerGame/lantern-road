// node tools/shot.mjs <query> <out.png> <seconds> [w] [h] — real-time headless Chrome capture (server on :8382)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [query = '', out = 'shot.png', secs = '5', w = '1280', h = '720'] = process.argv.slice(2);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9334', ...(process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader']),
  '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${process.env.TEMP}/lantern-shot-prof`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let tab;
  for (let i = 0; i < 40 && !tab; i++) { await sleep(250); try { tab = await (await fetch('http://localhost:9334/json/new?about:blank', { method: 'PUT' })).json(); } catch { } }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const wait = new Map(), logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) wait.get(d.id)?.(d.result ?? d.error); else if (d.method === 'Inspector.targetCrashed') { console.log('TAB CRASHED'); logs.push('TAB CRASHED'); } else if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map(a => a.value ?? a.description).join(' ')); };
  const cmd = (method, params = {}) => new Promise(r => { wait.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
  await cmd('Page.navigate', { url: 'http://localhost:8382/' + query });
  await sleep(+secs * 1000);
  if (process.env.EVAL) { const r = await cmd('Runtime.evaluate', { expression: process.env.EVAL, awaitPromise: true }); if (r.exceptionDetails) console.log('EVAL ERROR', r.exceptionDetails.exception?.description); else if (r.result?.value !== undefined) console.log('EVAL', r.result.value); await sleep(1500); }
  if (logs.length) console.log('ERRORS:', logs);
  else console.log('no page errors');
  const img = await cmd('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(img.data, 'base64'));
} finally { chrome.kill(); }
process.exit(0);
