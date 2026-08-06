# CNC Studio Pro — Informe final de la sesión

Trabajo realizado actuando como responsable técnico del producto, no como programador de funciones sueltas.

---

## 1. Auditoría previa (antes de implementar nada)

Se buscaron problemas reales, no inventados:

| Área | Resultado |
|---|---|
| Funciones declaradas nunca llamadas | Ninguna |
| Variables globales sin usar (código muerto) | Ninguna |
| IDs HTML duplicados | Ninguno |
| Dependencias que romperían GitHub Pages o `file://` | Ninguna (`fetch`/`localStorage` ausentes) |
| Regresión de los 4 programas reales | Intacta (623 / 514 / 1792 / 1438) |

**Conclusión de la auditoría**: el código estaba limpio. No se inventaron problemas para justificar cambios. El trabajo real estaba en la prioridad que marcaste: el asistente.

---

## 2. Prioridad absoluta — el asesor CNC

Se construyó un **motor de reglas extensible** (`ADVISOR_RULES` + `runAdvisor`), separado deliberadamente del motor de simulación.

**Decisión de arquitectura y por qué:**
- `buildMoves()` detecta errores **durante** la ejecución — necesita el estado intermedio (posición actual, herramienta activa). Ahí se quedan los errores que impiden simular bien.
- El **asesor** analiza el programa **ya simulado** — necesita verlo entero de una vez. Ahí van las malas prácticas, el código muerto, las redundancias y los riesgos de criterio.

Mezclar ambas cosas habría hecho imposible añadir conocimiento sin tocar el motor de simulación, que es la parte que no se debe desestabilizar.

**Extensibilidad conseguida**: añadir conocimiento = añadir **una entrada** a `ADVISOR_RULES`. Nada más. Cada regla recibe el contexto completo y devuelve `null` o un hallazgo. Una regla que lance una excepción no tumba el análisis ni la simulación (probado explícitamente con un contexto inválido).

**Calidad pedagógica**: cada hallazgo obliga a tres piezas — **qué** (con datos concretos), **por qué** (lo que enseña) y **cómo** se hace bien. Hay una prueba automatizada que verifica que ninguna regla puede saltarse el "por qué".

**Reglas activas (13)**: velocidad de husillo no programada · husillo nunca arrancado · refrigerante nunca activado · penetración axial mayor que el diámetro de la fresa · el programa termina sin retirar la herramienta · corte muy por debajo del bruto · herramienta definida y nunca usada · etiqueta definida y nunca llamada · ciclo fijo definido y nunca ejecutado · cambio de herramienta redundante · programa que no llega a cortar nada · el corte pasa del eje de la pieza (torno) · el programa de torno termina sin retirar la herramienta.

Las cinco últimas (`ciclo_nunca_ejecutado`, `final_sin_retirada`, `corte_bajo_el_bruto`, `torno_corte_pasa_eje`, `torno_final_sin_retirada`) se añadieron en ampliaciones posteriores, ya sobre la infraestructura terminada: **cada una costó una entrada en la tabla, sin tocar nada más** — que era exactamente el objetivo de diseño. Todas se probaron con caso positivo Y negativo, y contra programas reales: las de fresadora contra los 4 de referencia, las de torno contra los ejemplos reales de Fagor que ya usa la batería de torno. Las dos últimas cierran además una asimetría real: el asesor estaba muy escorado a fresadora en un proyecto centrado en torno.

---

## 3. El hallazgo más importante: mis propias reglas estaban mal

Al probar la primera versión contra los 4 programas reales de referencia, el asesor produjo **5-6 hallazgos en cada uno** — todos falsos, en programas correctos. Se investigó la causa raíz de cada uno en vez de ajustar umbrales a ojo:

| Falso positivo | Causa raíz real |
|---|---|
| "Avance absurdo" (F111111) | `F111111` es la **convención de avance máximo** de Heidenhain, no una errata. El propio proyecto ya la reconocía en otro punto (`st.feed > 10000`). |
| "No se arranca el husillo" | Los programas usan **M13 = M3+M8** (giro + refrigerante en un código). La regex solo buscaba M3/M4 sueltos. |
| "Sin refrigerante" | Misma causa: M13 lleva el refrigerante incorporado. |
| "Penetración profunda" | Contaba las bajadas desde el plano de seguridad (Z+150 → Z+2), que no cortan nada. Y además no miraba el tipo de herramienta: **una broca bajando 41 mm hace exactamente su trabajo**. |
| "Movimientos nulos" (183 de 623) | No eran bloques del usuario: eran movimientos que **genera el propio simulador** dentro de los ciclos fijos. |
| "Cambio de herramienta redundante" | Repetir `TOOL CALL` con la misma herramienta y **otra S** es la forma legítima de cambiar la velocidad. |

