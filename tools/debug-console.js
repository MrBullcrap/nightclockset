#!/usr/bin/env node
// Terminal dashboard for the hidden NightClockDebug console baked into
// www/index.html. Connects to the running app over the same Chrome DevTools
// Protocol used by `chrome://inspect`, via `adb forward` to the WebView's
// devtools socket - no on-device UI is involved, and nothing here is
// reachable except from a terminal with adb access to the device.
//
// Usage:
//   node tools/debug-console.js [package-id]
//
// Commands (type "help" any time to see this again):
//   night / day / clearnight
//   moon 0.5 / moonphase full / clearmoon
//   lux 200 / clearlux
//   cycledaynight 5 / cyclemoon 2 0.05 / cyclelux 4
//   sundown 20
//   stop / status / help
//   exit          - restores your real settings and quits
// Ctrl+C also restores your real settings before quitting.

const { execFile } = require('child_process');
const http = require('http');
const readline = require('readline');
const WebSocket = require('ws');

const PACKAGE_ID = process.argv[2] || 'com.nightclockset.app';

// ---- tiny ANSI helpers (no dependency needed for this) --------------------
const ANSI = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
    magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m'
};
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function paint(color, text) { return `${ANSI[color]}${text}${ANSI.reset}`; }
function visibleLength(s) { return s.replace(ANSI_RE, '').length; }
function padRight(s, width) { return s + ' '.repeat(Math.max(0, width - visibleLength(s))); }

// ---- adb / devtools plumbing -----------------------------------------------
function run(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
        });
    });
}

async function findPid() {
    const out = await run('adb', ['shell', 'pidof', PACKAGE_ID]);
    const pid = out.split(/\s+/)[0];
    if (!pid) throw new Error(`No running process found for ${PACKAGE_ID}. Is the app open on the device?`);
    return pid;
}

function forwardPort(pid) {
    return run('adb', ['forward', 'tcp:0', `localabstract:webview_devtools_remote_${pid}`])
        .then((out) => parseInt(out, 10));
}

