const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const pkg = require(packageJsonPath);

// 1. Increment Version
const versionParts = pkg.version.split('.').map(Number);
versionParts[2] += 1; // Increment patch
const newVersion = versionParts.join('.');
pkg.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`[Build] Versão incrementada para: ${newVersion}`);

// 2. Build Frontend
console.log('[Build] Compilando Frontend (Vite)...');
try {
    execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {
    console.error('[Build] Erro na compilação do frontend.');
    process.exit(1);
}

// 3. Build Electron (Dist)
console.log('[Build] Gerando Executável (Electron Builder)...');
try {
    execSync('npm run dist', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (e) {
    console.error('[Build] Erro na geração do executável.');
    process.exit(1);
}

console.log('[Build] Processo finalizado com sucesso!');
