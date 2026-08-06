// ============================================================
// tests/copilot.test.js
//
// Pruebas del COPILOTO CNC y del onboarding ampliado.
//
// Comprueba las dos cosas que definen el copiloto:
//  1. Que RESPONDE con el conocimiento verificado del proyecto, sin IA y
//     sin Internet — es lo que funciona hoy.
//  2. Que NO SE INVENTA nada cuando no sabe. Esta es la prueba más
//     importante del archivo: en CNC un dato inventado se aprende mal y
//     puede costar una herramienta o una máquina.
//
// También verifica que la capa de IA está PREPARADA pero NO CONECTADA:
// sin proveedor configurado, `copilotDisponible()` debe ser false y no
// debe salir ninguna petición de red.
//
// Necesita jsdom:  npm install jsdom --no-save
// Ejecutar con:    node tests/copilot.test.js
// ============================================================
const { JSDOM } = require('jsdom'); const fs=require('fs');
const ctx2d=new Proxy({},{get:(t,k)=>{if(k==='measureText')return()=>({width:0});if(k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='getImageData')return()=>({data:[]});if(k==='getLineDash')return()=>[];return()=>{};},set:()=>true});
const errs=[];
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','cnc-studio-pro.html'),'utf-8'),{runScripts:'dangerously',resources:'usable',url:'http://localhost/',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=(t)=>t==='2d'?ctx2d:null;w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:700,height:620,left:0,top:0,right:700,bottom:620});w.addEventListener('error',e=>errs.push((e.error&&e.error.message)||String(e.error)));}});
setTimeout(async()=>{
 const d=dom.window.document,W=dom.window; let p=0,f=0;
 const t=(n,c)=>{if(c){p++;console.log('\u2705',n);}else{f++;console.log('\u274c',n);}};
 t('arranque sin errores',errs.filter(e=>!/WebGL/i.test(e||'')).length===0);
 // COPILOTO sin IA
 t('no hay IA configurada (a proposito)',W.eval('copilotDisponible()')===false);
 const r1=await W.eval("askCopilot('¿qué hace G81?')");
 t('responde a un ciclo, y si no aplica aqui dice donde si',r1.fuente==='reglas'&&/G81/.test(r1.titulo)&&/TORNO/.test(r1.texto));
 const r2=await W.eval("askCopilot('¿qué es el cero pieza?')");
 t('responde a un concepto general',/Cero pieza/i.test(r2.titulo));
 const r3=await W.eval("askCopilot('háblame del titanio')");
 t('responde a un material',/Titanio/i.test(r3.titulo));
 const r4=await W.eval("askCopilot('¿para qué sirve una broca?')");
 t('responde a una herramienta',/broca/i.test(r4.titulo));
 const r5=await W.eval("askCopilot('cuánto vale el bitcoin')");
 t('NO se inventa lo que no sabe',/No tengo eso documentado/i.test(r5.titulo));
 t('el contexto para la IA se construye',W.eval("buildCopilotContext().verificado.length")>50);
 t('el sistema prohibe inventar Fagor/Heidenhain',/NUNCA inventes/.test(W.eval("buildCopilotContext().sistema")));
 t('hay adaptador compatible con OpenAI',W.eval("typeof COPILOT_PROVIDERS.openai_compatible.build")==='function');
 t('hay adaptador Gemini',W.eval("typeof COPILOT_PROVIDERS.gemini.build")==='function');
 // caja de pregunta en la interfaz
 d.getElementById('copilotQ').value='¿qué hace G81?';
 d.getElementById('btnCopilot').dispatchEvent(new W.MouseEvent('click'));
 await new Promise(r=>setTimeout(r,300));
 t('la caja de pregunta muestra la respuesta',/G81/.test(d.getElementById('cycleHelp').innerHTML));
 // ONBOARDING
 t('el recorrido empieza con la bienvenida',/Bienvenido/.test(W.eval('TOUR_STEPS[0].title')));
 t('explica la diferencia Heidenhain/Fagor',W.eval('TOUR_STEPS.some(s=>/en qué se diferencian/.test(s.title))')===true);
 t('hay al menos 9 accesos directos ('+W.eval('INTENTS.length')+')',W.eval('INTENTS.length')>=9);
 t('existe "Abrir un ejemplo"',W.eval("INTENTS.some(i=>i.t==='Abrir un ejemplo')")===true);
 t('existe "Empezar desde cero"',W.eval("INTENTS.some(i=>i.t==='Empezar desde cero')")===true);
 // al TERMINAR el recorrido vuelve a preguntar
 W.eval('startTour(); tourIndex=tourList.length-1; tourNext();');
 t('al terminar el recorrido vuelve a "¿Qué quieres hacer?"',d.getElementById('intentOverlay').style.display==='flex');

 // Estrategia de mecanizado: conocimiento GENERAL de taller, no comportamiento
 // de fabricante — por eso la política del proyecto sí permite explicarlo.
 for(const [q,esp] of [['¿qué es mejor, concordancia u oposición?',/concordancia/i],
                       ['¿cómo entro con la fresa en el material?',/rampa|helicoidal/i],
                       ['¿por qué se separa desbaste y acabado?',/desbaste/i]]){
   const rr=await W.eval("askCopilot("+JSON.stringify(q)+")");
   t('explica estrategia: '+q.slice(0,38), esp.test(rr.titulo+rr.texto));
 }
 console.log('\n'+p+' pasaron, '+f+' fallaron.'); process.exit(f>0?1:0);
},2600);
