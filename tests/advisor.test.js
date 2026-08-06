// ============================================================
// tests/advisor.test.js
//
// Pruebas del ASESOR CNC (motor de reglas extensible, ADVISOR_RULES).
//
// Este archivo tiene DOS mitades igual de importantes:
//
//  1. AUSENCIA DE FALSOS POSITIVOS. Los 4 programas de referencia del
//     proyecto son programas reales y correctos: el asesor NO debe
//     encontrar nada en ellos. Esta mitad existe porque la primera
//     versión de las reglas producía 5-6 hallazgos falsos en cada uno de
//     los cuatro — un aviso que salta cuando no debe enseña al alumno a
//     ignorar todos los avisos, que es peor que no tenerlos.
//
//  2. CONTRAPRUEBA POSITIVA. Cada regla debe SALTAR cuando de verdad
//     corresponde. Una regla que nunca salta es igual de inútil que una
//     que salta siempre, y la mitad 1 por sí sola no lo detectaría.
//
// Ejecutar con: node tests/advisor.test.js  (sin dependencias externas)
// ============================================================
const fs = require('fs');
const path = require('path');

function loadEngine(){
  const htmlPath = path.join(__dirname, '..', 'cnc-studio-pro.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if(!m) throw new Error('No se encontró el bloque <script> en cnc-studio-pro.html');
  const full = m[1];
  const blocks = [
    ['const TOOL_TYPES', 'function nextFreeToolNum'],
    ['function generatePatternPositions', '// ============================================================\n// RENDER 2D'],
    ['const ADVISOR_RULES', 'const ALARM_EXPLANATIONS'],
  ];
  const sandbox = { toolTable:{}, mode:'mill', renderToolTableUI:()=>{}, runSimulation:()=>{}, console };
  const vm = require('vm');
  vm.createContext(sandbox);
  for(const [a,b] of blocks){
    const s = full.indexOf(a), e = full.indexOf(b);
    if(s<0 || e<0) throw new Error('Marcadores de extracción no encontrados: '+a+' / '+b);
    vm.runInContext(full.slice(s,e), sandbox);
  }
  sandbox.__read = (expr)=>vm.runInContext(expr, sandbox);
  return sandbox;
}

let pass = 0, fail = 0;
function check(desc, cond){
  if(cond){ pass++; console.log('✅', desc); }
  else { fail++; console.log('❌', desc); }
}

const engine = loadEngine();

function advise(src, tt, md){
  engine.toolTable = tt || {};
  engine.mode = md || 'mill';
  const dialect = md==='lathe' ? 'iso' : 'heidenhain';
  const statements = md==='lathe' ? engine.parseISO(src,'lathe') : engine.parseHeidenhain(src);
  const result = engine.buildMoves(statements, engine.mode, dialect);
  return engine.runAdvisor({
    statements, moves: result.moves, toolTable: engine.toolTable,
    mode: engine.mode, dialect, blk: result.blk, sourceText: src.toUpperCase()
  });
}
function has(findings, id){ return findings.some(f=>f.id===id); }

// ------------------------------------------------------------
// MITAD 1 — cero falsos positivos en los 4 programas reales
// ------------------------------------------------------------

// Los programas de referencia se buscan primero DENTRO del repositorio
// (examples/), y si no, un nivel por encima — así quien clone el repositorio
// puede ejecutar la batería completa sin colocar nada a mano.
function refPath(nombre){
  const candidatos = [
    path.join(__dirname,'..','examples',nombre),
    path.join(__dirname,'..','..',nombre),
    path.join(__dirname,'..',nombre),
  ];
  for(const c of candidatos){ if(fs.existsSync(c)) return c; }
  return candidatos[0];
}
const REFS = [
  ['T12', refPath('T12.txt')],
  ['T11', refPath('T11.txt')],
  ['T09', refPath('T09.txt')],
  ['PR01', refPath('PR01.txt')],
];
let refsFound = 0;
for(const [name, file] of REFS){
  if(!fs.existsSync(file)) continue;
  refsFound++;
  const src = fs.readFileSync(file,'utf-8');
  engine.toolTable = {}; engine.mode = 'mill';
  const statements = engine.parseHeidenhain(src);
  let result = engine.buildMoves(statements, 'mill', 'heidenhain');
  engine.syncToolTable(result.toolsUsed);
  result = engine.buildMoves(statements, 'mill', 'heidenhain');
  const findings = engine.runAdvisor({
    statements, moves: result.moves, toolTable: engine.toolTable,
    mode:'mill', dialect:'heidenhain', blk: result.blk, sourceText: src.toUpperCase()
  });
  check(`Sin falsos positivos en el programa real ${name}` + (findings.length ? ' — encontrados: '+findings.map(f=>f.id).join(', ') : ''),
    findings.length === 0);
}
if(refsFound === 0){
  console.log('ℹ  Programas de referencia no encontrados junto al repositorio — mitad 1 omitida.');
}

// ------------------------------------------------------------
// MITAD 2 — contraprueba positiva de cada regla
// ------------------------------------------------------------
const STOCK = 'BLK FORM 0.1 Z X+0 Y+0 Z-60\nBLK FORM 0.2 X+50 Y+50 Z+0';

check('sin_husillo — programa que corta sin ninguna S: avisa',
  has(advise(`0 BEGIN PGM A MM\n${STOCK}\n1 L X+0 Y+0 Z+2 R0 FMAX\n2 L Z-5 F100\n3 L X+40 F200\n4 END PGM A MM`), 'sin_husillo'));

check('sin_arranque_husillo — hay S pero no M3/M4/M13: avisa',
  has(advise(`0 BEGIN PGM B MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+0 Y+0 Z+2 R0 FMAX\n3 L Z-5 F100\n4 L X+40 F200\n5 END PGM B MM`), 'sin_arranque_husillo'));

{
  // M13 = M3+M8: debe contar como arranque de husillo Y como refrigerante.
  // No reconocerlo fue un falso positivo real en los 4 programas de referencia.
  const f = advise(`0 BEGIN PGM C MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+0 Y+0 Z+2 R0 FMAX M13\n3 L Z-5 F100\n4 L X+40 F200\n5 END PGM C MM`);
  check('M13 cuenta como arranque de husillo (M3+M8 combinados)', !has(f,'sin_arranque_husillo'));
  check('M13 cuenta como refrigerante activado', !has(f,'sin_refrigerante'));
}

{
  const deepPlunge = `0 BEGIN PGM D MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+20 Y+20 Z+2 R0 FMAX M13\n3 L Z-40 F100\n4 L X+40 F200\n5 END PGM D MM`;
  check('penetracion_profunda — fresa DEFINIDA bajando 40mm con Ø10: avisa',
    has(advise(deepPlunge, {1:{diameter:10,type:'fresa',length:100,radius:0}}), 'penetracion_profunda'));
  check('penetracion_profunda — la MISMA bajada con broca definida: NO avisa (bajar es su función)',
    !has(advise(deepPlunge, {1:{diameter:10,type:'broca',length:100,radius:0}}), 'penetracion_profunda'));
  check('penetracion_profunda — herramienta NO definida en la tabla: NO avisa (el tipo "fresa" ahí es un desconocido, no una clasificación)',
    !has(advise(deepPlunge, {}), 'penetracion_profunda'));
}

check('herramienta_no_usada — T7 en la tabla que el programa nunca llama: avisa',
  has(advise(`0 BEGIN PGM F MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+0 Y+0 Z+2 R0 FMAX M13\n3 L Z-5 F100\n4 END PGM F MM`,
    {1:{diameter:10,type:'fresa',length:100,radius:0},7:{diameter:6,type:'broca',length:100,radius:0}}), 'herramienta_no_usada'));

check('etiqueta_no_llamada — LBL 5 definida y nunca llamada: avisa',
  has(advise(`0 BEGIN PGM G MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+0 Y+0 Z+2 R0 FMAX M13\n3 L Z-5 F100\n4 LBL 5\n5 L X+10 F100\n6 LBL 0\n7 END PGM G MM`), 'etiqueta_no_llamada'));

check('programa_sin_corte — todo son rápidos, nada corta: avisa',
  has(advise(`0 BEGIN PGM H MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+0 Y+0 Z+2 R0 FMAX M13\n3 L X+40 R0 FMAX\n4 END PGM H MM`), 'programa_sin_corte'));

{
  // bloque de cambio de herramienta EXACTAMENTE repetido: redundante de verdad
  check('cambio_herramienta_redundante — bloque idéntico repetido: avisa',
    has(advise(`0 BEGIN PGM I MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 TOOL CALL 1 Z S1200\n3 L X+0 Y+0 Z+2 R0 FMAX M13\n4 L Z-5 F100\n5 END PGM I MM`), 'cambio_herramienta_redundante'));
  // misma herramienta pero con OTRA S: es la forma legítima de cambiar la velocidad
  check('cambio_herramienta_redundante — misma herramienta con otra S: NO avisa (es legítimo)',
    !has(advise(`0 BEGIN PGM J MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L Z-5 F100\n3 TOOL CALL 1 Z S2400\n4 L X+10 F100\n5 END PGM J MM`), 'cambio_herramienta_redundante'));
}

// ------------------------------------------------------------
// Robustez del motor: una regla que lance una excepción no debe tumbar
// el análisis entero ni, sobre todo, la simulación.
// ------------------------------------------------------------
{
  const findings = engine.runAdvisor({ statements:null, moves:null, toolTable:null, mode:'mill', dialect:'heidenhain', blk:null, sourceText:null });
  check('El motor sobrevive a un contexto completamente inválido, sin lanzar', Array.isArray(findings));
}

// ------------------------------------------------------------
// Calidad pedagógica: toda regla debe explicar QUÉ, POR QUÉ y CÓMO.
// Una regla que solo avisa sin enseñar no cumple el objetivo del asesor.
// ------------------------------------------------------------
{
  const f = advise(`0 BEGIN PGM K MM\n${STOCK}\n1 L X+0 Y+0 Z+2 R0 FMAX\n2 L Z-5 F100\n3 END PGM K MM`);
  const complete = f.length>0 && f.every(x=>x.que && x.por && x.como && x.title && x.cat && x.sev);
  check('Todo hallazgo trae qué / por qué / cómo (no solo el aviso)', complete);
}

// ------------------------------------------------------------
// Reglas añadidas en la ampliación del asesor. Cada una con su caso
// negativo: no basta con que salten, tienen que CALLARSE cuando el
// programa es correcto — que es donde fallaba la primera versión.
// ------------------------------------------------------------
const CICLO = 'CYCL DEF 200 TALADRADO\n  Q200=+2\n  Q201=-10\n  Q206=+150\n  Q202=+5\n  Q210=+0\n  Q203=+0\n  Q204=+50\n  Q211=+0';

check('ciclo_nunca_ejecutado — CYCL DEF sin CYCL CALL, M99 ni M89: avisa',
  has(advise(`0 BEGIN PGM A MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n${CICLO}\n3 L Z+150 R0 FMAX\n4 END PGM A MM`), 'ciclo_nunca_ejecutado'));
check('ciclo_nunca_ejecutado — con M99 disparándolo: NO avisa',
  !has(advise(`0 BEGIN PGM B MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n${CICLO}\n2 L X+10 Y+10 R0 FMAX M99\n3 L Z+150 R0 FMAX\n4 END PGM B MM`), 'ciclo_nunca_ejecutado'));
check('ciclo_nunca_ejecutado — con CYCL CALL: NO avisa',
  !has(advise(`0 BEGIN PGM C MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n${CICLO}\nCYCL CALL\n3 L Z+150 R0 FMAX\n4 END PGM C MM`), 'ciclo_nunca_ejecutado'));

check('final_sin_retirada — acaba con la herramienta dentro de la pieza: avisa',
  has(advise(`0 BEGIN PGM D MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n3 L Z-5 F100\n4 L X+40 F200\n5 END PGM D MM`), 'final_sin_retirada'));
check('final_sin_retirada — retira a Z+150 antes de acabar: NO avisa',
  !has(advise(`0 BEGIN PGM E MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n3 L Z-5 F100\n4 L X+40 F200\n5 L Z+150 R0 FMAX\n6 END PGM E MM`), 'final_sin_retirada'));

// el bruto compartido de este archivo llega hasta Z-60, así que hay que bajar
// bastante más para estar de verdad por debajo de la pieza
check('corte_bajo_el_bruto — corta 30mm por debajo de la pieza: avisa',
  has(advise(`0 BEGIN PGM F MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n3 L Z-90 F100\n4 L Z+150 R0 FMAX\n5 END PGM F MM`), 'corte_bajo_el_bruto'));
check('corte_bajo_el_bruto — agujero pasante con 3mm de salida legítima: NO avisa',
  !has(advise(`0 BEGIN PGM G MM\n${STOCK}\n1 TOOL CALL 1 Z S1200\n2 L X+10 Y+10 Z+2 R0 FMAX M13\n3 L Z-63 F100\n4 L Z+150 R0 FMAX\n5 END PGM G MM`), 'corte_bajo_el_bruto'));

// ------------------------------------------------------------
// Reglas específicas de TORNO. El asesor estaba muy escorado a fresadora
// en un proyecto centrado en torno; estas dos cierran esa asimetría.
// El control de falsos positivos son los ejemplos REALES de Fagor que ya
// se usan en tests/lathe-cycles.test.js.
// ------------------------------------------------------------
function adviseLathe(src, tt){
  engine.toolTable = tt || {};
  engine.mode = 'lathe';
  const statements = engine.parseISO(src, 'lathe');
  const result = engine.buildMoves(statements, 'lathe', 'iso');
  return engine.runAdvisor({
    statements, moves: result.moves, toolTable: engine.toolTable,
    mode:'lathe', dialect:'iso', blk: result.blk, sourceText: src.toUpperCase()
  });
}

check('Torno — ejemplo real G81 (torneado) bien programado: sin hallazgos',
  adviseLathe('(STOCK D60 Z-100)\nT1 M6\nS1000 M3 M8\nG0 X60 Z2\nG81 X40 Z0 Q40 R-50 C2 D1\nG0 X80 Z50\nM30').length === 0);
check('Torno — ejemplo real G88 (ranurado) bien programado: sin hallazgos',
  adviseLathe('(STOCK D50 Z-100)\nT5 M6\nS800 M3 M8\nG0 X35 Z0\nG88 X30 Z-20 Q20 R-24 C2 D1\nG0 X80 Z50\nM30').length === 0);
check('Torno — ejemplo real G86 (roscado) bien programado: sin hallazgos',
  adviseLathe('(STOCK D70 Z-100)\nT11 M6\nS500 M3 M8\nG0 X65 Z5\nG86 X60 Z0 Q60 R-20 I-0.8 B0.4 D-2 L0 C1.5 J0 A29.5\nG0 X100 Z50\nM30').length === 0);

check('torno_corte_pasa_eje — corte hasta X-20 (el eje está en X0): avisa',
  has(adviseLathe('(STOCK D60 Z-100)\nT1 M6\nS1000 M3 M8\nG0 X60 Z2\nG1 X-20 Z0 F0.2\nG0 X80 Z50\nM30'), 'torno_corte_pasa_eje'));
check('torno_final_sin_retirada — acaba con la herramienta dentro del bruto: avisa',
  has(adviseLathe('(STOCK D60 Z-100)\nT1 M6\nS1000 M3 M8\nG0 X60 Z2\nG81 X40 Z0 Q40 R-50 C2 D1\nM30'), 'torno_final_sin_retirada'));

// ------------------------------------------------------------
// Plantillas de ARRANQUE (editor en blanco). La página abre con el
// programa vacío: solo inicio, la línea del bruto sin datos y fin. Estas
// cuatro plantillas deben simular limpio — sin movimientos y, sobre todo,
// SIN errores: un aviso nada más abrir la página sería ruido puro.
// En Fagor ISO el bruto va como COMENTARIO (STOCK ...) porque no existe
// ninguna instrucción equivalente al BLK FORM de Heidenhain: verificado
// contra los programas de ejemplo oficiales de Fagor, donde el bruto es
// una anotación y el área gráfica se define en el menú del control.
// ------------------------------------------------------------
{
  const plantillas = [
    ['Heidenhain fresadora', '0 BEGIN PGM NUEVO MM\n1 BLK FORM 0.1\n2 END PGM NUEVO MM', 'mill', 'heidenhain'],
    ['Heidenhain torno',     '0 BEGIN PGM NUEVO MM\n1 BLK FORM CYL\n2 END PGM NUEVO MM',  'lathe', 'heidenhain'],
    ['Fagor ISO fresadora',  '%\nO0001\n(STOCK )\nM30\n%', 'mill', 'iso'],
    ['Fagor ISO torno',      '%\nO0001\n(STOCK )\nM30\n%', 'lathe', 'iso'],
  ];
  for(const [nombre, src, md, dlt] of plantillas){
    engine.toolTable = {}; engine.mode = md;
    const stmts = dlt==='heidenhain' ? engine.parseHeidenhain(src) : engine.parseISO(src, md);
    const r = engine.buildMoves(stmts, md, dlt);
    check(`Plantilla de arranque ${nombre} — simula sin errores y sin movimientos`,
      r.errors.length === 0 && r.moves.length === 0);
  }
}

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
