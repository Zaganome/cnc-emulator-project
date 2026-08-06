// ============================================================
// tests/ai-connect.test.js
//
// Conexión REAL de la IA (BYOK) y explicación del programa línea por línea.
//
// Lo más importante que comprueba: que SIN IA configurada NO sale ninguna
// petición de red. El simulador debe seguir siendo un archivo estático que
// funciona desde disco; la IA es estrictamente opcional.
//
// También comprueba que un fallo de red se explica con claridad y NO deja
// la IA marcada como conectada, y que el copiloto responde igual sin ella.
//
// Necesita jsdom:  npm install jsdom --no-save
// ============================================================
const { JSDOM } = require('jsdom'); const fs=require('fs');
const ctx2d=new Proxy({},{get:(t,k)=>{if(k==='measureText')return()=>({width:0});if(k==='createLinearGradient')return()=>({addColorStop(){}});if(k==='getImageData')return()=>({data:[]});if(k==='getLineDash')return()=>[];return()=>{};},set:()=>true});
const errs=[]; let fetchCalls=0;
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','cnc-studio-pro.html'),'utf-8'),{runScripts:'dangerously',resources:'usable',url:'http://localhost/',pretendToBeVisual:true,
 beforeParse(w){w.HTMLCanvasElement.prototype.getContext=(t)=>t==='2d'?ctx2d:null;w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:700,height:620,left:0,top:0,right:700,bottom:620});
  w.fetch=(...a)=>{fetchCalls++; return Promise.reject(new Error('red bloqueada en la prueba'));};
  w.addEventListener('error',e=>errs.push((e.error&&e.error.message)||String(e.error)));}});
setTimeout(async()=>{
 const d=dom.window.document,W=dom.window; let p=0,f=0;
 const t=(n,c)=>{if(c){p++;console.log('\u2705',n);}else{f++;console.log('\u274c',n);}};
 t('arranque sin errores',errs.filter(e=>!/WebGL/i.test(e||'')).length===0);
 t('SIN IA configurada no sale ninguna peticion de red',fetchCalls===0 && W.eval('copilotDisponible()')===false);
 // configuracion
 
 t('Groq es el recomendado',/recomendado/.test(W.eval('COPILOT_PRESETS[0].label')));
 t('estan los 7 proveedores estudiados en el orden previsto',W.eval("COPILOT_PRESETS.map(p=>p.id).join(',')")==='groq,openrouter,gemini,openai,claude,ollama,lmstudio');
 d.getElementById('btnCopilotCfg').dispatchEvent(new W.MouseEvent('click'));
 t('el panel de configuracion se abre',d.getElementById('copilotCfgOverlay').style.display==='flex');
 t('rellena URL y modelo del preset',d.getElementById('cfgBaseUrl').value.includes('groq') && d.getElementById('cfgModel').value.length>3);
 t('avisa de que la clave se queda en el navegador',/solo|únicamente/i.test(d.getElementById('copilotCfgOverlay').textContent));
 // probar conexion con red caida -> mensaje claro, no excepcion
 d.getElementById('cfgKey').value='clave-de-prueba';
 d.getElementById('cfgTest').dispatchEvent(new W.MouseEvent('click'));
 await new Promise(r=>setTimeout(r,400));
 t('si la red falla lo dice con claridad',/No se ha podido conectar/.test(d.getElementById('cfgStatus').textContent));
 t('el fallo de red NO deja la IA marcada como conectada',W.eval('copilotDisponible()')===false);
 // el copiloto sigue respondiendo sin IA
 const r=await W.eval("askCopilot('¿qué es el cero pieza?')");
 t('el copiloto responde igual sin IA',r.fuente==='reglas'&&/Cero pieza/i.test(r.titulo));
 // desconectar
 d.getElementById('cfgClear').dispatchEvent(new W.MouseEvent('click'));
 t('se puede desconectar la IA',W.eval('copilotDisponible()')===false);
 // explicacion linea por linea
 W.eval("setDialect('heidenhain'); setMode('mill'); codeEl.value='0 BEGIN PGM P MM\\n1 BLK FORM 0.1 Z X+0 Y+0 Z-10\\n2 BLK FORM 0.2 X+80 Y+60 Z+0\\n3 TOOL CALL 1 Z S2000\\n4 L X+10 Y+30 Z+2 R0 FMAX M13\\n5 L Z-3 F150\\n6 L X+70 F300\\n7 L Z+150 R0 FMAX\\n8 END PGM P MM'; runSimulation();");
 const filas=W.eval('explainProgramLineByLine()');
 t('explica el programa linea por linea ('+filas.length+' bloques)',filas.length>=7);
 t('distingue rapido de corte',filas.some(x=>/RÁPIDO/.test(x.exp))&&filas.some(x=>/TRABAJO/.test(x.exp)));
 t('explica el bruto',filas.some(x=>/BRUTO/.test(x.exp)));
 t('explica el cambio de herramienta',filas.some(x=>/herramienta T1/.test(x.exp)));
 d.getElementById('btnExplain').dispatchEvent(new W.MouseEvent('click'));
 t('el boton muestra la explicacion',/línea por línea/.test(d.getElementById('cycleHelp').innerHTML));
 t('hay 7 proveedores (Groq, OpenRouter, Gemini, OpenAI, Claude, Ollama, LM Studio)',W.eval('COPILOT_PRESETS.length')===7);
 t('OpenAI y Claude disponibles',W.eval("COPILOT_PRESETS.some(x=>x.id==='openai')&&COPILOT_PRESETS.some(x=>x.id==='claude')"));
 t('Claude tiene adaptador propio (formato distinto al de OpenAI)',W.eval("typeof COPILOT_PROVIDERS.anthropic.build")==='function');
 {
  const req=W.eval("JSON.stringify(COPILOT_PROVIDERS.anthropic.build({apiKey:'k',model:'m'},[{role:'system',content:'S'},{role:'user',content:'U'}]))");
  t('Claude envia la cabecera que Anthropic exige para llamadas desde navegador',/anthropic-dangerous-direct-browser-access/.test(req));
 }
 console.log('\n'+p+' pasaron, '+f+' fallaron.'); process.exit(f>0?1:0);
},2600);
