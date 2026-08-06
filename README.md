# CNC Studio Pro

Simulador CNC en el navegador — un único archivo HTML, sin instalación, sin build, sin dependencias que compilar. Compatible con **Heidenhain Klartext** y **Fagor ISO**, con modos independientes de **fresadora** y **torno**.

> ⚠️ Proyecto en desarrollo activo (v0.x). Pensado como herramienta de apoyo para formación y programación CNC — no como sustituto de la verificación en un control real antes de mecanizar una pieza.

<!-- TODO: añadir aquí una captura o GIF de la simulación en marcha (fresadora + torno).
     Es lo primero que va a ver alguien que llegue al repositorio — vale más que
     cualquier párrafo de descripción. -->

## Qué es esto

Un simulador 2D/3D de trayectorias CNC que interpreta programas reales (Heidenhain Klartext o ISO/Fagor), calcula el recorrido de la herramienta y lo representa gráficamente — incluyendo eliminación de material en tiempo real sobre el bruto, para ver de verdad qué queda de la pieza, no solo por dónde pasó la herramienta.

## Requisitos

Un navegador moderno con soporte WebGL. Nada más — no hay instalación, ni Node, ni build.

## Cómo usarlo

Abre `cnc-studio-pro.html` directamente en el navegador, o publícalo en GitHub Pages para acceder desde una URL. Pega o escribe tu programa CNC en el editor, elige el dialecto (Heidenhain / ISO) y el modo (fresadora / torno), y simula.

Para una guía de uso completa (controles, calculadora, avisos, preguntas frecuentes), consulta el [Manual de usuario](MANUAL.md).

## Cobertura funcional

### Fresadora

| Funcionalidad | Heidenhain | Fagor ISO | Estado |
|---|---|---|---|
| Interpolación lineal/circular | ✅ | ✅ | Implementado |
| Compensación de radio de herramienta (RR/RL) | ✅ | ✅ | Implementado, con motor geométrico propio verificado |
| Ciclos de taladrado/roscado (drilling, tapping) | ✅ | ✅ | Implementado |
| Ciclos de cajera (rectangular, circular) | ✅ | ✅ | Implementado |
| Traslados/giros/espejo de coordenadas | ✅ | ⚠️ | Parcial — ver limitaciones |
| Plano inclinado (CYCL DEF 19) | ⚠️ | — | Reconocido, sin efecto geométrico |
| Programación de contorno libre (FK) | ❌ | — | No implementado |
| Sondas de contacto | ❌ | ❌ | No implementado |

### Torno

| Funcionalidad | Heidenhain | Fagor ISO | Estado |
|---|---|---|---|
| Torneado de tramos rectos | ✅ | ✅ (G81) | Implementado y verificado |
| Refrentado de tramos rectos | ✅ | ✅ (G82) | Implementado y verificado |
| Taladrado axial / roscado con macho | ✅ | ✅ (G83) | Implementado y verificado |
| Torneado de tramos curvos | ✅ | ✅ (G84) | Implementado y verificado contra ejemplo numérico real de Fagor |
| Refrentado de tramos curvos | ✅ | ✅ (G85) | Implementado y verificado |
| Desbastado de perfil completo (rectas+arcos encadenados) | — | ✅ (G68/G69) | Implementado — sin pasada de acabado todavía; perfiles cerrados sin verificar |
| Ranurado | ✅ | ✅ (G88/G89) | Implementado — interfaz verificada, un parámetro (K) aceptado sin uso confirmado |
| Roscado | ✅ | ❌ | **Bloqueado**: requiere avance sincronizado con el husillo (paso de rosca), capacidad no implementada en el simulador |

**Leyenda**: ✅ Implementado y verificado · ⚠️ Parcial (funciona con aproximaciones documentadas) · ❌ No implementado · — No aplica a ese dialecto/máquina

## Asistente de programación — "profesor CNC"

Tiene dos partes que funcionan juntas:

**1. Ayuda contextual (referencia).** Al situar el cursor sobre un ciclo reconocido (Heidenhain, Fagor fresadora o Fagor torno), muestra su explicación, cada parámetro, y su estado real (implementado/parcial/bloqueado). Los avisos de la consola son clicables y abren una explicación ampliada; cuando la corrección es inequívoca (tipo de herramienta equivocado), ofrece además un botón que la aplica.

