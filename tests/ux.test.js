// ============================================================
// tests/ux.test.js
//
// Pruebas de la EXPERIENCIA DE USUARIO: recorrido guiado, panel
// "¿Qué quieres hacer?", modo demostración y ayuda contextual.
//
// A diferencia del resto de baterías, esta ARRANCA LA PÁGINA ENTERA y
// simula clics reales — es la única forma de comprobar que el recorrido
// encuentra las zonas de verdad y que los accesos directos dejan el
// programa preparado. Necesita jsdom:
//   npm install jsdom --no-save
//
// Ejecutar con: node tests/ux.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch(e){ console.log('❌ Necesita jsdom: npm install jsdom --no-save'); process.exit(1); }

const html = fs.readFileSync(path.join(__dirname,'..','cnc-studio-pro.html'),'utf-8');
// contexto 2D falso: devuelve una función para cualquier método, y valores mínimos
// para los pocos que se leen. Suficiente para que la interfaz arranque sin GPU.
const ctx2d = new Proxy({}, { get:(t,k)=>{
  if(k==='measureText') return ()=>({width:0});
  if(k==='createLinearGradient') return ()=>({addColorStop(){}});
  if(k==='getImageData') return ()=>({data:[]});
  if(k==='getLineDash') return ()=>[];
  return ()=>{};
}, set:()=>true });

const errores = [];
const dom = new JSDOM(html, {
  runScripts:'dangerously', resources:'usable', url:'http://localhost/', pretendToBeVisual:true,
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext = (t)=> t==='2d' ? ctx2d : null;
    w.HTMLCanvasElement.prototype.getBoundingClientRect = ()=>({width:700,height:620,left:0,top:0,right:700,bottom:620});
    w.addEventListener('error', e=>errores.push((e.error && e.error.message) || String(e.error)));
  }
});

setTimeout(()=>{
  const d = dom.window.document, W = dom.window;
  let pass=0, fail=0;
  const check=(n,c)=>{ if(c){pass++;console.log('✅',n);} else {fail++;console.log('❌',n);} };
  const clic=(id)=> d.getElementById(id).dispatchEvent(new W.MouseEvent('click'));

  // El arranque no debe lanzar nada sin capturar. Se descarta WebGL: en un entorno
  // sin GPU su ausencia es esperada y el propio simulador ya la maneja avisando.
  check('Arranque sin errores JavaScript sin capturar',
    errores.filter(e=>!/WebGL/i.test(e||'')).length === 0);

  check('Existe el botón "Tutorial" (volver a ver el recorrido)', !!d.getElementById('btnTour'));
  check('Existe el botón "Demostración"', !!d.getElementById('btnDemo'));

  // Primera visita: la bienvenida la da ahora el ASISTENTE FLOTANTE. Antes se abría
  // el panel de intenciones solo; tener dos paneles abriéndose a la vez confundía,
  // así que el asistente es el único que saluda. El panel de intenciones sigue
  // disponible desde el botón "Tutorial" y desde el propio asistente.
  check('Primera visita: se abre solo el asistente flotante',
    d.getElementById('asistentePanel').style.display === 'block');
  check('El asistente trae sus acciones rápidas', d.getElementById('asistenteAcciones').children.length >= 8);

  // El panel "¿Qué quieres hacer?" se abre desde el botón Tutorial
  clic('btnTour');
  check('El botón Tutorial abre "¿Qué quieres hacer?"',
    d.getElementById('intentOverlay').style.display === 'flex');
  check('El panel trae todos los accesos directos', d.getElementById('intentGrid').children.length >= 7);

  // Recorrido guiado
  clic('intentTour');
  check('El recorrido se abre desde el panel', d.getElementById('tourOverlay').style.display === 'block');
  const t1 = d.getElementById('tourTitle').textContent;
  check('El primer paso tiene título y texto',
    t1.length > 0 && d.getElementById('tourText').textContent.length > 30);
  check('Muestra el contador de pasos', /Paso \d+ de \d+/.test(d.getElementById('tourCount').textContent));
  clic('tourNext');
  check('Avanza al paso siguiente', d.getElementById('tourTitle').textContent !== t1);
  clic('tourPrev');
  check('Vuelve al paso anterior', d.getElementById('tourTitle').textContent === t1);
  clic('tourSkip');
  check('Se cierra al salir', d.getElementById('tourOverlay').style.display === 'none');
  check('Recuerda que ya se vio (localStorage)', W.eval('tourSeen()') === true);
  W.eval('resetTourSeen()');
  check('Se puede volver a ver desde cero', W.eval('tourSeen()') === false);

  // Cada acceso directo debe DEJAR TRABAJO HECHO, no solo navegar.
  W.eval("INTENTS.find(i=>i.t==='Quiero hacer una ranura').run()");
  check('Acceso "ranura": deja un G88 en el editor', d.getElementById('code').value.includes('G88'));
  check('Acceso "ranura": cambia a modo torno', W.eval('mode') === 'lathe');
  check('Acceso "ranura": explica el ciclo al usuario', d.getElementById('demoText').textContent.length > 40);
  W.eval("INTENTS.find(i=>i.t==='Quiero hacer una cajera').run()");
  check('Acceso "cajera": deja un CYCL DEF 251 en el editor', d.getElementById('code').value.includes('251'));
  check('Acceso "cajera": cambia a modo fresadora', W.eval('mode') === 'mill');
  W.eval("INTENTS.find(i=>i.t==='Quiero programar un refrentado').run()");
  check('Acceso "refrentado": deja un G82 en el editor', d.getElementById('code').value.includes('G82'));

  // Ayuda contextual: debe explicar LO SELECCIONADO, no un listado genérico.
  W.eval("explainSelectedTool('torno_ranurado')");
  check('Explica la herramienta seleccionada (ranurar/tronzar)',
    /ranurar|tronzar/i.test(d.getElementById('demoText').textContent));
  W.eval("explainSelectedTool('broca')");
  check('Al cambiar de herramienta explica la NUEVA (broca)',
    /broca/i.test(d.getElementById('demoTitle').textContent + d.getElementById('demoText').textContent));
  W.eval("explainSelectedMaterial('titanio')");
  check('Explica el material seleccionado (titanio)', /Titanio/i.test(d.getElementById('demoTitle').textContent));

  // Modo demostración
  W.eval("setDialect('iso'); setMode('lathe'); codeEl.value='%\\nO0001\\n(STOCK D60 Z-80)\\nT1 M6\\nS1200 M3 M8\\nG0 X65 Z2\\nG81 X40 Z0 Q40 R-50 C2 D1\\nG0 X100 Z50\\nM30\\n%'; runSimulation();");
  check('El programa de demostración simula y genera movimientos', W.eval('currentResult.moves.length') > 0);
  W.eval('startDemo()');
  check('La demostración arranca y queda activa', W.eval('demoTimer !== null'));
  W.eval('stopDemo()');
  check('La demostración se puede parar', W.eval('demoTimer === null'));
  // La narración NO se inventa: sale del mismo conocimiento verificado del asistente.
  check('La narración usa el conocimiento verificado del asistente',
    /Torneado/.test(W.eval("JSON.stringify(detectCycleAtCursor('G81 X40 Z0 Q40 R-50 C2 D1','iso','lathe'))")));

  console.log(`\n${pass} pasaron, ${fail} fallaron.`);
  process.exit(fail > 0 ? 1 : 0);
}, 2500);
