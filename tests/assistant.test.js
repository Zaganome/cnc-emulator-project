// ============================================================
// tests/assistant.test.js
//
// ASISTENTE FLOTANTE — el rediseño que sustituyó al panel enterrado.
//
// Origen, documentado porque explica el diseño: varias funciones
// (Tutorial, Demostración, Explicar programa) "no hacían nada" según el
// usuario. La auditoría demostró que SÍ se ejecutaban, pero escribían en
// un panel situado entre el editor y la consola, sin ningún indicio de
// que algo hubiera cambiado. Ejecutarse sin que se note es, para quien lo
// usa, indistinguible de no funcionar.
//
// Y un bug real: startDemo() salía en silencio si no había movimientos,
// que es justo lo que pasa con el editor recién abierto.
//
// Necesita jsdom:  npm install jsdom --no-save
// ============================================================
const { JSDOM } = require('jsdom'); const fs=require('fs');
const ctx2d=new Proxy({},{get:(t,k)=>{if(k==='measureText')return()=>({width:0});if(k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='getImageData')return()=>({data:[]});if(k==='getLineDash')return()=>[];return()=>{};},set:()=>true});
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','cnc-studio-pro.html'),'utf-8'),{runScripts:'dangerously',resources:'usable',url:'http://localhost/',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=(t)=>t==='2d'?ctx2d:null;
  w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:700,height:620,left:0,top:0,right:700,bottom:620});}});
setTimeout(async()=>{
 const d=dom.window.document,W=dom.window; let p=0,f=0;
 const t=(n,c)=>{if(c){p++;console.log('\u2705',n);}else{f++;console.log('\u274c',n);}};
 const clic=id=>d.getElementById(id).dispatchEvent(new W.MouseEvent('click'));
 console.log('--- PLANTILLA MINIMA ---');
 t('editor sin BLK FORM precargado', !/BLK FORM/.test(d.getElementById('code').value));
 t('solo apertura y cierre', d.getElementById('code').value==='0 BEGIN PGM PROGRAMA MM\n1 END PGM PROGRAMA MM');
 console.log('--- BUG CORREGIDO: Demostracion con editor vacio ---');
 clic('btnDemo');
 t('ya NO falla en silencio', d.getElementById('demoBar').style.display==='block');
 t('explica por que y ofrece salida', /Cargar ejemplo|ejemplo/i.test(d.getElementById('demoText').textContent));
 console.log('--- ASISTENTE FLOTANTE ---');
 t('el personaje existe', !!d.getElementById('asistenteAvatar'));
 t('dibujado en SVG (sin imagenes externas)', d.getElementById('asistenteAvatar').innerHTML.includes('<svg'));
 t('es accesible por teclado', d.getElementById('asistenteAvatar').getAttribute('tabindex')==='0');
 t('tiene etiqueta accesible', !!d.getElementById('asistenteAvatar').getAttribute('aria-label'));
 t('se abre solo la primera vez', d.getElementById('asistentePanel').style.display==='block');
 t('trae los 8 botones rapidos', d.getElementById('asistenteAcciones').children.length===8);
 t('saludo contextual con editor vacio', /desde cero/i.test(d.getElementById('asistenteSaludo').textContent));
 clic('asistenteAvatar'); t('se puede minimizar', d.getElementById('asistentePanel').style.display==='none');
 clic('asistenteAvatar'); t('se puede volver a abrir', d.getElementById('asistentePanel').style.display==='block');
 console.log('--- REUTILIZA EL MOTOR ---');
 W.eval("ASISTENTE_ACCIONES.find(a=>a.t.includes('Aprender')).run()");
 t('Aprender desde cero carga programa', d.getElementById('code').value.split('\n').length>=8);
 t('saludo cambia al haber programa', /programando/i.test(d.getElementById('asistenteSaludo').textContent));
 W.eval("ASISTENTE_ACCIONES.find(a=>a.t.includes('Explicar')).run()");
 t('Explicar usa explainProgramLineByLine', d.getElementById('asistenteRespuesta').textContent.length>200);
 W.eval("ASISTENTE_ACCIONES.find(a=>a.t.includes('Corregir')).run()");
 t('Corregir usa el Asesor CNC', d.getElementById('asistenteRespuesta').style.display==='block');
 W.eval("ASISTENTE_ACCIONES.find(a=>a.t.includes('herramienta')).run()");
 t('Elegir herramienta usa TOOL_EXPLAIN', /fresa|broca/i.test(d.getElementById('asistenteRespuesta').textContent));
 d.getElementById('asistenteInput').value='¿qué es el cero pieza?';
 clic('asistenteEnviar'); await new Promise(r=>setTimeout(r,300));
 t('pregunta libre usa askCopilot', /Cero pieza/i.test(d.getElementById('asistenteRespuesta').textContent));
 t('marca la respuesta como verificada', /verificado/i.test(d.getElementById('asistenteRespuesta').innerHTML));
 console.log('\n'+p+' pasaron, '+f+' fallaron.'); process.exit(f>0?1:0);
},2600);