**Decisiones tomadas — dos reglas se retiraron, no se parchearon:**
- **`avance_absurdo`: retirada.** No hay forma fiable de distinguir una errata de la convención FMAX sin conocer dialecto y unidades activas.
- **`movimiento_nulo`: retirada.** Culpaba al usuario de movimientos generados por el simulador: no solo era inútil, le enseñaba algo falso sobre su propio programa.

**Criterio aplicado**: *un aviso que salta cuando no debe enseña al alumno a ignorar todos los avisos, que es peor que no tenerlo.* Preferible una regla menos que una regla que miente.

**Un hallazgo más profundo, encontrado depurando**: el simulador usa `'fresa'` como tipo por defecto cuando la herramienta **no está definida** — pero eso es un *desconocido*, no una clasificación. El proyecto deliberadamente no inventa herramientas si el programa no da información explícita. La regla de penetración se corrigió para **no opinar sobre herramientas que nadie ha definido**, y sí hacerlo en cuanto el usuario las define.

**Resultado final**: **cero hallazgos** en los 4 programas reales, y **contraprueba positiva** de que cada regla sí salta cuando corresponde (una regla que nunca salta es tan inútil como una que salta siempre).

---

## 4. Estudio de IA — entregado como documento aparte

`ESTUDIO_IA.md` contiene el análisis técnico completo de las 16 opciones pedidas (proveedores y alojamiento), con costes, límites, privacidad, mantenimiento y seguridad.

**Conclusión resumida**: sí merece la pena, pero **solo** como capa opcional sobre el núcleo determinista, nunca sustituyéndolo. La restricción que decide todo es que un archivo estático **no puede contener una clave de API** sin filtrarla. Arquitectura recomendada: BYOK con Gemini Flash (gratis, sin backend) o modelo local (Ollama/LM Studio, privacidad total), con Cloudflare Workers como única opción de backend razonable.

**No se implementó, deliberadamente**: la prioridad que fijaste era el profesor CNC (hecho y probado); añadir interfaz de IA con prisa al final de una sesión larga es la mejor forma de desestabilizar un producto que ahora está en verde; y la elección de proveedor depende de información que solo tú tienes (Internet en el aula, si puedes pedir claves a los alumnos, si asumes mantenimiento). El diseño queda cerrado para implementarlo directamente.

---

## 5. Verificación final

- **116 pruebas automatizadas**, en 5 baterías, todas en verde, ejecutadas en carpeta limpia.
- **Regresión de los 4 programas reales**: intacta.
- **Higiene**: sin IDs duplicados, DOCTYPE y viewport correctos, sin dependencias que rompan GitHub Pages ni la apertura desde disco.
- **Documentación**: README y MANUAL actualizados con el asesor (el README con el detalle arquitectónico para quien amplíe reglas; el MANUAL con lenguaje de aula, incluyendo la advertencia de que "sin avisos" no significa "programa correcto").

---

## 6. Clasificación: RELEASE CANDIDATE

**No BETA**: 116 pruebas cubriendo caminos críticos, fallos graves reales corregidos a lo largo del proyecto, asesor con doble verificación (falsos positivos + contraprueba), calculadora completa, documentación consistente con el código.

**No ESTABLE todavía**, por tres motivos concretos y documentados, ninguno resoluble en este entorno:
1. **Nunca probado en un navegador real con GPU** — todo el testing, incluida la parte 3D, se hizo con `jsdom` simulado. La degradación ante ausencia de WebGL sí está verificada; el camino "todo funciona bien con GPU real" no.
2. **Sin revisión humana independiente del código**, y sin prueba con lector de pantalla real.
3. **G87 (roscado frontal) sigue sin implementar**, y la capa de IA está diseñada pero no construida.

**El proyecto ha alcanzado un punto de madurez suficiente.** No quedan mejoras con relación beneficio/coste claramente positiva fuera de esas tres, y las tres dependen de decisiones o recursos que están fuera de mi alcance aquí. Me detengo.
