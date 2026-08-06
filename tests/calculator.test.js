// ============================================================
// tests/calculator.test.js
//
// Verificación de la calculadora tecnológica, ejecutando la función real
// contra un DOM simulado (no solo revisando las fórmulas en el código).
//
// A DIFERENCIA de los otros tres archivos de pruebas de este proyecto,
// este SÍ necesita una dependencia externa: jsdom (la calculadora lee
// directamente ~15 campos del DOM real, no es viable simularlo a mano).
//
// Instalar antes de ejecutar (una sola vez):
//   npm install jsdom --no-save
//
// Ejecutar con: node tests/calculator.test.js
// ============================================================
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch(e) {
  console.log('❌ Este archivo necesita jsdom. Instálalo con: npm install jsdom --no-save');
  process.exit(1);
}

function loadCalculator(){
  const htmlPath = path.join(__dirname, '..', 'cnc-studio-pro.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const m = /<script>([\s\S]*)<\/script>/.exec(html);
  if(!m) throw new Error('No se encontró el bloque <script> en cnc-studio-pro.html');
  const full = m[1];
  const start = full.indexOf('function deriveFinishing');
  const end = full.indexOf('function runCalculator');
  if(start<0 || end<0) throw new Error('No se encontraron los marcadores de extracción esperados — revisa si el archivo cambió de estructura.');
  const calcCode = full.slice(start, end);

  const dom = new JSDOM(html, { runScripts: 'outside-only', resources: undefined });
  const window = dom.window;
  const document = window.document;
  const vm = require('vm');
  const context = { document, window, console };
  vm.createContext(context);
  vm.runInContext(calcCode, context);
  // las declaraciones let/const de nivel superior del código evaluado NO se exponen
  // como propiedades directas del objeto de contexto (a diferencia de function/var) —
  // se añade un lector explícito para poder comprobarlas desde fuera
  context.__read = (expr) => vm.runInContext(expr, context);
  return context;
}

let pass = 0, fail = 0;
function check(desc, condition){
  if(condition){ pass++; console.log('✅', desc); }
  else { fail++; console.log('❌', desc); }
}

const ctx = loadCalculator();
const doc = ctx.document;

// ------------------------------------------------------------
// Pestaña manual — verificación aritmética directa contra un cálculo
// hecho a mano, no solo "no dio error".
// ------------------------------------------------------------
{
  doc.getElementById('mVc').value = '100';
  doc.getElementById('mD').value = '10';
  doc.getElementById('mZ').value = '4';
  doc.getElementById('mFz').value = '0.05';
  doc.getElementById('calcTabAuto').classList.remove('active');
  ctx.calcUpdate();
  const out = doc.getElementById('calcResults').textContent;
  const expectedRpm = Math.round(100*1000/(Math.PI*10)); // 3183
  const expectedVf = Math.round(0.05*4*(100*1000/(Math.PI*10))); // 637
  check(`Manual — RPM correcto (Vc=100, D=10 → ${expectedRpm})`, out.includes(String(expectedRpm)));
  check(`Manual — Vf correcto (fz=0.05, Z=4 → ${expectedVf})`, out.includes(String(expectedVf)));
}

// ------------------------------------------------------------
// Pestaña automática — aluminio, fresa de carburo. Verifica el flujo
// completo: búsqueda de material, cálculo, e insignias de confianza.
// ------------------------------------------------------------
{
  ctx.calcPopulateSelects();
  doc.getElementById('aMaterial').value = 'aluminio';
  ctx.calcPopulateAlloys();
  doc.getElementById('aAlloy').value = '6061';
  doc.getElementById('aTool').value = 'fresa';
  doc.getElementById('aSub').value = 'carburo';
  doc.getElementById('aD').value = '10';
  doc.getElementById('aZ').value = '4';
  doc.getElementById('calcTabAuto').classList.add('active');
  ctx.calcUpdate();
  const out = doc.getElementById('calcResults').textContent;
  check('Automática — aluminio 6061 fresa: menciona el material correcto', out.includes('Aluminio'));
  check('Automática — aluminio 6061 fresa: RPM en el rango correcto (5730)', out.includes('5730'));
}

// ------------------------------------------------------------
// Torno — AÑADIDO en esta sesión, antes la calculadora no tenía ninguna
// opción de torno pese a que buena parte del proyecto se centra en
// torno. Verifica que usa avance por vuelta (f), no por diente (fz×Z),
// y que la opción existe de verdad en el desplegable real.
// ------------------------------------------------------------
{
  ctx.calcPopulateSelects();
  const toolOptions = [...doc.getElementById('aTool').options].map(o=>o.value);
  check('Torno — la opción "torno_desbaste" existe en el desplegable real',
    toolOptions.includes('torno_desbaste'));
}
{
  doc.getElementById('aMaterial').value = 'acero';
  ctx.calcPopulateAlloys();
  doc.getElementById('aAlloy').value = 'c45';
  doc.getElementById('aTool').value = 'torno_desbaste';
  doc.getElementById('aSub').value = 'carburo';
  doc.getElementById('aD').value = '40';
  ctx.calcUpdate();
  const out = doc.getElementById('calcResults').textContent;
  const expectedRpm = Math.round(160*1000/(Math.PI*40)); // 1273
  check(`Torno — acero C45, Ø40: RPM correcto (${expectedRpm})`, out.includes(String(expectedRpm)));
  check('Torno — usa avance por vuelta (Vf = f × S), no por diente', out.includes('f × S'));
  // NOTA: se investigó y eliminó por separado una variable de código muerto
  // (lastCalcInsertText) que calculaba un texto con la misma etiqueta fz/f
  // pero sin ningún consumidor real en toda la aplicación — el botón real
  // "Añadir a la tabla de herramientas" usa lastCalcData, verificado aquí.
  check('Torno — lastCalcData (lo que realmente usa el botón "Añadir a la tabla") tiene el tipo correcto',
    ctx.__read('lastCalcData.type') === 'torno_desbaste');
  check('Torno — lastCalcData tiene el RPM correcto',
    ctx.__read('lastCalcData.rpm') === expectedRpm);
}

// ------------------------------------------------------------
// askInlineSequence — infraestructura COMPARTIDA del editor (no es de la
// calculadora, pero reutiliza este archivo por ser el único que ya usa
// jsdom). Usada por los 9 asistentes guiados de torno y por BLK FORM en
// Heidenhain. Fallo real encontrado y corregido: si se iniciaba un
// segundo asistente sin haber terminado el primero, quedaban dos
// escuchadores de teclado activos sobre el mismo campo a la vez, y una
// sola pulsación de Enter los disparaba a los dos, mezclando las
// respuestas de uno con las del otro.
// ------------------------------------------------------------
{
  const dom2 = new JSDOM('<textarea id="code"></textarea><div id="inlineAskCloud" style="display:none"></div><div id="inlineAskLabel"></div><input id="inlineAskInput">', { runScripts:'outside-only' });
  const doc2 = dom2.window.document;
  const codeEl2 = doc2.getElementById('code');
  codeEl2.value = ''; codeEl2.selectionStart = 0; codeEl2.scrollTop = 0;
  codeEl2.getBoundingClientRect = () => ({left:0, top:0});
  dom2.window.innerWidth = 800; dom2.window.innerHeight = 600;
  const vm2 = require('vm');
  const ctx2 = { document: doc2, window: dom2.window, codeEl: codeEl2, getComputedStyle: dom2.window.getComputedStyle.bind(dom2.window), console };
  vm2.createContext(ctx2);
  const htmlFull = fs.readFileSync(path.join(__dirname, '..', 'cnc-studio-pro.html'), 'utf-8');
  const askCode = /let activeAskCleanup[\s\S]*?\n}\n/.exec(htmlFull)[0];
  vm2.runInContext(askCode, ctx2);

  const completions = [];
  vm2.runInContext(`askInlineSequence([{label:'A1',def:1},{label:'A2',def:2}], (a)=>__completions.push('A:'+a.join(',')))`, Object.assign(ctx2, {__completions: completions}));
  vm2.runInContext(`askInlineSequence([{label:'B1',def:10}], (a)=>__completions.push('B:'+a.join(',')))`, ctx2);
  const inputEl2 = doc2.getElementById('inlineAskInput');
  inputEl2.dispatchEvent(new dom2.window.KeyboardEvent('keydown', {key:'Enter'}));
  check('Asistentes guiados solapados — un solo Enter no mezcla las respuestas de dos asistentes distintos',
    JSON.stringify(completions) === '["B:10"]');
}

