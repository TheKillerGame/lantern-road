// node tools/autoplay.mjs <race> [speed] — the autopilot plays the real client in headless Chrome; screenshots every 20 s
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const race = process.argv[2] ?? 'human', speed = process.argv[3] ?? '6';
mkdirSync('shots/auto', { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9336', '--enable-unsafe-swiftshader', `--user-data-dir=${process.env.TEMP}/lantern-auto`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let tab; for (let i = 0; i < 40 && !tab; i++) { await sleep(250); try { tab = await (await fetch('http://localhost:9336/json/new?about:blank', { method: 'PUT' })).json(); } catch { } }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = new Map(), logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) wait.get(d.id)?.(d.result ?? d.error); else if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map(a => a.value ?? a.description).join(' ')); };
  const cmd = (method, params = {}) => new Promise(r => { wait.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1152, height: 648, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: `http://localhost:8382/?test&race=${race}&autoplay=${speed}${process.env.HUMAN ? '&human=1' : ''}` });
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < 600000) {
    await sleep(+(process.env.EVERY ?? 20000));
    const r = await cmd('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({phase: app.auto.phaseName, done: app.auto.done, problems: app.auto.problems, lv: app.game.p.level, hp: Math.round(app.game.p.hp), deaths: app.game.stats.deaths, err: app.error ?? null, fps: 0})` });
    console.log(Math.round((Date.now() - t0) / 1000) + 's', r.result?.value);
    const img = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`shots/auto/${race}_${String(n++).padStart(2, '0')}.png`, Buffer.from(img.data, 'base64'));
    if (JSON.parse(r.result.value).done) break;
  }
  console.log(logs.length ? 'PAGE ERRORS:\n' + [...new Set(logs)].join('\n') : 'no page errors');
} finally { chrome.kill(); }
process.exit(0);
