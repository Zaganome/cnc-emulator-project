#!/usr/bin/env node
// Ejecuta las diez baterías de pruebas y devuelve un código de salida distinto
// de cero si algo falla, para poder usarlo en integración continua.
//
//   npm install        (solo la primera vez: instala jsdom)
//   npm test
//
// Las baterías que no necesitan jsdom se ejecutan igualmente sin él.
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const BATERIAS = [
  ['known-limitations', 'comportamiento aceptado pero imperfecto', false],
  ['lathe-cycles',      'ciclos de torno Fagor',                   false],
  ['mill-cycles',       'ciclos de fresadora',                     false],
  ['advisor',           'asesor CNC (reglas didácticas)',          false],
  ['robustness',        'condiciones límite y copiar/pegar',       false],
  ['calculator',        'calculadora tecnológica',                 true],
  ['ux',                'recorrido guiado y onboarding',           true],
  ['copilot',           'copiloto CNC',                            true],
  ['ai-connect',        'conexión de IA (BYOK)',                   true],
  ['flow',              'flujo de primera ejecución',              true],
  ['assistant',         'asistente flotante',                      true],
];
let hayJsdom = true;
try { require.resolve('jsdom'); } catch(e){ hayJsdom = false; }
if(!hayJsdom) console.log('ℹ  jsdom no está instalado: se omiten las baterías que lo necesitan.\n   Instálalo con:  npm install\n');
let total = 0, fallos = 0, omitidas = 0;
for(const [nombre, desc, necesitaJsdom] of BATERIAS){
  const archivo = path.join(__dirname, nombre + '.test.js');
  if(!fs.existsSync(archivo)){ console.log(`⚠  ${nombre}: archivo no encontrado`); continue; }
  if(necesitaJsdom && !hayJsdom){ console.log(`⏭  ${nombre.padEnd(18)} omitida (necesita jsdom)`); omitidas++; continue; }
  try {
    const salida = execFileSync('node', [archivo], { encoding:'utf-8' });
    const m = /(\d+) pasaron, (\d+) fallaron/.exec(salida);
    const n = m ? parseInt(m[1]) : 0;
    total += n;
    console.log(`✅ ${nombre.padEnd(18)} ${String(n).padStart(3)} pruebas  — ${desc}`);
  } catch(e){
    fallos++;
    console.log(`❌ ${nombre.padEnd(18)} FALLA — ${desc}`);
    console.log((e.stdout||'').split('\n').filter(l=>l.includes('❌')).join('\n'));
  }
}
console.log(`\n${total} pruebas superadas` + (omitidas?`, ${omitidas} baterías omitidas`:'') + (fallos?`, ${fallos} baterías con fallos`:''));
process.exit(fallos > 0 ? 1 : 0);
