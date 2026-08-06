// ============================================================
// tests/robustness.test.js
//
// Condiciones límite y entradas reales que rompen simuladores.
//
// Nació de un fallo GRAVE encontrado ejecutando, no leyendo: al copiar un
// ejercicio desde un PDF o una web (lo que hace cualquier alumno con los
// apuntes del profesor), el texto trae caracteres que PARECEN ASCII y no
// lo son. El espacio no separable dejaba el programa en 38 de 623
// movimientos, y el guion tipográfico de Word convertía "Z-15" en "Z+2"
// —cambiando el signo— sin un solo aviso.
//
// Ejecutar con: node tests/robustness.test.js   (sin dependencias)
// ============================================================
const fs = require('fs');
const path = require('path');

function loadEngine(){
  const html = fs.readFileSync(path.join(__dirname,'..','cnc-studio-pro.html'),'utf-8');
  const full = /<script>([\s\S]*)<\/script>/.exec(html)[1];
  const sandbox = { toolTable:{}, mode:'mill', renderToolTableUI:()=>{}, runSimulation:()=>{}, console };
  const vm = require('vm'); vm.createContext(sandbox);
  for(const [a,b] of [['const TOOL_TYPES','function nextFreeToolNum'],
                      ['function generatePatternPositions','// ============================================================\n// RENDER 2D']]){
    const s = full.indexOf(a), e = full.indexOf(b);
    if(s<0||e<0) throw new Error('Marcadores de extracción no encontrados: '+a);
    vm.runInContext(full.slice(s,e), sandbox);
  }
  return sandbox;
}
let pass=0, fail=0;
const check=(d,c)=>{ if(c){pass++;console.log('✅',d);} else {fail++;console.log('❌',d);} };
const E = loadEngine();

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
const REF = refPath('T12.txt');
const base = fs.existsSync(REF) ? fs.readFileSync(REF,'utf-8') : null;

function sim(src, md, dlt){
  E.toolTable={}; E.mode=md;
  const st = dlt==='heidenhain' ? E.parseHeidenhain(src) : E.parseISO(src, md);
  return E.buildMoves(st, md, dlt);
}
function noRompe(desc, fn, msMax){
  const t0=Date.now();
  try { fn(); check(`${desc} (${Date.now()-t0}ms)`, Date.now()-t0 < (msMax||5000)); }
  catch(e){ check(`${desc} — lanzó: ${e.message}`, false); }
}

// ---- CARACTERES INVISIBLES (el fallo real que originó este archivo) ----
if(base){
  check('Espacio no separable (copiar de PDF/web) NO rompe el programa',
    sim(base.replace(/ /g,'\u00A0'),'mill','heidenhain').moves.length === 623);
  check('Espacio fino NO rompe el programa',
    sim(base.replace(/ /g,'\u2009'),'mill','heidenhain').moves.length === 623);
  check('BOM al principio del archivo', sim('\uFEFF'+base,'mill','heidenhain').moves.length === 623);
  check('Archivo de Windows (CRLF)', sim(base.replace(/\n/g,'\r\n'),'mill','heidenhain').moves.length === 623);
  check('Programa limpio no reporta caracteres invisibles', E.contarCaracteresInvisibles(base) === 0);
} else {
  console.log('ℹ  T12.txt no encontrado junto al repositorio — pruebas con programa real omitidas.');
}
{
  const prog='0 BEGIN PGM X MM\n1 BLK FORM 0.1 Z X+0 Y+0 Z-20\n2 BLK FORM 0.2 X+50 Y+50 Z+0\n3 L X+10 Y+10 Z+2 R0 FMAX\n4 L Z-15 F100\n5 END PGM X MM';
  const zn = sim(prog,'mill','heidenhain').moves.slice(-1)[0].to.z;
  const zw = sim(prog.replace(/-/g,'\u2013'),'mill','heidenhain').moves.slice(-1)[0].to.z;
  check('CRÍTICO — el guion tipográfico de Word NO cambia el signo de la coordenada', zw === zn && zn === -15);
  check('Se cuentan los caracteres invisibles para poder avisar al usuario',
    E.contarCaracteresInvisibles('L X\u00A0+10 Z\u201315') === 2);
}

// ---- PROGRAMAS RAROS ----
noRompe('Programa vacío', ()=>sim('','mill','heidenhain'));
noRompe('Solo espacios y saltos de línea', ()=>sim('   \n\n\t  \n','mill','heidenhain'));
noRompe('Solo comentarios', ()=>sim('; uno\n; dos','mill','heidenhain'));
noRompe('Contenido binario / corrupto', ()=>sim('\x00\x01\x02\xff ABC \x00','mill','heidenhain'));
noRompe('20.000 líneas', ()=>sim('0 BEGIN PGM X MM\n'+Array(20000).fill('L X+10 Y0 F100').join('\n')+'\n2 END PGM X MM','mill','heidenhain'), 8000);
noRompe('Una línea de 200.000 caracteres', ()=>sim('0 BEGIN PGM X MM\nL X+10 Y0 F100 ;'+'a'.repeat(200000)+'\n2 END PGM X MM','mill','heidenhain'));
noRompe('Literal Infinity en una coordenada', ()=>sim('0 BEGIN PGM X MM\nL X+Infinity Y0 F100\n2 END PGM X MM','mill','heidenhain'));
noRompe('Coma decimal europea (10,5)', ()=>sim('0 BEGIN PGM X MM\nL X+10,5 Y0 F100\n2 END PGM X MM','mill','heidenhain'));
noRompe('Etiquetas anidadas 30 niveles', ()=>{
  let s='0 BEGIN PGM X MM\n';
  for(let i=1;i<=30;i++) s+=`LBL ${i}\nL X+${i} F100\nCALL LBL ${i+1}\nLBL 0\n`;
  return sim(s+'CALL LBL 1\n2 END PGM X MM','mill','heidenhain');
});
if(base) noRompe('Mismo programa simulado 50 veces seguidas', ()=>{ for(let i=0;i<50;i++) sim(base,'mill','heidenhain'); }, 8000);

console.log(`\n${pass} pasaron, ${fail} fallaron.`);
process.exit(fail>0?1:0);