function fetchJson(port) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/json`, (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

// Friendly command name -> NightClockDebug method name.
const ALIASES = {
    night: 'night', day: 'day', clearnight: 'clearNight',
    moon: 'moon', moonphase: 'moonPhase', clearmoon: 'clearMoon',
    lux: 'lux', clearlux: 'clearLux',
    cycledaynight: 'cycleDayNight', cyclemoon: 'cycleMoon', cyclelux: 'cycleLux',
    sundown: 'simulateSundown', stop: 'stopCycle',
    status: 'status', help: 'help'
};

// What each command means for the "Cycling" row - stop/exit clear it.
const CYCLE_DESCRIPTIONS = {
    cycledaynight: (a) => `day/night, every ${a[0] || 5}s`,
    cyclemoon: (a) => `moon phase, every ${a[0] || 2}s (step ${a[1] || 0.05})`,
    cyclelux: (a) => `lux sweep, every ${a[0] || 4}s`,
    sundown: (a) => `simulated sundown over ${a[0] || 20}s`
};

function buildCallExpression(method, args) {
    const argList = args
        .map((a) => (a === '' ? undefined : a))
        .filter((a) => a !== undefined)
        .map((a) => (isNaN(Number(a)) ? JSON.stringify(a) : Number(a)))
        .join(', ');
    return `NightClockDebug.${method}(${argList})`;
}

// ---- dashboard rendering ---------------------------------------------------
const BOX_WIDTH = 58;

function boxTop() { return ANSI.bold + '╔' + '═'.repeat(BOX_WIDTH) + '╗' + ANSI.reset; }
function boxMid() { return ANSI.bold + '╠' + '═'.repeat(BOX_WIDTH) + '╣' + ANSI.reset; }
function boxBottom() { return ANSI.bold + '╚' + '═'.repeat(BOX_WIDTH) + '╝' + ANSI.reset; }
function boxTitle(text) {
    const pad = Math.max(0, Math.floor((BOX_WIDTH - text.length) / 2));
    const line = ' '.repeat(pad) + text;
    return ANSI.bold + '║' + padRight(line, BOX_WIDTH) + '║' + ANSI.reset;
}
function boxRow(label, value) {
    const content = ' ' + label.padEnd(10) + value;
    return ANSI.bold + '║' + ANSI.reset + padRight(content, BOX_WIDTH) + ANSI.bold + '║' + ANSI.reset;
}

function moonPhaseInfo(fraction) {
    if (fraction === null || fraction === undefined) return { emoji: '?', name: 'unknown' };
    const f = Math.max(0, Math.min(1, fraction));
    const stops = [
        [0.02, '🌑', 'New Moon'], [0.25, '🌒', 'Waxing Crescent'], [0.52, '🌓', 'Quarter'],
        [0.75, '🌔', 'Waxing Gibbous'], [0.98, '🌕', 'Full Moon'], [1, '🌖', 'Gibbous']
    ];
    for (const [max, emoji, name] of stops) if (f <= max) return { emoji, name };
    return { emoji: '🌕', name: 'Full Moon' };
}

function luxDescription(lux) {
    if (lux < 5) return 'pitch dark';
    if (lux < 50) return 'dim';
    if (lux < 500) return 'indoor';
    if (lux < 2000) return 'bright indoor';
    return 'daylight';
}

function renderDashboard(status, cyclingDescription) {
    const lines = [boxTop(), boxTitle('NightClockSet — Debug Console'), boxMid()];

    if (!status) {
        lines.push(boxRow('Status', paint('gray', 'connecting...')));
        lines.push(boxBottom());
        return lines.join('\n');
    }

    const nightVal = status.nightOverride === null
        ? paint('gray', (status.effectiveNight ? 'NIGHT' : 'DAY') + ' (real sun time)')
        : paint(status.nightOverride ? 'cyan' : 'yellow', (status.nightOverride ? 'NIGHT' : 'DAY') + ' (forced)');
    lines.push(boxRow('Mode', nightVal));

    const mp = moonPhaseInfo(status.effectiveMoonFraction);
    const moonSource = status.moonFractionOverride !== null ? paint('magenta', 'forced') : paint('gray', 'real');
    const moonFractionText = status.effectiveMoonFraction === null ? '' : `(${status.effectiveMoonFraction.toFixed(2)}) `;
    lines.push(boxRow('Moon', `${mp.emoji} ${mp.name} ${paint('dim', moonFractionText)}${moonSource}`));

    const luxVal = status.effectiveLux === null || status.effectiveLux === undefined
        ? paint('gray', 'no reading yet')
        : `${Math.round(status.effectiveLux)} lux, ${luxDescription(status.effectiveLux)} ` +
          (status.luxOverride !== null ? paint('magenta', '(forced)') : paint('gray', '(real)'));
    lines.push(boxRow('Lux', luxVal));

    lines.push(boxRow('Cycling', cyclingDescription ? paint('magenta', cyclingDescription) : paint('gray', 'none')));
    lines.push(boxRow('Session', status.active
        ? paint('green', 'active - your real settings are safe')
        : paint('gray', 'inactive - nothing overridden')));

    lines.push(boxBottom());
    return lines.join('\n');
}

async function main() {
    process.stdout.write(`Looking for ${PACKAGE_ID} on the connected device...\n`);
    const pid = await findPid();
    const port = await forwardPort(pid);
    const targets = await fetchJson(port);
    const page = targets.find((t) => t.type === 'page') || targets[0];
    if (!page) throw new Error('No debuggable page found - is the WebView running?');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();

    const LOG_MAX = 10;
    const logLines = [];
    let lastStatus = null;
    let cyclingDescription = null;

    function log(text, color) {
        const time = new Date().toTimeString().slice(0, 8);
        logLines.push(paint('gray', `[${time}] `) + (color ? paint(color, text) : text));
        if (logLines.length > LOG_MAX) logLines.shift();
    }

    function redraw() {
        if (process.stdout.isTTY) console.clear();
        process.stdout.write(renderDashboard(lastStatus, cyclingDescription) + '\n\n');
        if (logLines.length) {
            process.stdout.write(ANSI.bold + 'Recent activity:' + ANSI.reset + '\n');
            process.stdout.write(logLines.join('\n') + '\n\n');
        }
        rl.prompt(true);
    }

    ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        } else if (msg.method === 'Runtime.consoleAPICalled') {
            const text = (msg.params.args || [])
                .map((a) => (a.value !== undefined ? a.value : a.description || a.type))
                .map((v) => (typeof v === 'object' ? JSON.stringify(v) : v))
                .join(' ');
            if (!text.startsWith('[NightClockDebug] {')) log(text.replace('[NightClockDebug] ', ''));
        }
    });

    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = msgId++;
            pending.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async function evalJs(expr) {
        const result = await send('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise: false
        });
        if (result.result && result.result.exceptionDetails) {
            log('Error: ' + (result.result.exceptionDetails.exception.description || result.result.exceptionDetails.text), 'red');
            return undefined;
        }
        return result.result && result.result.result ? result.result.result.value : undefined;
    }

    async function refreshStatus() {
        lastStatus = await evalJs('NightClockDebug.status()');
    }

    let restored = false;
    async function restoreAndExit(code) {
        if (restored) { process.exit(code); return; }
        restored = true;
        try { await evalJs('NightClockDebug.exit()'); } catch (e) { /* device may be gone */ }
        setTimeout(() => process.exit(code), 100);
    }

    await new Promise((resolve) => ws.on('open', resolve));
    await send('Runtime.enable');
    await send('Runtime.discardConsoleEntries'); // drop any buffered console history from before this session
    await refreshStatus();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'nightclock> ' });
    redraw();

    // readline's 'close' fires as soon as stdin hits EOF, which - with piped
    // input - can happen well before an async command handler for an earlier
    // line has finished. Chaining every line onto one promise queue keeps
    // commands (and the final restore-on-exit) strictly in order.
    let queue = Promise.resolve();
    let exiting = false;

    async function handleLine(line) {
        const [cmdRaw, ...args] = line.trim().split(/\s+/);
        const cmd = (cmdRaw || '').toLowerCase();
        if (!cmd) return;
        if (cmd === 'exit' || cmd === 'quit') { exiting = true; cyclingDescription = null; return; }
        if (cmd === 'help') { log('day/night/clearnight, moon <f>/moonphase <name>/clearmoon, lux <v>/clearlux, cycledaynight/cyclemoon/cyclelux <s>, sundown <s>, stop, status, exit'); return; }
        const method = ALIASES[cmd];
        if (!method) { log(`Unknown command "${cmd}". Type "help" for the list.`, 'red'); return; }
        if (cmd === 'stop') cyclingDescription = null;
        else if (CYCLE_DESCRIPTIONS[cmd]) cyclingDescription = CYCLE_DESCRIPTIONS[cmd](args);
        await evalJs(buildCallExpression(method, args));
        await refreshStatus();
    }

    rl.on('line', (line) => {
        queue = queue.then(() => handleLine(line)).then(() => {
            redraw();
            if (exiting) rl.close();
        });
    });

    rl.on('close', () => { queue.then(() => restoreAndExit(0)); });
    process.on('SIGINT', () => { rl.close(); });
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
