# PROMPT DE CONTINUIDAD — CNC Studio Pro

> Pega este prompt entero en una conversación nueva. Contiene todo el contexto necesario para continuar sin reconstruir nada. Es el relevo definitivo del proyecto.

---

## QUÉ ES EL PROYECTO

**CNC Studio Pro**: simulador CNC educativo en un **único archivo HTML** (~507 KB, ~8.300 líneas), con Three.js por CDN. Soporta **Heidenhain Klartext (iTNC 530)** y **Fagor ISO**, en **fresadora y torno**. Pensado para formación profesional (contexto español, ciclo MF0090), publicable en GitHub Pages y también utilizable abriéndolo desde disco.

**Estado: RELEASE CANDIDATE.** 239 pruebas automatizadas en verde. Madurez suficiente declarada por el responsable técnico al cierre de la última sesión.

---

## POLÍTICA PERMANENTE DEL PROYECTO — NO NEGOCIABLE

1. **Diferenciar** fidelidad a especificación externa (Fagor/Heidenhain) de decisiones internas del simulador.
2. **Nunca inventar comportamiento** sin documentación verificable. Si falta evidencia → clasificar como PARCIAL o BLOQUEADO, nunca implementar a ojo.
3. **Intentar refutar** cada conclusión antes de aceptarla.
4. **Verificar con EJECUCIÓN REAL, no con lectura de código.** Este es el método que ha encontrado *todos* los fallos reales del proyecto. Cuando algo "debería estar bien" por lectura, ejecutarlo antes de darlo por bueno.
5. Todo cambio: **demostrar → implementar → probar → regresión → documentar**.
6. **Criterio de cierre**: no perseguir mejoras pequeñas indefinidamente. Preguntarse siempre "¿esto aporta valor real o solo perfeccionismo?". Si no quedan mejoras con relación beneficio/coste positiva, **detenerse y decirlo**.
7. **CERO dependencias externas nuevas** — romperían el uso desde disco y la filosofía de archivo único.
8. **⚠️ TODO el JavaScript va dentro del ÚNICO bloque `<script>` existente.** Las baterías extraen el motor con `/<script>([\s\S]*)<\/script>/`; un segundo bloque las rompería todas.
9. **Criterio de calidad de avisos**: un aviso que salta cuando no debe enseña al alumno a ignorar *todos* los avisos. Preferible una regla menos que una regla que miente.

---

## ARCHIVOS

| Archivo | Contenido |
|---|---|
| `cnc-studio-pro.html` | El simulador completo (entregable único) |
| `README.md` | Técnico: para quien toque el código o lo publique |
| `MANUAL.md` | Para profesor/alumno, 8 secciones |
| `ESTUDIO_IA.md` | Análisis técnico completo sobre integrar IA (16 opciones) |
| `INFORME_FINAL.md` | Qué se hizo en la última sesión y por qué |
| `tests/known-limitations.test.js` | 1 prueba — fija comportamiento imperfecto pero aceptado |
| `tests/lathe-cycles.test.js` | 48 pruebas — torno, sin dependencias |
| `tests/mill-cycles.test.js` | 13 pruebas — fresadora, sin dependencias |
| `tests/advisor.test.js` | 34 pruebas — asesor CNC, sin dependencias |
| `tests/calculator.test.js` | 20 pruebas — **necesita `npm install jsdom --no-save`** |
| `tests/ux.test.js` | 26 pruebas — **necesita jsdom**, arranca la página entera y simula clics |
| `tests/copilot.test.js` | 21 pruebas — **necesita jsdom**, copiloto y onboarding |
| `tests/ai-connect.test.js` | 17 pruebas — **necesita jsdom**, conexión BYOK y explicación línea a línea |
| `tests/flow.test.js` | 16 pruebas — **necesita jsdom**, flujo de primera ejecución y accesibilidad |
| `tests/robustness.test.js` | 17 pruebas — condiciones límite y caracteres invisibles, sin dependencias |
| `tests/assistant.test.js` | 20 pruebas — **necesita jsdom**, asistente flotante |

**Programas de referencia para regresión** (en `/mnt/user-data/uploads/`, nombres `CarlosCifuentes-MF0090-T11.H`, `-T12.H`, `MF0090-T09.H`, `CarlosCifuentes-MF0090-PR01.H`):

| Programa | Movimientos esperados |
|---|---|
| T12 | 623 |
| T11 | 514 |
| T09 | 1792 |
| PR01 | 1438 |

⚠️ **El entorno de trabajo (`/home/claude/`) se ha reiniciado sin aviso varias veces**, perdiendo la carpeta entera. Los entregables viven en `/mnt/user-data/outputs/` (persistente). **Al empezar cualquier sesión**: reconstruir entorno (copiar HTML desde outputs, programas desde uploads, `npm install jsdom --no-save`) y **confirmar la regresión 623/514/1792/1438 ANTES de tocar nada**.