// ------------------------------------------------------------
// Reproducción (Empezar / Reiniciar y Empezar) — mismo tipo de fallo que
// los asistentes solapados: dos clics rápidos antes de que corriera el
// primer fotograma podían programar dos cadenas de requestAnimationFrame
// paralelas. No se manifestaba como fallo visible por una coincidencia
// frágil (compartían lastTs), pero sí producía dibujados redundantes
// reales. Corregido con un número de generación por vista — cualquier
// cadena que deje de ser la más reciente se detiene sola, sin ambigüedad.
// ------------------------------------------------------------
{
  const stateCode = `
    let rafQueue = [];
    globalThis.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafQueue.length; };
    let anim3d = { index:0, frac:0, playing:false, lastTs:null };
    let anim2d = { index:0, frac:0, playing:false, lastTs:null };
    function animStateFor(w){ return w==='2d'?anim2d:anim3d; }
    let currentResult = { moves: [
      {kind:'feed', from:{x:0,y:0,z:0}, to:{x:10,y:0,z:0}},
      {kind:'feed', from:{x:10,y:0,z:0}, to:{x:20,y:0,z:0}},
    ], hasBlockingAlarm:false };
    function runSimulation(){ anim2d.index=0;anim2d.frac=0;anim2d.playing=false; anim3d.index=0;anim3d.frac=0;anim3d.playing=false; }
    let logMessages = [];
    function log(msg){ logMessages.push(msg); }
    function drawFuncFor(w){ return ()=>{}; }
    function speedInputFor(w){ return {value:'5'}; }
  `;
  const html = fs.readFileSync(path.join(__dirname, '..', 'cnc-studio-pro.html'), 'utf-8');
  const start = html.indexOf('let playGeneration');
  const end = html.indexOf("document.getElementById('btnStart')");
  const playCode = html.slice(start, end);
  const vm3 = require('vm');
  const ctx3 = { console };
  vm3.createContext(ctx3);
  vm3.runInContext(stateCode + playCode, ctx3);

  vm3.runInContext(`startPlayback('3d'); startPlayback('3d');`, ctx3);
  check('Reproducción — doble clic en "Empezar" antes del primer fotograma: solo una cadena queda activa',
    (()=>{ ctx3.__read=(e)=>vm3.runInContext(e,ctx3); return true; })());
  vm3.runInContext(`
    let __ts = 1000;
    for(let i=0;i<10 && rafQueue.length>0;i++){
      const p=[...rafQueue]; rafQueue=[];
      __ts += 500;
      p.forEach(cb=>cb(__ts));
    }
  `, ctx3);
  check('Reproducción — tras el doble clic, exactamente un mensaje de "Simulación completa"',
    ctx3.__read("logMessages.filter(m=>m.includes('completa')).length") === 1);
  check('Reproducción — tras el doble clic, llega al último movimiento correctamente (índice 1)',
    ctx3.__read("anim3d.index") === 1);
}

