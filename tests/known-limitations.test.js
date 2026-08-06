// ============================================================
// tests/known-limitations.test.js
//
// Pruebas de CARACTERIZACIÓN — fijan el comportamiento ACTUAL, verificado,
// no el comportamiento deseado. A diferencia de un comentario en el
// código (que nadie vuelve a comprobar), estas pruebas se ejecutan en
// cada regresión y avisan si algo cambia, para bien o para mal.
//
// IMPORTANTE al leer los resultados: en las pruebas marcadas como
// "LIMITACIÓN CONOCIDA", que esta prueba FALLE (deje de detectar el falso
// positivo esperado) es una BUENA noticia — significa que la limitación
// se ha corregido — no una regresión que perseguir. Si eso ocurre,
// actualiza o borra esta prueba, no la "arregles" para que vuelva a fallar.
//
// Ejecutar con: node tests/known-limitations.test.js
// (asume que cnc-studio-pro.html está en la raíz del repositorio)
// ============================================================
const fs = require('fs');
const path = require('path');

function loadEngine(){
  const htmlPath = path.join(__dirname, '..', 'cnc-studio-pro.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if(!m) throw new Error('No se encontró el bloque <script> en cnc-studio-pro.html');
  const full = m[1];

  // El archivo completo incluye, además del motor de simulación, código de interfaz
  // que depende del navegador (listeners, DOM) y se ejecuta nada más cargarse — no se
  // puede evaluar tal cual en Node. Se extrae solo el bloque de lógica pura (parser +
  // construcción de movimientos), delimitado por dos marcadores estables del propio
  // archivo. Si algún día cambian los nombres de esas funciones, este extractor deja
  // de encontrarlos y lanza un error claro, en vez de fallar en silencio.
  const startMarker = 'function generatePatternPositions';
  const endMarker = '// ============================================================\n// RENDER 2D';
  const start = full.indexOf(startMarker);
  const end = full.indexOf(endMarker);
  if(start<0 || end<0) throw new Error('No se encontraron los marcadores de extracción esperados — revisa si el archivo cambió de estructura.');
  const logicBlock = full.slice(start, end);

  const startMarker2 = 'function inferToolType';
  const endMarker2 = 'function nextFreeToolNum';
  const start2 = full.indexOf(startMarker2);
  const end2 = full.indexOf(endMarker2);
  if(start2<0 || end2<0) throw new Error('No se encontraron los marcadores de extracción (tabla de herramientas) esperados.');
  const toolBlock = full.slice(start2, end2);

  const sandbox = {
    toolTable: {}, mode: 'lathe',
    toolTypeLabel: (t)=>t, renderToolTableUI: ()=>{},
    console,
  };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(toolBlock, sandbox);
  vm.runInContext(logicBlock, sandbox);
  return sandbox;
}

function runSim(engine, code, mode, dialect){
  engine.toolTable = {};
  const statements = dialect==='iso' ? engine.parseISO(code, mode) : engine.parseHeidenhain(code);
  let result = engine.buildMoves(statements, mode, dialect);
  engine.syncToolTable(result.toolsUsed);
  result = engine.buildMoves(statements, mode, dialect);
  return result;
}

let pass = 0, fail = 0;
function check(desc, condition){
  if(condition){ pass++; console.log('✅', desc); }
  else { fail++; console.log('❌', desc); }
}

const engine = loadEngine();

// ------------------------------------------------------------
// LIMITACIÓN CONOCIDA: dos ciclos de refrentado (G82/G85) en zonas de Z
// distintas de la misma pieza, con un rápido de transición entre ambos que
// pasa por la zona ya cortada por el primero. El detector de colisiones usa
// una heurística LOCAL (el rango de Z que cada ciclo conoce de sí mismo) en
// vez de un modelo real de material retirado — así que no sabe que la
// primera zona ya está mecanizada, y avisa de un peligro que en la
// práctica no existe.
//
// Comportamiento esperado HOY: 1 aviso de colisión (falso positivo).
// Comportamiento esperado si en el futuro existe un modelo real de
// material restante: 0 avisos (el simulador sabría que esa zona ya está
// vacía).
// ------------------------------------------------------------
const programaDosZonas = `(STOCK D200 Z-100)
G0 X200 Z20
G85 X78 Z-27 Q10 R0 C1.5 D1 I-45.011 K-21.772
G0 X200 Z10
G0 X50 Z-70
M30`;

const resultado = runSim(engine, programaDosZonas, 'lathe', 'iso');
const avisosColision = resultado.errors.filter(e => e.includes('colisión'));

check(
  'LIMITACIÓN CONOCIDA — dos ciclos de refrentado en zonas distintas: se detecta 1 falso positivo (esperado hoy)',
  avisosColision.length === 1
);

if(avisosColision.length !== 1){
  console.log('   → Si este valor cambió a 0: la limitación probablemente se ha corregido.');
  console.log('     Actualiza esta prueba para reflejar el nuevo comportamiento correcto,');
  console.log('     no la fuerces a volver a fallar.');
  console.log('   → Si cambió a un número mayor que 1: sí es una regresión real, investigar.');
}

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