---

## FUNCIONALIDADES IMPLEMENTADAS

### Torno Fagor ISO
G81 (torneado recto), G82 (refrentado recto), G83 (taladrado/roscado con macho), G84 (torneado curvo), G85 (refrentado curvo), G68 (desbaste perfil eje X), G69 (desbaste perfil eje Z), G88 (ranurado eje X), G89 (ranurado eje Z), **G86 (roscado longitudinal)**. Los 9 primeros con **asistente guiado de inserción** (pregunta cada parámetro por separado).

**G86 — alcance acotado y documentado**: verificado contra la tabla oficial (Fagor CNC 8055/8055i, modelo T, sección 9.9) más una segunda fuente independiente que confirma la fórmula de profundización (B negativo = incremento constante n×|B|; B positivo = sección de viruta constante |B|×√n). **Solo soporta J=0** (rosca ciega) — de los 3 ejemplos reales encontrados, 2 usan J≠0, no soportado. K (repaso), V (múltiples entradas) y M (paso variable) se **rechazan con mensaje claro**, no se ignoran: los tres exigen fase real con husillo.

### Fresadora
32 ciclos Heidenhain (CYCL DEF 200-257 + transformaciones 7/8/10) y 8 Fagor ISO (G80-G88) cubiertos por el asistente. **Verificado explícitamente que G81/G88 no se confunden entre fresadora y torno** (significan cosas distintas).

### Asesor CNC — "profesor" (lo nuevo de la última sesión)
Motor de reglas **extensible**: `ADVISOR_RULES` (tabla) + `runAdvisor(ctx)`. Añadir conocimiento = **añadir una entrada**, nada más.

- **Separación arquitectónica deliberada**: `buildMoves()` = errores *durante* la ejecución (necesita estado intermedio). **Asesor** = análisis del programa *ya simulado* (necesita verlo entero). No mezclar.
- Cada regla recibe `{statements, moves, toolTable, mode, dialect, blk, sourceText}` y devuelve `null` o `{que, por, como}`.
- Una regla que lance excepción **no tumba** el análisis ni la simulación (probado).
- **13 reglas activas**: sin husillo (S) · sin arranque de husillo (M3/M4/M13/M14) · sin refrigerante · penetración axial > diámetro de fresa · fin sin retirada de herramienta · corte muy por debajo del bruto · herramienta no usada · etiqueta no llamada · **ciclo fijo definido y nunca ejecutado** (CYCL DEF sin CYCL CALL/M99/M89) · cambio de herramienta redundante · programa sin corte · **torno: el corte pasa del eje (X0)** · **torno: fin sin retirar del diámetro del bruto**.
- Salida con **qué / por qué / cómo** — hay una prueba que verifica que ninguna regla puede saltarse el "por qué".

**⚠️ LECCIÓN CRÍTICA SI AÑADES REGLAS**: la primera versión daba 5-6 falsos positivos en cada uno de los 4 programas reales. Causas encontradas: `F111111` es la convención FMAX (no una errata); `M13 = M3+M8` combinados; las bajadas desde el plano de seguridad no cortan; **una broca bajando 41 mm hace su trabajo**; y `'fresa'` es el tipo *por defecto* cuando la herramienta no está definida — un **desconocido**, no una clasificación. **Dos reglas se retiraron en vez de parchearlas** (`avance_absurdo`, `movimiento_nulo`). Siempre probar toda regla nueva contra los 4 programas reales antes de darla por buena.

### Asistente contextual (anterior, sigue vigente)
Panel de ayuda por ciclo/parámetro · 9 patrones de explicación de alarmas verificados contra mensajes reales del motor · corrección automática de un clic para tipo de herramienta equivocado · modo Aprendiz/Profesional (Alt+A).

### Experiencia de usuario — se enseña solo
- **Primera visita**: se abre el panel **"¿Qué quieres hacer?"** (no el recorrido de golpe). 8 accesos directos, incluido **"Nunca he tocado un CNC"** que carga un programa mínimo y lo explica línea por línea. Cada acceso **deja el programa preparado y explica lo que se ve** — no son atajos de navegación.
- **Recorrido guiado**: 12 pasos que resaltan zonas REALES (editor, dialecto, modo, simulación, 3D, 2D, herramientas, calculadora, asistente, consola, import/export, vista). Flechas del teclado y Escape.
- **Botón 🎓 Tutorial** reabre el panel. **`localStorage` SIEMPRE en try/catch** (en `file://` algunos navegadores lanzan al tocarlo).
- **Modo demostración** (▶): reproduce y narra qué ciclo se ejecuta y por qué. **La narración sale de `detectCycleAtCursor`**, el mismo conocimiento verificado del asistente — nunca puede contradecir la documentación.
- **Ayuda contextual**: al elegir tipo de herramienta se explica *esa*; al elegir material se explica *ese* (grupo ISO + kc + fuente).
- **Arquitectura**: SIN librerías externas. Foco = rectángulo + `box-shadow` gigante sobre el elemento real, sin clonar ni mover nada. Los pasos apuntan a IDs reales; si uno no existe o no está visible se salta; si el filtro no deja ninguno se usan todos (un tutorial que no arranca sin decir por qué es peor). Ampliar = una entrada en `TOUR_STEPS` / `INTENTS`.