**2. Asesor CNC (motor de reglas extensible).** Tras cada simulación, analiza el programa **entero** y señala lo que no es un error de sintaxis pero sí un problema real: riesgos de seguridad, malas prácticas, código muerto y redundancias. Cada hallazgo se presenta con tres piezas, y esa estructura es lo que lo convierte en un profesor y no en un simple validador:

- **Qué** se ha encontrado, con datos concretos del programa.
- **Por qué** importa (el "porqué" es lo que enseña).
- **Cómo** se hace bien.

Reglas actuales (13):

*Seguridad* — velocidad de husillo (S) no programada · husillo nunca arrancado (sin M3/M4/M13/M14) · refrigerante nunca activado · penetración axial mayor que el diámetro de la fresa · el programa termina sin retirar la herramienta · la herramienta corta muy por debajo del bruto (riesgo de mordaza o mesa).

*Código muerto* — herramienta definida y nunca usada · etiqueta definida y nunca llamada · **ciclo fijo definido y nunca ejecutado** (CYCL DEF sin CYCL CALL, M99 ni M89: error clásico, el programa simula sin fallos y la pieza sale en bruto).

*Torno* — el corte pasa del eje de la pieza (X0 es el eje de giro; suele ser un signo cambiado o radios donde el control espera diámetros) · el programa de torno termina sin retirar la herramienta del diámetro del bruto.

*Redundancia y criterio* — cambio de herramienta redundante · programa que no llega a cortar nada.

**Arquitectura, para quien vaya a ampliarlo**: añadir conocimiento nuevo = añadir **una entrada** a `ADVISOR_RULES`. No hay que tocar nada más. Cada regla es independiente, recibe el contexto completo (sentencias, movimientos, tabla de herramientas, bruto, texto fuente) y devuelve `null` o un hallazgo. Una regla que lance una excepción no tumba ni el análisis ni la simulación. El asesor está **separado a propósito** del motor de simulación: `buildMoves()` detecta errores *durante* la ejecución (necesita el estado intermedio); el asesor analiza el programa *ya simulado* (necesita verlo entero).

**Criterio de calidad de las reglas — importante si añades más.** Los umbrales son deliberadamente conservadores, y hay dos reglas que se escribieron, se probaron contra los 4 programas reales de referencia y **se retiraron** por dar falsos positivos (ver comentarios en el código). Un aviso que salta cuando no debe enseña al alumno a ignorar *todos* los avisos, que es peor que no tenerlo. La batería `tests/advisor.test.js` comprueba las dos caras: que no salte en programas correctos, y que sí salte cuando corresponde.

No es una IA conversacional. Ver `ESTUDIO_IA.md` para el análisis técnico completo de si merece la pena añadir una, con qué arquitectura, y por qué no se ha hecho todavía.

## Experiencia de usuario — se enseña solo

**Primera vez que se abre**: aparece el panel **"¿Qué quieres hacer?"** con accesos directos (aprender Heidenhain, aprender Fagor, torno, fresadora, refrentado, cajera, ranura). Cada uno **deja el programa preparado y explica qué se está viendo** — no son atajos de navegación, dejan trabajo hecho sobre el que seguir. Se recuerda en `localStorage` que ya se vio; el botón **🎓 Tutorial** lo reabre cuando se quiera.

**Recorrido guiado**: 12 pasos que resaltan visualmente cada zona real de la interfaz (editor, dialecto, fresadora/torno, simulación, vista 3D, vista 2D, tabla de herramientas, calculadora, asistente, consola con alarmas y asesor, importación/exportación, configuración de vista). Navegable con botones o con las flechas del teclado; Escape sale.

**Modo demostración** (botón ▶): reproduce un programa y va narrando lo que ocurre — qué ciclo se ejecuta, qué hace la herramienta y por qué. **La narración no se inventa**: sale del mismo `detectCycleAtCursor` que usa el asistente, así que nunca puede contradecir a la documentación verificada del proyecto.

**Ayuda contextual real**: al elegir un tipo de herramienta en la tabla se explica *esa* herramienta; al elegir un material en la calculadora se explica *ese* material, con su grupo ISO y su fuerza específica de corte. El usuario no tiene que ir a buscar documentación.

### Arquitectura (para quien la amplíe)

**Cero librerías externas** — nada de Shepherd.js ni intro.js: añadirían una dependencia de red que rompería el uso desde disco y la filosofía de archivo único. El foco se consigue con un rectángulo posicionado sobre la zona real más un `box-shadow` gigante que oscurece el resto, sin clonar ni mover ningún elemento.

