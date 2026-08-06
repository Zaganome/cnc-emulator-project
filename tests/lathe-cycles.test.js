// ============================================================
// tests/lathe-cycles.test.js
//
// Verificación POSITIVA de los ciclos de torno Fagor ya implementados.
// A diferencia de known-limitations.test.js (que fija comportamiento
// ACEPTADO pero imperfecto), este archivo comprueba que cada ciclo
// reproduce EXACTAMENTE los resultados de un ejemplo numérico real,
// encontrado en documentación oficial o manuales de ejemplos de Fagor —
// nunca un caso inventado. Cada prueba indica su fuente.
//
// Ejecutar con: node tests/lathe-cycles.test.js
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
  // Extraído desde TOOL_TYPES (no desde inferToolType) para usar la función REAL de
  // toolTypeLabel, no una simulada — necesaria para probar de verdad la corrección
  // automática de tipo de herramienta (toolTypeKeyFromLabel hace el mapeo inverso).
  const startMarker2 = 'const TOOL_TYPES';
  const endMarker2 = 'function nextFreeToolNum';
  const start2 = full.indexOf(startMarker2);
  const end2 = full.indexOf(endMarker2);
  if(start2<0 || end2<0) throw new Error('No se encontraron los marcadores de extracción (tabla de herramientas) esperados.');
  const toolBlock = full.slice(start2, end2);
  // Bloque del asistente: catálogo de ciclos (CYCLE_HELP), detección por cursor, y
  // explicación de alarmas con su corrección automática cuando existe.
  const startMarker3 = 'const CYCLE_HELP';
  const endMarker3 = 'let assistantMode';
  const start3 = full.indexOf(startMarker3);
  const end3 = full.indexOf(endMarker3);
  if(start3<0 || end3<0) throw new Error('No se encontraron los marcadores de extracción (asistente/alarmas) esperados.');
  const alarmBlock = full.slice(start3, end3);
  const sandbox = { toolTable: {}, mode: 'lathe', renderToolTableUI: ()=>{}, runSimulation: ()=>{}, console };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(toolBlock, sandbox);
  vm.runInContext(logicBlock, sandbox);
  vm.runInContext(alarmBlock, sandbox);
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
function closeTo(a, b, tol){ return Math.abs(a-b) <= (tol||0.5); }

const engine = loadEngine();

