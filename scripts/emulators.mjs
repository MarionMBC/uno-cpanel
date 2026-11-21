// Requiere el CLI `firebase` (npm i -g firebase-tools).
// Proyecto `demo-uno-panel`: el prefijo demo- impide tocar cualquier proyecto real.
// Arranca los emuladores locales (Auth + Firestore + UI) con firebase.emulator.json.
// firebase-tools 15 exige Java 21+: si JAVA_HOME no apunta a uno, busca un JDK 21 instalado.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const env = { ...process.env };
const roots = ['C:/Program Files/Microsoft', 'C:/Program Files/Eclipse Adoptium', 'C:/Program Files/Java'];
const jdk = roots.filter(existsSync)
  .flatMap(r => readdirSync(r).filter(d => /^jdk-?(2[1-9]|[3-9]\d)/.test(d)).map(d => path.join(r, d)))
  .sort().pop();
if (jdk) {
  env.JAVA_HOME = jdk;
  env.PATH = `${path.join(jdk, 'bin')}${path.delimiter}${env.PATH}`;
}

const child = spawn('firebase', ['emulators:start', '--config', 'firebase.emulator.json', '--project', 'demo-uno-panel'], {
  env, stdio: 'inherit', shell: true,
});
child.on('exit', code => process.exit(code ?? 1));