**El recorrido apunta a los IDs reales** de la interfaz. Si una zona no existe o no está visible, ese paso se salta solo. Si el filtro de visibilidad no dejara ninguno, se usan todos los que existan: un tutorial que no arranca y no dice por qué es peor que uno que enseña un paso de más.

**`localStorage` siempre entre `try/catch`**: abriendo el archivo desde disco (`file://`) algunos navegadores lanzan al tocarlo. Si falla, el tutorial sigue funcionando, simplemente no recuerda que ya se vio.

**Todo el JavaScript va dentro del único bloque `<script>` existente**, no en uno nuevo: las baterías de pruebas extraen el motor con una expresión que se rompería con un segundo bloque.

Ampliar cuesta una entrada: un paso más = una entrada en `TOUR_STEPS`; un acceso directo más = una en `INTENTS`.

## Asistente flotante

Un **calibre pie de rey con birrete**, dibujado en SVG dentro del propio archivo (sin imágenes ni dependencias), fijo en la esquina inferior derecha. Se minimiza con un clic y es accesible por teclado.

Al abrir el simulador da la bienvenida y **se adapta a lo que hay en el editor**: si está vacío ofrece empezar de cero; si hay programa dice qué máquina y dialecto detecta, cuántas líneas hay y cuántos avisos ha encontrado el Asesor.

Ocho acciones rápidas, más un campo para preguntas libres. **Ninguna duplica lógica**: cada una llama a lo que ya existía y estaba probado (`INTENTS`, `explainProgramLineByLine`, `lastAdvisorFindings`, `askCopilot`, `startTour`, las funciones guiadas de inserción y la calculadora).

**Por qué existe.** Varias funciones "no hacían nada" según el usuario. La auditoría demostró que **sí se ejecutaban**, pero escribían en un panel enterrado entre el editor y la consola, sin ningún indicio de que algo hubiera cambiado. Ejecutarse sin que se note es, para quien lo usa, indistinguible de no funcionar. Además `startDemo()` **salía en silencio** cuando no había movimientos — justo lo que ocurre con el editor recién abierto. Ambas cosas están corregidas y fijadas en `tests/assistant.test.js`.

El editor arranca ahora con lo mínimo (`BEGIN PGM` / `END PGM`, sin BLK FORM): el bruto se construye conversando con el asistente, porque una plantilla a medias invita a rellenar huecos sin entender qué son.

## Copiloto CNC

Caja de pregunta en la barra del asistente: se le escribe en lenguaje natural ("¿qué hace G81?", "¿qué es el cero pieza?", "háblame del titanio") y responde con el **conocimiento ya verificado del proyecto** — ciclos, herramientas, materiales, alarmas y conceptos generales de mecanizado.

**Lo más importante es lo que NO hace**: si no tiene la respuesta documentada, lo dice. No improvisa. Hay una prueba automatizada dedicada a esto, porque en CNC un dato inventado se aprende mal y puede costar una herramienta o una máquina.

Detalle útil en clase: si preguntas por un código que no existe en el modo actual (por ejemplo G81 estando en Heidenhain fresadora), busca en las otras combinaciones y te dice **dónde sí significa algo** — es el lío más habitual al empezar.

### Explicación línea por línea
Botón **📖 Explicar mi programa**: recorre el programa entero y explica cada bloque — qué es el bruto, qué hace un cambio de herramienta, si un movimiento es rápido (por el aire) o de trabajo (cortando), qué significa cada ciclo, y el aviso de que definir un ciclo no lo ejecuta. Totalmente local, sin IA.

### Capa de IA: CONECTABLE (BYOK), opcional

**Ya se puede conectar una IA de verdad**, con el botón ⚙ junto a la caja del copiloto. Cinco proveedores con preset verificado:

| Proveedor | Por qué |
|---|---|
| **Groq** *(recomendado)* | Los mejores límites gratuitos publicados (~30 pet/min), sin tarjeta, muy rápido, compatible con OpenAI. |
| **OpenRouter** | Una clave para decenas de modelos. Su catálogo gratuito **rota**, por eso el modelo es editable y no está fijado por dentro. |
| **Gemini (BYOK)** | Clave gratuita sin tarjeta. Dos avisos: Google dejó de publicar los límites, y en el nivel gratuito puede usar los prompts para entrenar. |
| **OpenAI / Claude (BYOK)** | De pago, sin nivel gratuito. Soportados por si ya tienes clave. Claude usa formato propio y necesita la cabecera que Anthropic exige para llamadas desde navegador — el simulador ya la envía. |
| **Ollama / LM Studio** | En el propio ordenador: privacidad total y funciona sin Internet. Requiere permitir CORS. |

