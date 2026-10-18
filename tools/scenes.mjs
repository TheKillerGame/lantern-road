// node tools/scenes.mjs [name...] — sets up scenes in the real game and screenshots each one (server on :8382)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const SCENES = {
  dialogue: { race: 'human', wait: 3, js: `app.game.talkTo('hobb'); app.game.dialogue.i = 1;` },
  mill: { race: 'dwarf', wait: 3, js: `const g=app.game; g.p.x=g.map.pois.mill.x-10; g.p.y=g.map.pois.mill.y+40; app.renderer.snapCamera();`, after: 2.2 },
  camp: { race: 'elf', wait: 3, js: `const g=app.game; g.recruit(); g.p.x=g.map.pois.camp.x-90; g.p.y=g.map.pois.camp.y; g.companion.x=g.p.x-10; g.companion.y=g.p.y+8; for(const e of g.enemies) if(e.group==='camp'){e.aggro=true;e.target=g.p;} app.renderer.snapCamera();`, after: 2.5 },
  night: { race: 'halfling', wait: 3, js: `const g=app.game; g.clock=600*(14/24); g.p.x=g.map.pois.barrows.x; g.p.y=g.map.pois.barrows.y+60; app.renderer.snapCamera();`, after: 2.5 },
  village_night: { race: 'human', wait: 3, js: `const g=app.game; g.clock=600*(13.5/24); app.renderer.snapCamera();`, after: 1 },
  boss: { race: 'human', wait: 3, js: `const g=app.game; g.recruit(); g.quests.main.step=4; g.syncGates(); g.p.level=5; g.recompute(); g.p.hp=g.p.maxHp; const a=g.map.pois.arena; g.p.x=a.x; g.p.y=a.y+70; g.companion.x=g.p.x+14; g.companion.y=g.p.y; app.renderer.snapCamera();`, after: 4 },
  boss2: { race: 'elf', wait: 3, js: `const g=app.game; g.recruit(); g.quests.main.step=4; g.syncGates(); g.p.level=6; g.recompute(); g.p.hp=g.p.maxHp; const a=g.map.pois.arena; g.p.x=a.x-40; g.p.y=a.y+60; g.companion.x=g.p.x+14; g.companion.y=g.p.y; app.renderer.snapCamera(); setTimeout(()=>{const b=g.enemies.find(e=>e.def.boss); b.hp=b.maxHp*0.45;}, 3000);`, after: 6 },
  inventory: { race: 'elf', wait: 3, js: `const g=app.game; const {rollItem}=await import('/js/sim/loot.js'); for(const r of ['common','fine','rare','epic','legendary','rare','fine']) g.p.inv.push(rollItem(g.rnd,{rarity:r,ilvl:3})); g.p.statPts=2; app.overlay='inventory'; app.input.mouse.x=207; app.input.mouse.y=49;`, after: 0.6 },
  map: { race: 'human', wait: 3, js: `const g=app.game; for(let i=0;i<g.revealed.length;i++) if(Math.random()<0.5 || (i%g.map.w)<50) g.revealed[i]=1; app.overlay='map';`, after: 0.6 },
  race: { race: null, wait: 3, js: `app.state='race'; app.raceSel=1;`, after: 0.6 },
  shop: { race: 'human', wait: 3, js: `const g=app.game; g.p.gold=200; g.openShop(); app.input.mouse.x=100; app.input.mouse.y=60;`, after: 0.6 },
  troll: { race: 'dwarf', wait: 3, js: `const g=app.game; g.startQuest('troll'); const t=g.map.pois.q_troll; g.p.x=t.x-50; g.p.y=t.y; app.renderer.snapCamera();`, after: 2.5 },
  tusker: { race: 'human', wait: 3, js: `const g=app.game; g.quests.boars={step:2,count:0}; g.startQuest('tusker'); const t=g.map.pois.q_tusker; g.p.x=t.x-60; g.p.y=t.y; app.renderer.snapCamera(); for(const e of g.enemies) if(e.type==='tusker'){e.aggro=true;e.target=g.p;}`, after: 2.5 },
  escort: { race: 'elf', wait: 3, js: `const g=app.game; g.startQuest('nell'); g.talkTo('nell'); while(g.dialogue) g.advanceDialogue(); const n=g.npcs.find(n=>n.id==='nell'); g.p.x=n.x-30; g.p.y=n.y+10; app.renderer.snapCamera();`, after: 2 },
  petals: { race: 'halfling', wait: 3, js: `const g=app.game; g.startQuest('moonpetals'); g.clock=600*(14/24); g.p.x=27*16; g.p.y=36*16; app.renderer.snapCamera();`, after: 2 },
  village_quests: { race: 'human', wait: 3, js: `const g=app.game; g.p.x=20*16; g.p.y=60*16; app.renderer.snapCamera();`, after: 1 },
  journal: { race: 'human', wait: 3, js: `const g=app.game; g.recruit(); for (const q of ['spectacles','stolen','stones','troll']) g.startQuest(q); g.quests.boars={step:2,count:0}; g.quests.spectacles.step=2; app.overlay='quests';`, after: 0.8 },
};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
mkdirSync('shots', { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--remote-debugging-port=9335', '--enable-unsafe-swiftshader', `--user-data-dir=${process.env.TEMP}/lantern-scenes`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let tab; for (let i = 0; i < 40 && !tab; i++) { await sleep(250); try { tab = await (await fetch('http://localhost:9335/json/new?about:blank', { method: 'PUT' })).json(); } catch { } }
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const wait = new Map(); let logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id) wait.get(d.id)?.(d.result ?? d.error); else if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text); else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map(a => a.value ?? a.description).join(' ')); };
  const cmd = (method, params = {}) => new Promise(r => { wait.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1152, height: 648, deviceScaleFactor: 1, mobile: false });
  for (const n of names) {
    const s = SCENES[n]; logs = [];
    await cmd('Page.navigate', { url: 'http://localhost:8382/?test' + (s.race ? '&race=' + s.race : '') });
    await sleep(s.wait * 1000);
    const r = await cmd('Runtime.evaluate', { expression: `(async()=>{${s.js}})()`, awaitPromise: true });
    if (r.exceptionDetails) console.log(n, 'EVAL ERROR', r.exceptionDetails.exception?.description);
    await sleep((s.after ?? 1) * 1000);
    const img = await cmd('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`shots/${n}.png`, Buffer.from(img.data, 'base64'));
    console.log(n, logs.length ? 'ERRORS: ' + logs.join(' | ') : 'ok');
  }
} finally { chrome.kill(); }
process.exit(0);
