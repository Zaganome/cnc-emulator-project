// ============================================================
// tests/mill-cycles.test.js
//
// Verificación POSITIVA de fresadora — ciclos Fagor ISO y el asistente de
// programación en modo fresadora. Mismo patrón que lathe-cycles.test.js:
// comprueba comportamiento real, no solo que "no haya error".
//
// Ejecutar con: node tests/mill-cycles.test.js
// ============================================================
const fs = require('fs');
const path = require('path');

function loadEngine(){
  const htmlPath = path.join(__dirname, '..', 'cnc-studio-pro.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if(!m) throw new Error('No se encontró el bloque <script> en cnc-studio-pro.html');
  const full = m[1];
  const startMarker = 'function generatePatternPositions';
  const endMarker = '// ============================================================\n// RENDER 2D';
  const start = full.indexOf(startMarker);
  const end = full.indexOf(endMarker);
  if(start<0 || end<0) throw new Error('No se encontraron los marcadores de extracción esperados — revisa si el archivo cambió de estructura.');
  const logicBlock = full.slice(start, end);
  const startMarker2 = 'const TOOL_TYPES';
  const endMarker2 = 'function nextFreeToolNum';
  const start2 = full.indexOf(startMarker2);
  const end2 = full.indexOf(endMarker2);
  if(start2<0 || end2<0) throw new Error('No se encontraron los marcadores de extracción (tabla de herramientas) esperados.');
  const toolBlock = full.slice(start2, end2);
  const startMarker3 = 'const CYCLE_HELP';
  const endMarker3 = 'let assistantMode';
  const start3 = full.indexOf(startMarker3);
  const end3 = full.indexOf(endMarker3);
  if(start3<0 || end3<0) throw new Error('No se encontraron los marcadores de extracción (asistente/alarmas) esperados.');
  const alarmBlock = full.slice(start3, end3);
  const sandbox = { toolTable: {}, mode: 'mill', renderToolTableUI: ()=>{}, runSimulation: ()=>{}, console };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(toolBlock, sandbox);
  vm.runInContext(logicBlock, sandbox);
  vm.runInContext(alarmBlock, sandbox);
  return sandbox;
}

let pass = 0, fail = 0;
function check(desc, condition){
  if(condition){ pass++; console.log('✅', desc); }
  else { fail++; console.log('❌', desc); }
}

const engine = loadEngine();

// ------------------------------------------------------------
// Alarma de tipo de herramienta en cajeras/ranuras/islas (251-257, 230,
// 232) — encontrado en auditoría: estos ciclos se despachan a funciones
// propias que nunca llamaban a la comprobación, pese a tener tipos
// válidos ya definidos en CYCLE_VALID_TYPES desde antes. Corregido
// centralizando la llamada en el punto de despacho común.
// ------------------------------------------------------------
{
  engine.toolTable = {1:{diameter:10,type:'macho',length:100,radius:0}};
  const stmts = engine.parseISO('T1\nG0 Z10\nG87 I-5 J15 K10 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  check('Cajera rectangular (G87) — herramienta macho equivocada: SÍ avisa (antes no avisaba nunca)',
    r.errors.some(e=>e.includes('está definida como')));
  check('Cajera rectangular (G87) — el aviso no se duplica pese a haber dos puntos de llamada posibles',
    r.errors.filter(e=>e.includes('está definida como')).length === 1);
}
{
  engine.toolTable = {1:{diameter:10,type:'fresa',length:100,radius:0}};
  const stmts = engine.parseISO('T1\nG0 Z10\nG87 I-5 J15 K10 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  check('Cajera rectangular (G87) — herramienta fresa correcta: sin aviso',
    r.errors.filter(e=>e.includes('está definida como')).length === 0);
}
{
  engine.toolTable = {2:{diameter:8,type:'broca',length:100,radius:0}};
  const stmts = engine.parseISO('T2\nG0 Z10\nG81 Z-10 R2 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  check('Taladrado simple (G81) sigue funcionando igual tras el cambio — sin aviso con broca',
    r.errors.filter(e=>e.includes('está definida como')).length === 0);
}

// ------------------------------------------------------------
// Mismo hueco, pero de longitud de herramienta en vez de tipo — las
// cajeras/ranuras/islas tampoco comprobaban nunca si la herramienta
// llegaba a la profundidad pedida. Encontrado revisando el arreglo
// anterior, no por casualidad: mismo patrón, mismo punto de despacho.
// ------------------------------------------------------------
{
  engine.toolTable = {1:{diameter:10,type:'fresa',length:20,radius:0}};
  const stmts = engine.parseISO('T1\nG0 Z10\nG87 I-60 J15 K10 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  check('Cajera rectangular profunda (G87, Z-60) con herramienta de 20mm: SÍ avisa de longitud insuficiente',
    r.errors.some(e=>e.includes('no llega')));
}
{
  engine.toolTable = {1:{diameter:10,type:'fresa',length:100,radius:0}};
  const stmts = engine.parseISO('T1\nG0 Z10\nG87 I-60 J15 K10 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  check('Misma cajera con herramienta de 100mm: sin aviso de longitud',
    r.errors.filter(e=>e.includes('no llega')).length === 0);
}

// ------------------------------------------------------------
// Comprobación exhaustiva del asistente — cada patrón de explicación de
// alarma (ALARM_EXPLANATIONS) contra un mensaje REAL generado por el
// motor, no un texto de prueba inventado. Encontrados y corregidos tres
// fallos reales al construir esta misma prueba: un patrón que nunca
// podía coincidir con nada (el mensaje real había cambiado de
// arquitectura en una sesión anterior y el patrón se quedó apuntando a
// texto interno que nunca llega al usuario), otro patrón que capturaba
// dos alarmas semánticamente distintas con la misma explicación
// (compensación de fresadora vs desbaste de torno), y un patrón
// demasiado genérico ("colisión") que interceptaba el aviso de longitud
// insuficiente antes de que su propio patrón, más abajo en la lista,
// tuviera oportunidad de coincidir.
// ------------------------------------------------------------
{
  engine.toolTable = {5:{diameter:10,type:'macho',length:100,radius:0}};
  const stmts = engine.parseISO('T5\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const msg = r.errors.find(e=>e.includes('está definida como'));
  const exp = msg ? engine.explainAlarm(msg) : null;
  check('Patrón de alarma — tipo de herramienta equivocado resuelve al título correcto',
    exp && exp.title === 'Herramienta no coincide con el ciclo');
}
{
  engine.toolTable = {5:{diameter:8,type:'broca',length:20,radius:0}};
  const stmts = engine.parseISO('T5\nG0 X0 Z8\nG83 X0 Z0 I35.141 B9 D4 K0 H0 C1\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const msg = r.errors.find(e=>e.includes('no llega'));
  const exp = msg ? engine.explainAlarm(msg) : null;
  check('Patrón de alarma — longitud insuficiente resuelve a "Herramienta demasiado corta", no a "Aviso de colisión"',
    exp && exp.title === 'Herramienta demasiado corta');
}
{
  const stmts = engine.parseISO(`(STOCK D60 Z-100)\nG0 X60 Z-30\nG1 X50 Z-30 F100\nG0 X20 Z-30\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const msg = r.errors.find(e=>e.includes('colisión'));
  const exp = msg ? engine.explainAlarm(msg) : null;
  check('Patrón de alarma — colisión real de movimiento rápido resuelve a "Aviso de colisión"',
    exp && exp.title === 'Aviso de colisión');
}

// ------------------------------------------------------------
// La corrección automática de tipo de herramienta (botón "🔧 Cambiar...")
// se construyó y probó primero solo con un caso de torno — comprobación
// de que también funciona igual de bien en fresadora, dado que el
// parseo del mensaje es genérico y no debería depender del modo.
// ------------------------------------------------------------
{
  engine.toolTable = {1:{diameter:10,type:'macho',length:100,radius:0}};
  const stmts = engine.parseISO('T1\nG0 Z10\nG87 I-5 J15 K10 F150\nX10 Y10\nM30', 'mill');
  const r = engine.buildMoves(stmts, 'mill', 'iso');
  const msg = r.errors.find(e=>e.includes('está definida como'));
  const exp = msg ? engine.explainAlarm(msg) : null;
  const action = exp ? exp.fix(msg) : null;
  if(action) action.run();
  check('Corrección automática — funciona también en fresadora (T1 macho→fresa en G87)',
    action && engine.toolTable[1].type === 'fresa');
}

// ------------------------------------------------------------
// Cobertura del asistente para fresadora Fagor ISO — antes inexistente
// (la combinación ISO+fresadora devolvía null siempre). Verificado que
// usa la traducción real ya implementada en el parser, y que no se
// confunde con los mismos códigos en modo torno.
// ------------------------------------------------------------
{
  const g81mill = engine.detectCycleAtCursor('G81 Z-10 R2 F150', 'iso', 'mill');
  check('Asistente — G81 Fagor fresadora reconocido como "Taladrado"',
    g81mill && g81mill.name === 'Taladrado' && g81mill.status === 'impl');
}
{
  const g87mill = engine.detectCycleAtCursor('G87 I-5 J15 K10 F150', 'iso', 'mill');
  check('Asistente — G87 Fagor fresadora reconocido como "Cajera rectangular"',
    g87mill && g87mill.name === 'Cajera rectangular');
}
{
  const g84mill = engine.detectCycleAtCursor('G84 Z-15 R2 F100 S500', 'iso', 'mill');
  check('Asistente — G84 Fagor fresadora reconocido como "Roscado con macho"',
    g84mill && g84mill.name === 'Roscado con macho');
}

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