**Sin backend, a propósito.** La clave la pone el usuario y vive **solo en su navegador** — un archivo estático no puede llevar una clave sin filtrarla. Se descartó **Cloudflare Workers AI** precisamente por eso: su nivel gratuito es razonable, pero exige desplegar un Worker, o sea un backend que mantener, limitar por IP y vigilar. No compensa.

El botón **🔌 Probar conexión** verifica de verdad antes de guardar, y si falla explica la causa probable (clave inválida, modelo inexistente, límite alcanzado, o CORS/servidor local apagado).

Piezas de la arquitectura:
- `COPILOT_PROVIDERS` — dos adaptadores: uno **compatible con OpenAI** (cubre Groq, OpenRouter, LM Studio y Ollama solo cambiando la URL base) y otro para Gemini. Añadir un proveedor = añadir una entrada.
- `buildCopilotContext()` — reúne el contexto verificado (dialecto, modo, ciclo bajo el cursor, tabla de herramientas, hallazgos del asesor, programa actual) con instrucciones de sistema que **prohíben inventar comportamiento de Fagor o Heidenhain** y obligan a decir "no lo sé".
- `askCopilot()` — punto de entrada único: intentaría la IA si hubiera proveedor configurado y **cae al motor de reglas si falla cualquier cosa**.

**Sin proveedor configurado no sale ninguna petición de red**, verificado con prueba automatizada — el simulador sigue siendo un archivo estático que funciona desde disco. El motor de reglas funciona igual con o sin IA: la IA mejoraría la redacción, nunca sería la fuente de la verdad. Ver `ESTUDIO_IA.md`.

## Robustez frente a copiar y pegar

Un programa copiado desde un PDF, Word o una página web trae caracteres que **parecen ASCII y no lo son**. Antes esto rompía cosas en silencio: el espacio no separable dejaba un programa de 623 movimientos en 38, y el guion tipográfico de Word convertía `Z-15` en `Z+2` —**cambiando el signo de la coordenada**— sin ningún aviso.

El simulador ahora **normaliza** esos caracteres al analizar (espacios no separables y finos, guiones tipográficos, comillas curvas, BOM) y **avisa al usuario de cuántos ha corregido**, explicando que un control real no los corrige. La batería `tests/robustness.test.js` fija este comportamiento.

## Accesibilidad

Auditada y corregida en esta sesión, verificada con pruebas reales en un DOM simulado (jsdom) y cálculo directo de ratios WCAG, no solo revisión visual:
- **Etiquetas accesibles**: 193 botones y 37 campos de entrada, ninguno se queda sin `aria-label` o `<label>` asociado tras el arreglo — la mayoría reutilizando texto descriptivo que ya existía (`data-tip`, etiquetas visuales sin `for`), no escrito de nuevo.
- **Contraste de color**: calculado el ratio WCAG real (fórmula de luminancia relativa) para todos los pares texto/fondo del tema. Encontrados y corregidos dos casos reales por debajo del mínimo AA (4.5:1): el texto de error de la consola (4.02:1 → 4.75:1) y el botón "Borrar todas" (2.39–3.22:1 sobre su fondo claro real → 4.70:1) — ambos manteniendo el mismo tono de aviso, solo ajustado lo necesario.
- **Navegación por teclado**: encontrado y corregido el único elemento interactivo no nativo de toda la interfaz (un `<span>` usado como botón de eliminar herramienta, sin `tabindex` ni control de teclado) — verificado con una pulsación de Enter simulada, no solo revisión de código.

Pendiente: verificación con un lector de pantalla real (esta auditoría comprueba la estructura, no la experiencia de uso).

## Validación y avisos de seguridad