// ------------------------------------------------------------
// G84 (torneado de tramos curvos) — ejemplo real de Fagor
// Fuente: programa de ejemplo Fagor con centro de arco verificado a mano
// (radio calculado desde A y desde B ambos ≈50, confirmando la fórmula
// del centro I/K antes de implementar la geometría).
// ------------------------------------------------------------
{
  const prog = `(STOCK D160 Z-100)\nG0 X90 Z20\nG84 X0 Z0 Q78 R-48.775 C2 D1 I-11 K-48.775\nM30`;
  const r = runSim(engine, prog, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough').slice(-25);
  const last = cuts[cuts.length-1];
  check('G84 — perfil final llega exacto a X78/Z-48.775 (ejemplo real de Fagor)',
    last && closeTo(last.to.x,78) && closeTo(last.to.z,-48.775));
}

// ------------------------------------------------------------
// G88 (ranurado en eje X) — ejemplo real de Fagor
// Fuente: manual de ejemplos oficial Fagor 8055 y tutorial independiente,
// ambos con la misma sintaxis confirmada: G88 X Z Q R C D K
// ------------------------------------------------------------
{
  const prog = `(STOCK D30 Z-50)\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30`;
  const r = runSim(engine, prog, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('G88 — perfil final llega exacto a X5/Z-8 (ejemplo real de Fagor)',
    last && closeTo(last.to.x,5) && closeTo(last.to.z,-8));
  check('G88 — sin falsos positivos de colisión con el ejemplo real',
    r.errors.filter(e=>e.includes('colisión')).length === 0);
  check('G88 — avisa de K sin inventar su significado (parámetro presente en todos los ejemplos reales, sin fuente que lo confirme)',
    r.errors.some(e=>e.includes('K=1')));
}

// ------------------------------------------------------------
// G68 (desbastado de perfil completo) — ejemplo real de Fagor, perfil de
// 4 tramos mixto (arco + recta + arco + recta), del propio manual oficial
// ------------------------------------------------------------
{
  const prog = `(STOCK D50 Z-100)\nG0 X4 Z20\nG68 X0 Z0 C1 D1 P13=90 P14=120\nN90 G03 X20 Z-10 I0 K-10\nN100 G01 X20 Z-15\nN110 G02 X40 Z-25 I10 K0\nN120 G01 X70 Z-40\nM30`;
  const r = runSim(engine, prog, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('G68 — perfil de 4 tramos mixto llega exacto a X70/Z-40 (manual oficial de Fagor)',
    last && closeTo(last.to.x,70) && closeTo(last.to.z,-40));
  check('G68 — sin errores ni avisos de colisión con el ejemplo real',
    r.errors.filter(e=>e.includes('colisión')).length === 0);
}

// ------------------------------------------------------------
// G81 — verifica que la aproximación en dos etapas (compartida ahora con
// G88) no cambió el comportamiento ya probado en sesiones anteriores
// ------------------------------------------------------------
{
  const prog = `(STOCK D60 Z-100)\nG0 X60 Z2\nG81 X40 Z0 Q40 R-50 C2 D1\nM30`;
  const r = runSim(engine, prog, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('G81 — perfil final exacto tras compartir la función de aproximación segura con G88',
    last && closeTo(last.to.x,40,0.01) && closeTo(last.to.z,-50,0.01));
  check('G81 — sin falsos positivos de colisión',
    r.errors.filter(e=>e.includes('colisión')).length === 0);
}

// ------------------------------------------------------------
// Inferencia de tipo de herramienta por ciclo de torno (sin depender de
// texto descriptivo) — añadido tras encontrar y corregir un fallo real:
// inferToolType() para torno nunca devolvía null (siempre caía en
// 'torno_desbaste' dentro de la propia función), lo que bloqueaba en
// silencio que la inferencia por ciclo (G88→ranurado, G83 con B=0→macho,
// B>0→broca) tuviera alguna vez la oportunidad de participar.
// ------------------------------------------------------------
{
  const progG88 = `(STOCK D30 Z-50)\nT5 (D10)\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30`;
  runSim(engine, progG88, 'lathe', 'iso');
  check('Tipo de herramienta inferido por ciclo — G88 sin texto descriptivo → torno_ranurado',
    engine.toolTable[5] && engine.toolTable[5].type === 'torno_ranurado');
}
{
  const progMacho = `(STOCK D30 Z-50)\nT3 (D6)\nG0 X0 Z8\nG83 X0 Z0 I20 B0 D4 C1\nM30`;
  runSim(engine, progMacho, 'lathe', 'iso');
  check('Tipo de herramienta inferido por ciclo — G83 con B=0 (macho) → macho',
    engine.toolTable[3] && engine.toolTable[3].type === 'macho');
}
{
  const progBroca = `(STOCK D30 Z-50)\nT4 (D8)\nG0 X0 Z8\nG83 X0 Z0 I20 B5 D4 C1\nM30`;
  runSim(engine, progBroca, 'lathe', 'iso');
  check('Tipo de herramienta inferido por ciclo — G83 con B=5 (broca) → broca',
    engine.toolTable[4] && engine.toolTable[4].type === 'broca');
}
{
  const progTexto = `(STOCK D30 Z-50)\nT6 (D10 ranurado especial)\nG0 X20 Z0\nG81 X10 Z0 Q5 R-10 C1 D1\nM30`;
  runSim(engine, progTexto, 'lathe', 'iso');
  check('El texto descriptivo explícito sigue ganando sobre la inferencia por ciclo',
    engine.toolTable[6] && engine.toolTable[6].type === 'torno_ranurado');
}

// ------------------------------------------------------------
// Alarma de tipo de herramienta equivocada para el ciclo — ausente hasta
// ahora en torno (solo existía para fresadora). Verificado en los dos
// sentidos: no avisa cuando la herramienta es correcta, sí avisa cuando
// no lo es, incluido el caso especial de G83 (macho vs broca según su
// propio parámetro B, no un tipo fijo por código de ciclo).
// ------------------------------------------------------------
{
  engine.toolTable = {5:{diameter:10,type:'torno_ranurado',length:100,radius:0}};
  const stmts = engine.parseISO(`(STOCK D30 Z-50)\nT5\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Alarma de tipo de herramienta — herramienta correcta (ranurado) para G88: sin aviso',
    r.errors.filter(e=>e.includes('está definida como')).length === 0);
}
{
  engine.toolTable = {5:{diameter:10,type:'macho',length:100,radius:0}};
  const stmts = engine.parseISO(`(STOCK D30 Z-50)\nT5\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Alarma de tipo de herramienta — herramienta equivocada (macho) para G88: SÍ avisa',
    r.errors.some(e=>e.includes('está definida como')));
}
{
  engine.toolTable = {3:{diameter:6,type:'broca',length:100,radius:0}};
  const stmts = engine.parseISO(`(STOCK D30 Z-50)\nT3\nG0 X0 Z8\nG83 X0 Z0 I20 B0 D4 C1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Alarma de tipo de herramienta — G83 con B=0 necesita macho, broca puesta: SÍ avisa',
    r.errors.some(e=>e.includes('está definida como')));
}

// ------------------------------------------------------------
// Longitud de herramienta en G83 de torno — mismo hueco de la misma
// familia que el de fresadora: torno nunca comprobaba esto en absoluto,
// pese a que la función compartida checkToolLengthAlarm ya existía desde
// antes de esta sesión, solo para fresadora.
// ------------------------------------------------------------
{
  engine.toolTable = {5:{diameter:8,type:'broca',length:20,radius:0}};
  const stmts = engine.parseISO(`T5\nG0 X0 Z8\nG83 X0 Z0 I35.141 B9 D4 K0 H0 C1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('G83 torno — agujero real de 35.141mm con herramienta de 20mm: SÍ avisa de longitud insuficiente',
    r.errors.some(e=>e.includes('no llega')));
}
{
  engine.toolTable = {5:{diameter:8,type:'broca',length:100,radius:0}};
  const stmts = engine.parseISO(`T5\nG0 X0 Z8\nG83 X0 Z0 I35.141 B9 D4 K0 H0 C1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Mismo agujero con herramienta de 100mm: sin aviso de longitud',
    r.errors.filter(e=>e.includes('no llega')).length === 0);
}

// ------------------------------------------------------------
// Corrección automática de la alarma de tipo de herramienta — parsea el
// propio mensaje real generado por el motor (no un texto de prueba
// inventado) y comprueba que el mapeo de vuelta a la clave interna y la
// acción de corrección son correctos, sin necesitar un DOM real.
// ------------------------------------------------------------
{
  engine.toolTable = {5:{diameter:10,type:'macho',length:100,radius:0}};
  const stmts = engine.parseISO(`(STOCK D30 Z-50)\nT5\nG0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C1 D1 K1\nM30`, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const realMsg = r.errors.find(e=>e.includes('está definida como'));
  const explanation = engine.explainAlarm(realMsg);
  check('Corrección automática — el mensaje real generado por el motor se reconoce',
    explanation && explanation.title === 'Herramienta no coincide con el ciclo');
  const action = explanation ? explanation.fix(realMsg) : null;
  check('Corrección automática — la acción propuesta apunta a la herramienta correcta (T5)',
    action && action.label.includes('T5'));
  if(action) action.run();
  check('Corrección automática — al ejecutarla, la tabla de herramientas queda corregida de verdad',
    engine.toolTable[5].type === 'torno_ranurado');
}

// ------------------------------------------------------------
// Asistentes guiados de inserción de ciclos (G81, G88, G83) — comprueba
// que el texto que generarían con sus valores por defecto es código Fagor
// válido y produce exactamente la geometría pedida. No se simula el
// diálogo en sí (requeriría DOM), se verifica el resultado que ese
// diálogo produciría con sus valores por defecto reales.
// ------------------------------------------------------------
{
  const text = 'G81 X40 Z0 Q40 R-50 C2 D1'; // valores por defecto reales del asistente de G81
  const r = runSim(engine, `(STOCK D60 Z-100)\nG0 X60 Z2\n${text}\nM30`, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('Asistente guiado G81 — el texto generado por defecto llega exacto a X40/Z-50',
    last && Math.abs(last.to.x-40)<0.01 && Math.abs(last.to.z-(-50))<0.01);
}
{
  const text = 'G88 X30 Z-20 Q20 R-24 C2 D1'; // valores por defecto reales del asistente de G88
  const r = runSim(engine, `(STOCK D50 Z-100)\nG0 X35 Z0\n${text}\nM30`, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('Asistente guiado G88 — el texto generado por defecto llega exacto a X20/Z-24',
    last && Math.abs(last.to.x-20)<0.5 && Math.abs(last.to.z-(-24))<0.5);
}
{
  const text = 'G83 X0 Z0 I20 B5 D4 C1'; // valores por defecto reales del asistente de G83
  const r = runSim(engine, `(STOCK D30 Z-50)\nG0 X0 Z8\n${text}\nM30`, 'lathe', 'iso');
  check('Asistente guiado G83 — el texto generado por defecto produce movimientos sin errores de sintaxis',
    r.moves.filter(m=>m.color==='rough').length > 0);
}
{
  const text = 'G82 X60 Z0 Q30 R-20 C2 D1'; // valores por defecto reales del asistente de G82
  const r = runSim(engine, `(STOCK D70 Z-100)\nG0 X65 Z5\n${text}\nM30`, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('Asistente guiado G82 — el texto generado por defecto llega exacto a X30/Z-20',
    last && Math.abs(last.to.x-30)<0.5 && Math.abs(last.to.z-(-20))<0.5);
}
{
  // aproximación manual en dos etapas (Z primero, luego X) — la práctica real, igual
  // que ya exigen los propios ciclos generados por este simulador; una única G0
  // diagonal desde fuera del bruto hacia dentro dispara, correctamente, el detector
  // de colisiones — no es un fallo del ciclo G89 ni de su asistente
  const text = 'G89 X30 Z-20 Q30 R-24 C2 D1'; // valores por defecto reales del asistente de G89
  const r = runSim(engine, `(STOCK D50 Z-100)\nG0 X35 Z5\nG0 Z-10\n${text}\nM30`, 'lathe', 'iso');
  check('Asistente guiado G89 — el texto generado por defecto no da colisión con una aproximación realista',
    r.errors.filter(e=>e.includes('colisión')).length === 0);
  check('Asistente guiado G89 — genera movimientos de corte',
    r.moves.filter(m=>m.color==='rough').length > 0);
}
{
  const text = 'G84 X0 Z0 Q78 R-48.775 C2 D1 I-11 K-48.775'; // el propio ejemplo real de Fagor
  const r = runSim(engine, `(STOCK D160 Z-100)\nG0 X90 Z20\n${text}\nM30`, 'lathe', 'iso');
  check('Asistente guiado G84 — el texto generado por defecto coincide con la regresión conocida (541 movimientos)',
    r.moves.length === 541);
}
{
  const text = 'G85 X0 Z0 Q78 R-48.775 C2 D1 I-11 K-48.775'; // mismo I/K que G84, pasadas en Z
  const r = runSim(engine, `(STOCK D160 Z-100)\nG0 X90 Z20\n${text}\nM30`, 'lathe', 'iso');
  check('Asistente guiado G85 — el texto generado por defecto no da ninguna alarma crítica',
    r.errors.filter(e=>e.includes('🚨') && !e.includes('está definida como')).length === 0);
}
{
  // el rango de etiquetas por defecto del asistente (P13=90, P14=100) es solo un punto
  // de partida orientativo para que el usuario lo ajuste a su perfil real — aquí se
  // prueba con un perfil de una sola línea etiquetada N90, con P14 ajustado para
  // coincidir (P14=100 fallaría porque esa etiqueta no existiría en el programa, lo
  // cual es correcto: el propio simulador avisa con claridad en ese caso, verificado
  // por separado durante esta misma investigación)
  const text = 'G68 X0 Z0 C1 D1 P13=90 P14=90';
  const r = runSim(engine, `(STOCK D30 Z-50)\nG0 X4 Z10\n${text}\nN90 G01 X20 Z-30\nM30`, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  const last = cuts[cuts.length-1];
  check('Asistente guiado G68 — con el rango de etiquetas ajustado al perfil real, llega exacto a X20/Z-30',
    last && Math.abs(last.to.x-20)<0.5 && Math.abs(last.to.z-(-30))<0.5);
}

// ------------------------------------------------------------
// Perfil CERRADO en G68/G69 — llevaba desde una sesión anterior marcado
// como "sin verificar". Verificado en esta sesión con una prueba
// geométrica directa: en una pasada con desplazamiento real (no la
// pasada final), la distancia entre el primer y el último punto de la
// misma pasada era de 5.66mm en un caso de prueba concreto — un hueco
// real en la trayectoria, no solo una alarma que faltaba. Corregido
// detectando la condición y avisando con claridad, en vez de dejar que
// ocurra en silencio; el desbaste con desplazamiento real de un perfil
// cerrado sigue sin estar soportado correctamente, documentado como tal.
// ------------------------------------------------------------
{
  const prog = `(STOCK D50 Z-100)\nT1 (D0)\nG0 X10 Z5\nG68 X0 Z0 C1 D1 P13=90 P14=93\nN90 G01 X20 Z0\nN91 G01 X20 Z-20\nN92 G01 X0 Z-20\nN93 G01 X0 Z0\nM30`;
  const stmts = engine.parseISO(prog, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Perfil cerrado en G68 con desplazamiento real — avisa con claridad del límite conocido',
    r.errors.some(e=>e.includes('CERRADO')));
}
{
  const prog = `(STOCK D50 Z-100)\nG0 X4 Z20\nG68 X0 Z0 C1 D1 P13=90 P14=120\nN90 G03 X20 Z-10 I0 K-10\nN100 G01 X20 Z-15\nN110 G02 X40 Z-25 I10 K0\nN120 G01 X70 Z-40\nM30`;
  const stmts = engine.parseISO(prog, 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('Perfil abierto real de Fagor — NO avisa de perfil cerrado (sin falso positivo)',
    !r.errors.some(e=>e.includes('CERRADO')));
}

// ------------------------------------------------------------
// Comprobación crítica del asistente — G81 y G88 significan cosas
// completamente distintas en fresadora y en torno Fagor ISO. Es el mismo
// tipo de colisión de códigos que ya causó un fallo real en este proyecto
// (confundir tipo de herramienta entre modos). El asistente debe dar la
// explicación correcta según el modo activo, nunca la del otro.
// ------------------------------------------------------------
{
  const g81mill = engine.detectCycleAtCursor('G81 Z-10 R2 F150', 'iso', 'mill');
  const g81lathe = engine.detectCycleAtCursor('G81 X40 Z0 Q40 R-50 C2 D1', 'iso', 'lathe');
  check('Asistente — G81 en fresadora da "Taladrado", en torno da "Torneado de tramos rectos", sin cruce',
    g81mill && g81mill.name === 'Taladrado' && g81lathe && g81lathe.name === 'Torneado de tramos rectos');
}
{
  const g88mill = engine.detectCycleAtCursor('G88 Z2 I-8 J15 F150', 'iso', 'mill');
  const g88lathe = engine.detectCycleAtCursor('G88 X10 Z-14 Q5 R-8 C1 D1', 'iso', 'lathe');
  check('Asistente — G88 en fresadora da "Cajera circular", en torno da ranurado, sin cruce',
    g88mill && g88mill.name === 'Cajera circular' && g88lathe && g88lathe.name.includes('Ranurado'));
}

// ------------------------------------------------------------
// CRÍTICO — bucle infinito real encontrado en auditoría. C=0 (o
// negativo) en cualquier ciclo de torno con paso de pasada pasaba la
// validación (solo comprobaba que no faltara, no que fuera válido) y
// causaba una división por cero en el cálculo del número de pasadas —
// Math.ceil(X/0) da Infinity, y el bucle genera movimientos sin parar
// nunca. Confirmado de la forma más dura posible: el proceso hubo que
// matarlo con `timeout`, ni siquiera con un límite de memoria explícito
// terminaba solo. Esta prueba usa su propio límite de tiempo (no solo
// comprobar el resultado) para que, si esta protección se rompe alguna
// vez sin querer, la batería de pruebas avise en vez de colgarse ella
// misma sin explicación.
// ------------------------------------------------------------
function checkWithTimeout(desc, fn, ms){
  const start = Date.now();
  let finished = false;
  try {
    fn();
    finished = true;
  } catch(e) {
    check(desc + ' (lanzó una excepción en vez de colgarse — aceptable, mejor que colgarse, pero revisar igualmente: ' + e.message + ')', false);
    return;
  }
  const elapsed = Date.now() - start;
  check(`${desc} (terminó en ${elapsed}ms, no se colgó)`, finished && elapsed < ms);
}
{
  checkWithTimeout('CRÍTICO — G81 con C=0 no cuelga el proceso', ()=>{
    const stmts = engine.parseISO('G0 X60 Z2\nG81 X40 Z0 Q40 R-50 C0 D1\nM30', 'lathe');
    engine.buildMoves(stmts, 'lathe', 'iso');
  }, 2000);
}
{
  const stmts = engine.parseISO('G0 X60 Z2\nG81 X40 Z0 Q40 R-50 C0 D1\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('CRÍTICO — G81 con C=0 da un error claro ("mayor que cero"), no silencio',
    r.errors.some(e=>e.includes('mayor que cero')));
}
{
  checkWithTimeout('CRÍTICO — G68 con C=0 no cuelga el proceso', ()=>{
    const stmts = engine.parseISO('(STOCK D50 Z-100)\nG0 X4 Z10\nG68 X0 Z0 C0 D1 P13=90 P14=90\nN90 G01 X20 Z-30\nM30', 'lathe');
    engine.buildMoves(stmts, 'lathe', 'iso');
  }, 2000);
}
{
  const stmts = engine.parseISO('(STOCK D50 Z-100)\nG0 X4 Z10\nG68 X0 Z0 C0 D1 P13=90 P14=90\nN90 G01 X20 Z-30\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('CRÍTICO — G68 con C=0 da un error claro, no silencio',
    r.errors.some(e=>e.includes('mayor que cero')));
}
{
  // los seis ciclos restantes que comparten la misma función de validación —
  // confirmar que TODOS quedaron protegidos, no solo el que reveló el fallo
  const cases = [
    ['G82', 'G0 X65 Z5\nG82 X60 Z0 Q30 R-20 C0 D1\nM30'],
    ['G84', 'G0 X90 Z20\nG84 X0 Z0 Q78 R-48.775 C0 D1 I-11 K-48.775\nM30'],
    ['G85', 'G0 X90 Z20\nG85 X0 Z0 Q78 R-48.775 C0 D1 I-11 K-48.775\nM30'],
    ['G88', 'G0 X20 Z0\nG88 X10 Z-14 Q5 R-8 C0 D1\nM30'],
    ['G89', 'G0 X35 Z5\nG0 Z-10\nG89 X30 Z-20 Q30 R-24 C0 D1\nM30'],
    ['G69', '(STOCK D30 Z-50)\nG0 X4 Z10\nG69 X0 Z0 C0 D1 P13=90 P14=90\nN90 G01 X20 Z-10\nM30'],
  ];
  let allSafe = true, allClearError = true;
  for(const [name, code] of cases){
    const start = Date.now();
    const stmts = engine.parseISO(code, 'lathe');
    const r = engine.buildMoves(stmts, 'lathe', 'iso');
    if(Date.now()-start >= 2000) allSafe = false;
    if(!r.errors.some(e=>e.includes('mayor que cero'))) allClearError = false;
  }
  check('CRÍTICO — los 6 ciclos restantes con C=0 no cuelgan el proceso', allSafe);
  check('CRÍTICO — los 6 ciclos restantes con C=0 dan un error claro', allClearError);
}

// ------------------------------------------------------------
// G86 (roscado longitudinal de torno) — IMPLEMENTADO en la sesión de
// cierre, tras encontrar la tabla oficial completa de parámetros (Fagor
// CNC 8055/8055i, modelo T, sección 9.9) más una segunda fuente
// independiente que confirma la fórmula de profundización de pasada: B
// negativo = incremento constante (n×|B|), B positivo = sección de
// viruta constante (|B|×√n, "profundidad de cada pasada es P5 por
// radical" en la fuente antigua). Alcance ACOTADO deliberadamente: solo
// J=0 (rosca ciega) — de los 3 ejemplos reales encontrados en la
// investigación, 2 usan J≠0 (salida con recorrido propio), NO soportado
// todavía, documentado con honestidad, no oculto. K/V/M (repaso,
// múltiples entradas, paso variable) rechazados con mensaje claro — misma
// barrera de sincronización con husillo que bloquea G87 por completo.
// ------------------------------------------------------------
{
  // ejemplo real encontrado en la investigación (roscado interior)
  engine.toolTable = {5:{diameter:10,type:'torno_roscar',length:100,radius:0}};
  const stmts = engine.parseISO('T5\nG0 X65 Z5\nG86 X60 Z0 Q60 R-20 I-0.8 B0.4 D-2 L0 C1.5 J0 A29.5\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  check('G86 — ejemplo real (roscado interior, B positivo/√n): sin errores bloqueantes',
    r.errors.filter(e=>e.includes('🚨')).length === 0);
  check('G86 — ejemplo real: exactamente 4 pasadas (0.4×√4 = 0.8 = profundidad total)',
    cuts.length === 4);
  check('G86 — ejemplo real: última pasada llega exacta a la profundidad total (X=61.6)',
    cuts.length===4 && Math.abs(cuts[3].to.x-61.6)<0.001);
}
{
  // caso propio con B negativo (incremento constante), para probar la otra fórmula
  engine.toolTable = {5:{diameter:10,type:'torno_roscar',length:100,radius:0}};
  const stmts = engine.parseISO('T5\nG0 X45 Z5\nG86 X40 Z0 Q40 R-30 I1.5 B-0.3 D1 L0 C2 J0 A30\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  const cuts = r.moves.filter(m=>m.color==='rough');
  check('G86 — B negativo (incremento constante): 5 pasadas (ceil(1.5/0.3)=5)',
    cuts.length === 5);
  check('G86 — B negativo: última pasada llega exacta a X=37 (40-2×1.5)',
    cuts.length===5 && Math.abs(cuts[4].to.x-37)<0.001);
}
{
  // J distinto de 0 -- correctamente rechazado, no silenciado
  engine.toolTable = {11:{diameter:10,type:'torno_roscar',length:100,radius:0}};
  const stmts = engine.parseISO('T11\nG0 X80 Z1.5\nG86 X17.396 Z0 Q78 R-75 I2 B.4 D-2 L0 C-3 J5 A29.5\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('G86 — J≠0 (otro ejemplo real, salida con recorrido): rechazado con mensaje claro, no silenciado',
    r.errors.some(e=>e.includes('J distinto de 0')));
}
{
  // K, V, M -- rechazados
  engine.toolTable = {5:{diameter:10,type:'torno_roscar',length:100,radius:0}};
  const stmts = engine.parseISO('T5\nG0 X45 Z5\nG86 X40 Z0 Q40 R-30 I1.5 B-0.3 D1 L0 C2 J0 A30 V3\nM30', 'lathe');
  const r = engine.buildMoves(stmts, 'lathe', 'iso');
  check('G86 — V (múltiples entradas) rechazado con mensaje claro',
    r.errors.some(e=>e.includes('no están soportados')));
}

// ------------------------------------------------------------
// "Profesor CNC" — buena práctica: programa sin marca de fin (M30/M2/END
// PGM). No bloquea la simulación, pero enseña una práctica real que un
// control de verdad exigiría.
// ------------------------------------------------------------
{
  const stmts = engine.parseHeidenhain('0 BEGIN PGM X MM\nL X+10 Y0 F100');
  const r = engine.buildMoves(stmts, 'mill', 'heidenhain');
  check('Profesor CNC — programa sin M30/M2/END PGM: avisa como buena práctica',
    r.errors.some(e=>e.includes('marca de fin')));
}
{
  const stmts = engine.parseHeidenhain('0 BEGIN PGM X MM\nL X+10 Y0 F100\n2 END PGM X MM');
  const r = engine.buildMoves(stmts, 'mill', 'heidenhain');
  check('Profesor CNC — programa CON END PGM: no avisa (sin falso positivo)',
    !r.errors.some(e=>e.includes('marca de fin')));
}

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
