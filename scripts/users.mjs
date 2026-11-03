// Správa správců webu (max. 5). Hesla se ukládají jako PBKDF2 hash do users.json (není v gitu).
//   npm run users add <jmeno>      – přidá správce
//   npm run users passwd <jmeno>   – změní heslo
//   npm run users remove <jmeno>   – odebere správce
//   npm run users list             – vypíše správce
//   npm run users push             – nahraje správce do Cloudflare (secret USERS)
// Po každé změně se aktualizuje i .dev.vars pro lokální vývoj (npm run dev).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const USERS_FILE = new URL('../users.json', import.meta.url);
const DEV_VARS = new URL('../.dev.vars', import.meta.url);
const MAX_USERS = 5;
const MIN_PASSWORD_LENGTH = 10;
const ITERATIONS = 100_000; // maximum supported by PBKDF2 in Cloudflare Workers

const fail = (msg) => { console.error(msg); process.exit(1); };
const load = () => (existsSync(USERS_FILE) ? JSON.parse(readFileSync(USERS_FILE, 'utf8')) : {});

// Same format as verified in worker/auth.ts: pbkdf2_sha256:<iterations>:<salt b64url>:<hash b64url>
function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
    return `pbkdf2_sha256:${ITERATIONS}:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

function save(users) {
    writeFileSync(USERS_FILE, JSON.stringify(users, null, 2) + '\n', { mode: 0o600 });
    const vars = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, 'utf8') : '';
    const secret = vars.match(/^SESSION_SECRET=(.*)$/m)?.[1] ?? `"${randomBytes(32).toString('hex')}"`;
    writeFileSync(DEV_VARS, `SESSION_SECRET=${secret}\nUSERS='${JSON.stringify(users)}'\n`, { mode: 0o600 });
}

function promptHidden(rl, label) {
    return new Promise((resolve) => {
        const write = rl._writeToOutput;
        rl._writeToOutput = (s) => { if (s.includes(label)) write.call(rl, s); };
        rl.question(label, (answer) => {
            rl._writeToOutput = write;
            process.stdout.write('\n');
            resolve(answer);
        });
    });
}

async function askPassword() {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    const lines = process.stdin.isTTY ? null : rl[Symbol.asyncIterator]();
    const ask = async (label) => (lines ? (await lines.next()).value ?? '' : promptHidden(rl, label));
    const p1 = await ask('Heslo: ');
    const p2 = await ask('Heslo znovu: ');
    rl.close();
    if ([...p1].length < MIN_PASSWORD_LENGTH) fail(`Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`);
    if (p1 !== p2) fail('Hesla se neshodují.');
    return hashPassword(p1);
}

const [cmd, name] = process.argv.slice(2);
const users = load();

if (cmd === 'list') {
    console.log(Object.keys(users).join('\n') || '(žádní správci)');
} else if (cmd === 'push') {
    if (!Object.keys(users).length) fail('Nejprve přidejte správce: npm run users add <jmeno>');
    // shell: true is needed on Windows, where npx is a .cmd script.
    const r = spawnSync('npx wrangler secret put USERS', { shell: true, input: JSON.stringify(users), stdio: ['pipe', 'inherit', 'inherit'] });
    process.exit(r.status ?? 1);
} else if (['add', 'passwd', 'remove'].includes(cmd) && name) {
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) fail('Jméno smí obsahovat jen písmena bez diakritiky, čísla a . _ - (3–32 znaků).');
    if (cmd === 'add' && users[name]) fail(`Správce '${name}' už existuje.`);
    if (cmd === 'add' && Object.keys(users).length >= MAX_USERS) fail(`Lze mít nejvýše ${MAX_USERS} správců.`);
    if (cmd !== 'add' && !users[name]) fail(`Správce '${name}' neexistuje.`);
    if (cmd === 'remove') delete users[name];
    else users[name] = await askPassword();
    save(users);
    console.log(`Hotovo (${cmd} ${name}). Lokálně platí po restartu npm run dev, na Cloudflare nahrajte: npm run users push`);
} else {
    fail('Použití: npm run users add|passwd|remove <jmeno> | list | push');
}