El simulador incluye detección de:
- Colisiones previsibles en movimientos rápidos (desplazamiento lateral por debajo de la superficie del bruto).
- Herramienta con longitud insuficiente para la profundidad del ciclo activo.
- Herramienta del tipo equivocado para el ciclo activo (torno y fresadora).
- Parámetros obligatorios ausentes en ciclos fijos (según especificación de cada fabricante, no por suposición).
- **WebGL no disponible en el navegador** (política de centro educativo, hardware muy antiguo). Encontrado en auditoría probando un arranque real de la página en un entorno sin WebGL: antes esto lanzaba un error sin capturar que además se repetía en cada intento de redibujar la vista 3D. Ahora se detecta una sola vez, se avisa con claridad, y el resto del simulador (editor, vista 2D, tabla de herramientas, calculadora, asistente) sigue funcionando con normalidad.
- **Paso de pasada (C) igual a cero o negativo en cualquier ciclo de torno con desbaste multi-pasada.** Encontrado en auditoría como un fallo real y grave: antes de corregirlo, un valor de C=0 (un error de programación fácil de cometer, no un caso forzado) pasaba la validación y causaba una división por cero en el cálculo del número de pasadas, entrando en un bucle que nunca termina — confirmado de la forma más dura posible, hubo que matar el proceso con un límite de tiempo externo, ni siquiera un límite de memoria explícito lo detenía solo. Ahora da un error claro e inmediato en los 9 ciclos de torno que dependen de este cálculo, verificado con pruebas que además comprueban su propio límite de tiempo, no solo el resultado.

## Limitaciones conocidas

- **G86 (roscado longitudinal) IMPLEMENTADO, con alcance acotado y documentado.** Encontrada la tabla oficial completa de parámetros (Fagor CNC 8055/8055i, modelo T, sección 9.9, "Funcionamiento básico") — no solo ejemplos sueltos. La fórmula de profundización de pasada (el punto que antes tenía un problema real de extracción del documento) quedó confirmada por una **segunda fuente independiente**: B negativo = incremento constante entre pasadas; B positivo = sección de viruta constante, B×√n (la fuente antigua lo dice literalmente: "la profundidad de cada pasada es P5 por radical"). Verificado con dos ejemplos reales encontrados en la propia investigación, con resultados matemáticamente exactos. **Alcance deliberadamente acotado, no todo lo que el ciclo real permite**: solo J=0 (rosca ciega) — de los 3 ejemplos reales encontrados, 2 usan J≠0 (salida con recorrido propio), no soportado todavía. K (repaso de roscas), V (múltiples entradas) y M (paso variable por vuelta) se rechazan con un mensaje claro — los tres exigen mantener fase real con el husillo, la misma barrera que sigue bloqueando G87 por completo.
- **G87 (roscado frontal) SIGUE BLOQUEADO** — no se encontró (ni se buscó exhaustivamente, por límite de tiempo) su propia tabla de parámetros; no se infiere por similitud con G86 pese a compartir estructura de ciclo, para no inventar.
- **G68/G69 sin pasada de acabado.** Hacen el desbaste completo hasta el perfil exacto, pero no una pasada de acabado con demasía/avance propios.
- **Perfiles cerrados en G68/G69: LIMITACIÓN PERMANENTE, decisión formal, no pendiente.** El último tramo del perfil vuelve exactamente al punto de partida del primero — en las pasadas de desbaste con desplazamiento real, la costura de cierre no se une (confirmado con una prueba geométrica: hasta 5.66mm de hueco real en la trayectoria en un caso de prueba concreto), porque el algoritmo de desplazamiento nunca calcula esa unión concreta, por diseño. El simulador detecta esta condición y avisa con claridad — no ocurre en silencio. Decisión formal: los perfiles reales de desbaste de torno son casi siempre abiertos (el contorno exterior de la pieza, de un extremo al otro) — un perfil cerrado no es un patrón natural en torneado, a diferencia de una cajera de fresadora. El coste de implementar la unión geométrica que falta (rediseño real del algoritmo de desplazamiento) es claramente superior al valor que aporta. No se investigará más. La pasada final (perfil de acabado exacto) es siempre correcta, cerrado o no.
- **Migración interna de gestión de recursos 3D, deliberadamente incompleta.** El proyecto usa un gestor centralizado (`SceneManager`) para el ciclo de vida de los objetos 3D. La migración de fresadora está terminada; la de torno conserva parcialmente el mecanismo anterior. Las dos vías conviven de forma verificada mediante pruebas dirigidas (no hay fuga de memoria ni comportamiento indefinido) — es deuda técnica documentada, no un riesgo funcional.
- **Batería de pruebas persistente**: `tests/known-limitations.test.js`, `tests/lathe-cycles.test.js`, `tests/mill-cycles.test.js`, `tests/advisor.test.js` (sin dependencias externas), más `tests/calculator.test.js` `tests/ux.test.js`, `tests/copilot.test.js`, `tests/ai-connect.test.js`, `tests/flow.test.js`, `tests/robustness.test.js` y `tests/assistant.test.js` (necesita `npm install jsdom --no-save`, documentado en el propio archivo) — **239 pruebas en total**. `advisor.test.js` comprueba las dos caras del asesor: ausencia de falsos positivos en los 4 programas reales de referencia, y contraprueba positiva de que cada regla salta cuando corresponde. Ninguna batería sustituye a una revisión manual completa.
- **Base de materiales de la calculadora**: 14 materiales, TODOS con datos de torno (desbaste/acabado/ranurado/roscado) y de fresadora — metales de uso general (aluminio, acero, inoxidable, fundición, latón, bronce), titanio (Ti-6Al-4V, dato verificado contra fuente académica), superaleaciones de níquel, cobre, magnesio, zinc, aceros de herramienta y dúplex/superdúplex (estos ocho últimos con estimación de consenso general, sin dato de fabricante concreto verificado pese a búsqueda activa — marcado así explícitamente en el propio código). Los aceros de herramienta (O1/D2/A2) se reclasificaron como material propio, usando el grupo ISO 'H' (templados/endurecidos), que ya existía en el sistema de etiquetas pero ningún material usaba.
- **Calculadora — torno, ahora completa**: desbaste, acabado, ranurado y roscado, en los 14 materiales de la base. El acabado y el ranurado se derivan del desbaste con el mismo criterio general del sector (más velocidad/menos avance en acabado; menos velocidad/avance en ranurado por la peor evacuación de viruta), marcado explícitamente como estimación general, no investigación por cada material. El roscado reutiliza la infraestructura de paso de rosca ya construida para el macho de roscar, con diámetro libre y paso editable directamente — en torno el diámetro y el paso no van fijados por una métrica estándar como en un macho. Incoherencia real encontrada y corregida en el proceso: elegir HSS en una herramienta de torno caía en el mismo multiplicador de velocidad que carburo (1.0), en vez de ser claramente más lento — faltaba esa entrada en la tabla de factores de material de herramienta.
- Herramientas de diagnóstico (panel de memoria, modo de estrés automatizado) están diseñadas pero no implementadas.