### Arranque en blanco
La página abre con el editor vacío: solo inicio, línea de bruto **sin datos** y fin. Cambiar de modo también lo deja limpio. "Cargar ejemplo" trae el ejemplo completo.
**Dato verificado**: en **Fagor ISO NO existe** instrucción equivalente al BLK FORM — confirmado contra los ejemplos oficiales de Fagor: el bruto es una anotación fuera del programa y el área gráfica se define en el menú de GRÁFICOS del control. Por eso aquí va como **comentario** `(STOCK ...)`.

### Calculadora tecnológica — completa
14 materiales, **todos** con datos de torno (desbaste/acabado/ranurado/roscado) y fresadora. Acabado y ranurado son **fórmulas derivadas** del desbaste (criterio general del sector, marcado como estimación, no investigación por material). Roscado reutiliza la infraestructura de paso de rosca del macho, con diámetro libre y paso editable. Insignias de confianza: **verificado** / **contrastado** / **estimado**.

### Estabilidad — protecciones ganadas a base de fallos reales
- **Bucle infinito corregido**: paso de pasada C=0 colgaba el proceso entero (división por cero → `Infinity` pasadas). Corregido en los 9 ciclos de torno con paso. **Las pruebas miden su propio tiempo de ejecución** para que una regresión avise en vez de colgar la batería.
- Condiciones de carrera corregidas: asistentes guiados solapados; doble clic en Empezar/Reiniciar (mecanismo de *generación* por vista, no bastaba la bandera `playing`).
- **WebGL ausente** (política de centro, hardware antiguo, CDN caído): aviso único y claro, resto de la app funciona. Antes: error sin capturar que se repetía sin parar.
- Recursión de subprogramas: ya protegida (límite 25 niveles), confirmado con ejecución real.
- Memoria Three.js: verificada sin fugas (geometrías/materiales/texturas liberadas).

---

## LIMITACIONES — distinguir permanentes de pendientes

**PERMANENTES (decisión formal, no investigar más):**
- **Perfiles cerrados en G68/G69**: el desplazamiento no une la costura entre último y primer segmento (hasta 5,66 mm de hueco, confirmado geométricamente). **Detectado y avisado**, no corregido. Razón: los perfiles reales de torno son casi siempre abiertos; el coste del rediseño supera el valor.

**PENDIENTES REALES:**
- **G87 (roscado frontal)**: bloqueado. No se buscó su tabla de parámetros (sección 9.10 del mismo manual que sí funcionó para G86). **Es el candidato más concreto y con precedente claro.**
- ~~Capa de IA~~ **COMPLETADA**: conectable por BYOK con 5 proveedores, sin backend, verificada.
- **G68/G69**: sin pasada de acabado.
- **G86**: solo J=0; sin K/V/M.
- Verificación en navegador real con GPU: imposible en el entorno de desarrollo.
- Prueba con lector de pantalla real: imposible en el entorno.
- Revisión humana independiente del código: no realizada.

---

## PRÓXIMOS PASOS RECOMENDADOS (orden de beneficio/coste)

1. **Ampliar el asesor CNC con más reglas** — la infraestructura ya está y añadir conocimiento cuesta una entrada por regla. Es donde más valor por esfuerzo queda. **Probar siempre contra programas reales**: los 4 de referencia para fresadora, y los ejemplos de Fagor de `lathe-cycles.test.js` para torno. Toda regla necesita caso positivo Y negativo.
2. **Implementar la capa de IA** siguiendo `ESTUDIO_IA.md` — diseño cerrado, solo falta construir. Decisión previa que solo el usuario puede tomar: BYOK (Gemini Flash gratis, sin backend) vs modelo local (Ollama/LM Studio) vs Cloudflare Worker.
3. **G87** — misma fuente y método que funcionaron para G86.
4. **Probar en un navegador real con GPU** — única verificación que el entorno de desarrollo nunca ha podido dar.

---

## CÓMO EMPEZAR UNA SESIÓN NUEVA

1. Reconstruir entorno y **confirmar regresión 623/514/1792/1438**.
2. Ejecutar las 11 baterías (239 pruebas) para confirmar estado.
3. **Aplicar el criterio de cierre**: si el usuario no trae una razón nueva y concreta (un fallo encontrado usando el simulador, una funcionalidad pedida, evidencia documental nueva), lo correcto es **confirmar el estado y preguntar qué hace falta de verdad**, no reabrir una auditoría general por inercia. El proyecto ya fue declarado maduro.