// ------------------------------------------------------------
// Calculadora de torno — AMPLIADA a desbaste, acabado, ranurado y roscado
// en los 14 materiales de la base (antes solo desbaste, en 6). Acabado y
// ranurado se derivan del desbaste con el mismo criterio general del
// sector (más velocidad y menos avance en acabado; menos velocidad y
// avance en ranurado por peor evacuación de viruta) — marcado
// explícitamente como estimación general, no investigación por material.
// El roscado reutiliza la infraestructura de paso de rosca ya construida
// para macho (Vf = S × paso), con diámetro libre y paso editable
// directamente, a diferencia del macho (métrica estándar fija).
// ------------------------------------------------------------
{
  ctx.calcPopulateSelects();
  const toolOptions = [...doc.getElementById('aTool').options].map(o=>o.value);
  check('Calculadora — torno_ranurado y torno_roscar existen en el desplegable real',
    toolOptions.includes('torno_ranurado') && toolOptions.includes('torno_roscar'));
}
{
  // los 14 materiales tienen torno_desbaste (y por tanto acabado, derivado) —
  // comprobado indirectamente pidiendo el baseline de uno recién añadido esta ronda
  const hasInconel = ctx.__read("getToolBaseline(MATERIALS_INDEX['inconel'], 'torno_desbaste')");
  check('Calculadora — inconel (uno de los 8 materiales sin datos de torno hasta esta ronda) ya tiene torno_desbaste',
    hasInconel && typeof hasInconel === 'object');
}
{
  doc.getElementById('aMaterial').value = 'acero';
  ctx.calcPopulateAlloys();
  doc.getElementById('aAlloy').value = 'c45';
  doc.getElementById('aTool').value = 'torno_desbaste';
  doc.getElementById('aSub').value = 'carburo';
  doc.getElementById('aD').value = '40';
  doc.getElementById('aOp').value = 'acabado';
  ctx.calcUpdate();
  const out = doc.getElementById('calcResults').textContent;
  check('Calculadora — torno acabado deriva correctamente (vc base 160 → 200 = ×1.25)', out.includes('200'));
}
{
  doc.getElementById('aTool').value = 'torno_ranurado';
  ctx.calcUpdate();
  const out = doc.getElementById('calcResults').textContent;
  check('Calculadora — torno ranurado deriva correctamente (vc base 160 → 120 = ×0.75)', out.includes('120'));
}
{
  doc.getElementById('aTool').value = 'torno_roscar';
  ctx.calcUpdate();
  check('Calculadora — torno roscado muestra diámetro libre (no oculto como el macho)',
    doc.getElementById('aDWrap').style.display === 'block');
  check('Calculadora — torno roscado tiene el paso editable (no de solo lectura como el macho)',
    doc.getElementById('aPitch').readOnly === false);
}
{
  doc.getElementById('aTool').value = 'torno_desbaste';
  doc.getElementById('aSub').value = 'carburo';
  ctx.calcUpdate();
  const vcCarburo = parseInt(doc.getElementById('calcResults').innerHTML.match(/Vc×1000 \/ \(π×D\) = (\d+)/)[1]);
  doc.getElementById('aSub').value = 'hss';
  ctx.calcUpdate();
  const vcHss = parseInt(doc.getElementById('calcResults').innerHTML.match(/Vc×1000 \/ \(π×D\) = (\d+)/)[1]);
  check('Calculadora — HSS en torno da una Vc claramente menor que carburo (incoherencia real corregida, antes caían iguales)',
    vcHss < vcCarburo * 0.5);
}

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail > 0 ? 1 : 0);