## Roadmap

- **Investigación documental de G86 (roscado longitudinal en torno), completada.** Tras una primera pasada sin la tabla completa de parámetros, se encontró la fuente definitiva: un extracto específico de la sección 9.9 del Manual de Programación Fagor CNC 8055/8055i modelo T (SOFT V16.1X, páginas 162-165) con la definición completa de cada parámetro (X, Z, Q, R, K, I, B, E, D, L, C, J, A, W, V, M). El único punto genuinamente ambiguo (la fórmula de profundización de pasada para B positivo, con un problema real de extracción en un documento distinto) se resolvió con una **segunda fuente independiente** — un control Fagor más antiguo con sintaxis paramétrica que confirma literalmente la fórmula B×√n. Con esta base, **G86 se implementó** (ver arriba) — este párrafo se mantiene como registro del proceso de investigación, no como estado pendiente.
- **G87 (roscado frontal) sigue bloqueado** — comparte estructura de ciclo con G86 pero no se encontró (ni se buscó a fondo, por límite de tiempo de esta sesión) su propia tabla de parámetros en la sección 9.10 del mismo manual. No se infiere por similitud, para no inventar. Es el candidato más claro para una futura sesión: misma fuente, sección inmediatamente siguiente.
- Pasada de acabado de G68/G69.
- Verificar formalmente el caso de perfiles cerrados en G68/G69.
- Completar la migración del gestor de recursos 3D en el modo torno.
- Batería de pruebas persistente completa en el repositorio.
- Ampliar la base de materiales (cobre, magnesio, zinc, aceros dúplex) con la misma investigación que ya se aplicó a titanio/inconel.

## Licencia

<!-- TODO: añadir LICENSE al repositorio y nombrarla aquí (MIT/Apache-2.0/GPL, según se decida). -->

## Contribuciones

Proyecto mantenido por una sola persona. Los issues y pull requests son bienvenidos, especialmente para ampliar cobertura de ciclos CNC con documentación oficial verificable adjunta.
