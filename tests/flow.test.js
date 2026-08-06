// ============================================================
// tests/flow.test.js
//
// FLUJO COMPLETO desde que alguien abre la página por primera vez hasta
// que hace su primera simulación, más accesibilidad de los controles
// nuevos y el interruptor Aprendiz/Profesional.
//
// Existe para responder a una pregunta concreta: ¿puede un alumno que
// nunca ha tocado un CNC abrir esto y llegar solo a ver una pieza
// mecanizándose? Si algún paso de esta cadena se rompe, se rompe eso.
//
// Necesita jsdom:  npm install jsdom --no-save
// ============================================================
const { JSDOM } = require('jsdom'); const fs=require('fs');
const ctx2d=new Proxy({},{get:(t,k)=>{if(k==='measureText')return()=>({width:0});if(k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='getImageData')return()=>({data:[]});if(k==='getLineDash')return()=>[];return()=>{};},set:()=>true});
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','cnc-studio-pro.html'),'utf-8'),{runScripts:'dangerously',resources:'usable',url:'http://localhost/',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=(t)=>t==='2d'?ctx2d:null;w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:700,height:620,left:0,top:0,right:700,bottom:620});}});
setTimeout(()=>{
 const d=dom.window.document,W=dom.window; let p=0,f=0;
 const t=(n,c)=>{if(c){p++;console.log('\u2705',n);}else{f++;console.log('\u274c',n);}};
 console.log('--- FLUJO: abrir la pagina por primera vez ---');
 t('1. sale el asistente flotante solo, dando la bienvenida',d.getElementById('asistentePanel').style.display==='block');
 t('1b. el saludo se adapta a que el editor está vacío',/desde cero/i.test(d.getElementById('asistenteSaludo').textContent));
 t('2. el editor trae el esqueleto mínimo (sin BLK FORM precargado)',
   d.getElementById('code').value.includes('BEGIN PGM') && !d.getElementById('code').value.includes('BLK FORM'));
 console.log('--- FLUJO: un alumno que nunca ha tocado un CNC ---');
 W.eval("INTENTS.find(i=>i.t==='Nunca he tocado un CNC').run()");
 t('3. le carga un programa real',d.getElementById('code').value.split('\n').length>=8);
 t('4. le explica que esta viendo',d.getElementById('demoText').textContent.length>200);
 t('5. la explicacion menciona el bruto',/bruto/i.test(d.getElementById('demoText').textContent));
 t('6. le invita a cambiar algo y volver a simular',/cambia|prueba/i.test(d.getElementById('demoText').textContent));
 t('7. YA se ha simulado sin que el toque nada',W.eval('currentResult.moves.length')>0);
 t('8. la consola tiene mensajes',d.getElementById('console').children.length>0);
 console.log('--- FLUJO: primera simulacion propia ---');
 W.eval("codeEl.value=codeEl.value.replace('X+70','X+60'); runSimulation();");
 t('9. puede editar y volver a simular',W.eval('currentResult.moves.length')>0);
 t('10. no hay errores tras editar',W.eval('currentResult.errors.filter(e=>e.includes(String.fromCharCode(128680))).length')===0);
 console.log('--- ACCESIBILIDAD de lo nuevo ---');
 const nuevos=['btnTour','btnDemo','btnExplain','btnCopilot','btnCopilotCfg','copilotQ'];
 const sinEtiqueta=nuevos.filter(id=>{const el=d.getElementById(id); return !el||!(el.getAttribute('aria-label')||el.textContent.trim());});
 t('11. todos los controles nuevos tienen etiqueta accesible ('+(nuevos.length-sinEtiqueta.length)+'/'+nuevos.length+')',sinEtiqueta.length===0);
 t('12. el overlay del tutorial tiene rol de dialogo',d.getElementById('tourOverlay').getAttribute('role')==='dialog');
 t('13. el panel de config tiene rol de dialogo',d.getElementById('copilotCfgOverlay').getAttribute('role')==='dialog');
 console.log('--- MODO APRENDIZ / PROFESIONAL ---');
 t('14. arranca en modo Aprendiz',/Aprendiz/.test(d.getElementById('btnAssistMode').textContent));
 d.getElementById('btnAssistMode').dispatchEvent(new W.MouseEvent('click'));
 t('15. cambia a Profesional',/Profesional/.test(d.getElementById('btnAssistMode').textContent));
 d.getElementById('btnAssistMode').dispatchEvent(new W.MouseEvent('click'));
 t('16. vuelve a Aprendiz',/Aprendiz/.test(d.getElementById('btnAssistMode').textContent));
 console.log('\n'+p+' pasaron, '+f+' fallaron.'); process.exit(f>0?1:0);
},2600);
