# Manual de usuario — CNC Studio Pro

Guía práctica para usar el simulador. Para el estado técnico del proyecto (qué está implementado, qué está bloqueado y por qué), consulta el [README](README.md) — este manual es de uso, no de arquitectura.

## 1. Primeros pasos

**Abajo a la derecha tienes al asistente**: un calibre con birrete. Al abrir el simulador te saluda solo y te ofrece por dónde empezar. Si te molesta, un clic lo minimiza; otro clic lo devuelve.

Es el sitio al que mirar siempre que quieras algo: aprender desde cero, crear un programa, insertar un ciclo, elegir herramienta, calcular parámetros, que te explique el programa línea a línea, que repase los errores, o abrir el tutorial completo. También puedes escribirle una pregunta.

**El editor arranca casi vacío a propósito**: solo la apertura y el cierre del programa. El resto se construye conversando, para que entiendas cada línea que aparece en vez de rellenar huecos de una plantilla.


**La primera vez que abras el simulador** te saldrá solo el panel **"¿Qué quieres hacer?"**. Elige por dónde empezar (aprender Heidenhain, aprender Fagor, hacer una cajera, una ranura, un refrentado...) y te deja el programa preparado explicándote qué estás viendo. Si prefieres verlo todo por orden, pulsa **"Ver el recorrido guiado"**: son 12 pasos que van iluminando cada zona de la pantalla y explicando para qué sirve.

No pasa nada si lo cierras: el botón **🎓 Tutorial** de la barra superior lo vuelve a abrir cuando quieras.

**Botón ▶ Demostración**: carga un programa y lo reproduce solo, explicándote sobre la marcha qué ciclo se está ejecutando y por qué se mueve así la herramienta. Va bien para ponerlo en clase mientras explicas.

**Ayuda sin buscar nada**: si eliges un tipo de herramienta en la tabla, te explica esa herramienta. Si eliges un material en la calculadora, te explica ese material. No hace falta ir a ningún manual.


Abre `cnc-studio-pro.html` en el navegador (doble clic, o publicado en una URL). No hace falta instalar nada.

En la parte superior eliges:
- **Fresado / Torno** — el tipo de máquina.
- **Heidenhain (Klartext) / ISO (Fagor)** — el dialecto de programación.

Estas dos elecciones son independientes: puedes simular torno en ISO, fresado en Heidenhain, o cualquier combinación.

## 2. Escribir o cargar un programa

**Al abrir la página, el editor está en blanco a propósito**: solo aparecen la línea de inicio, la línea del bruto *sin datos* (para que la rellenes tú) y la línea de fin. Cambiar entre fresadora y torno también deja el editor limpio. Si quieres ver un programa de ejemplo completo, pulsa **"Cargar ejemplo"**.

Sobre la línea del bruto: en Heidenhain, `BLK FORM` es una instrucción real del lenguaje y necesita dos líneas (`0.1` con el punto mínimo y `0.2` con el máximo) — la plantilla trae solo la `0.1` vacía como punto de partida. En Fagor ISO **no existe ninguna instrucción equivalente**: en un control real las medidas del bruto se definen en el menú de gráficos, no en el programa. Por eso aquí el bruto va como comentario `(STOCK ...)`: un control real lo ignora y tu programa sigue siendo válido, pero este simulador sí lo lee para dibujar la pieza.

- Escribe directamente en el editor de la izquierda.
- **Cargar ejemplo** te da un programa de partida ya funcional para el modo/dialecto activo.
- **📥 Cargar archivo** abre un `.txt`/`.nc`/`.tap`/`.h` desde tu ordenador.
- **🔄 Exportar a...** convierte el programa actual entre Heidenhain e ISO cuando es posible (no todos los conceptos tienen equivalente exacto en el otro dialecto — revisa el resultado).

Mientras escribes, el editor sugiere bloques (escribe `CYCL` en Heidenhain para ver todos los ciclos disponibles con su número, por ejemplo).

### Asistente de programación

Al situar el cursor sobre una línea con un ciclo reconocido (un `CYCL DEF` de Heidenhain, un ciclo fijo `G8x` de Fagor torno, o un ciclo fijo `G8x` de Fagor fresadora — el mismo número significa cosas distintas según el modo activo, y el panel siempre da la explicación correcta para el modo en el que estés), aparece un panel debajo del editor con la explicación del ciclo, cada parámetro, y su estado real:

- 🟢 **implementado** — verificado contra documentación oficial o ejemplos reales.
- 🟡 **parcial** — funciona, pero con una aproximación conocida (se explica cuál).
- 🔴 **bloqueado** — no implementado, con el motivo exacto.

Este panel es un sistema de reglas basado en el conocimiento ya verificado del proyecto, no una inteligencia artificial que entienda lenguaje libre — no le "preguntes" nada, solo sitúa el cursor sobre el código.

### Si copias un ejercicio de un PDF

Cuidado con esto, porque despista mucho: al copiar de un PDF, de Word o de una web, el texto trae caracteres invisibles que parecen normales pero no lo son. Un guion de Word puede hacer que `Z-15` se lea como `Z+2`, y la herramienta no baje donde debe.

El simulador los detecta, los corrige para poder simular y **te dice cuántos ha corregido**. Si ves ese aviso, reescribe esas líneas a mano antes de llevarte el programa a la máquina: **un control real no los corrige solo**.

### El copiloto — pregúntale lo que quieras

En la barra del asistente tienes una caja para escribir preguntas: *"¿qué hace G81?"*, *"¿qué es el cero pieza?"*, *"háblame del titanio"*, *"¿para qué sirve una broca?"*. Te contesta con lo que el simulador tiene verificado.

**Lo importante para usarlo en clase**: si no sabe algo, **te lo dice** en vez de inventárselo. Eso es a propósito. Un dato inventado sobre un control CNC se aprende mal y puede acabar en una herramienta rota, así que preferimos un "no lo sé" honesto.

Un truco útil: si preguntas por un código que no existe en el modo en el que estás (por ejemplo G81 estando en Heidenhain fresadora), te dice **en qué modo sí significa algo**. Ese lío —el mismo código significando cosas distintas según dialecto y máquina— es de los que más despistan al empezar.

### Conectar una IA (opcional, no hace falta)

El copiloto funciona sin IA. Si quieres que además responda preguntas abiertas con sus propias palabras, pulsa el **⚙** junto a la caja de preguntas.

Lo importante para un centro: **la clave se queda en el navegador del ordenador donde la pongas**, no viaja a ningún sitio del proyecto (esto es un archivo, no tiene servidor). La opción recomendada es **Groq**, que es gratis y no pide tarjeta. Si el aula no tiene Internet o prefieres que nada salga de los equipos, usa **Ollama** o **LM Studio**, que corren el modelo en el propio ordenador.

Pulsa **🔌 Probar conexión** antes de guardar: te dice si funciona de verdad y, si no, por qué.

Y un aviso que conviene dar en clase: lo que responda la IA sale marcado como *orientativo*, frente a lo que sale marcado como *conocimiento verificado*. No es lo mismo, y el alumno debe saberlo.

### Explicar el programa entero

Botón **📖 Explicar mi programa**: te desglosa el programa línea por línea, diciendo qué hace cada bloque. Va muy bien para proyectar en clase o para que un alumno entienda un programa que le has dado hecho.

### El asesor CNC — lo que revisa tu programa entero

Cada vez que pulsas Simular, además de los errores normales, el simulador **revisa el programa completo** y te señala cosas que no son errores de escritura pero sí problemas reales de programación. Por ejemplo: que nunca arrancas el husillo, que una herramienta de la tabla no se usa nunca, o que una fresa baja en vertical más de lo que aguanta.

Cada aviso aparece en la consola con un color según su gravedad (🔴 alta, 🟠 media, 🔵 baja) y **se puede pulsar**. Al hacerlo, el panel de ayuda te enseña tres cosas:

- **Qué se ha encontrado** — con los datos concretos de tu programa.
- **Por qué importa** — qué pasaría en la máquina real. Esta es la parte que enseña.
- **Cómo se hace bien** — qué deberías cambiar.

Dos cosas importantes para usarlo en clase:

1. **Que no salte ningún aviso no significa que el programa esté bien.** El asesor comprueba una lista concreta de cosas, no todo lo que puede salir mal en un taller.
2. **Algunos avisos son de criterio, no errores.** Por ejemplo, el del refrigerante: hay materiales que se mecanizan en seco a propósito. El aviso te lo dice, y decides tú. Un buen ejercicio de clase es preguntar al alumno *por qué* ignora un aviso — si sabe justificarlo, ha aprendido.

**Avisos clicables**: en el panel de consola, cualquier aviso de un tipo reconocido (colisión, herramienta equivocada, parámetro sin confirmar, pasadas de desbaste omitidas, entre otros) se puede pulsar para ver una explicación ampliada en el mismo panel de ayuda. Cuando la corrección es inequívoca (por ahora, solo el caso de herramienta del tipo equivocado para el ciclo), aparece además un botón que la aplica directamente en la tabla de herramientas — el simulador nunca "adivina" una corrección cuando podría haber más de una interpretación válida, así que no todos los avisos la ofrecen.

**Modo Aprendiz / Profesional**: el botón junto al panel de ayuda cambia entre que el panel aparezca automáticamente al mover el cursor (Aprendiz, el modo por defecto) o que solo aparezca cuando lo pidas con el mismo botón o el atajo Alt+A (Profesional, para quien ya no necesita la ayuda constante).

**Asistentes guiados de inserción**: al elegir cualquiera de los nueve ciclos de torno Fagor (G81, G82, G83, G84, G85, G88, G89, G68, G69) en el desplegable "+ Insertar bloque...", en vez de pegar una plantilla con valores fijos, el simulador pregunta cada parámetro por separado con su significado real — igual que ya hacía "BLK FORM (bruto)" en Heidenhain. El resto de bloques del desplegable siguen siendo plantillas de un solo bloque, editables directamente en el editor.

Para G68/G69 (desbaste de perfil completo), ten en cuenta que el rango de etiquetas que pide el asistente (P13/P14) es solo un punto de partida orientativo — tienes que ajustarlo para que coincida con las etiquetas reales de tu perfil, o el simulador avisará con claridad de que no encuentra la etiqueta correspondiente.

## 3. Simular

- **▶ Empezar** reproduce la simulación desde el principio.
- **⏸ Pausar** / **⟲ Reiniciar** / **⏭ Paso** (avanza un solo movimiento, útil para depurar).
- El control de velocidad ajusta lo rápido que se reproduce, no afecta al resultado.

**Vista 2D**: planta/perfil según el modo. Útil para ver medidas exactas y trayectorias con claridad.

**Vista 3D**: el bruto se "esculpe" en tiempo real según avanza la simulación — lo que ves al final es la pieza que realmente quedaría, no solo por dónde pasó la herramienta. Arrastra para orbitar, rueda del ratón para zoom, o los botones de cámara.

### Colores de trayectoria

| Color | Significado |
|---|---|
| Avance normal | Corte real (feed) |
| Gris apagado | Movimiento rápido (G0) |
| Rojo | Taladrado |
| Verde | Escariado |
| Ámbar | Roscado con macho |
| Morado | Centrado |

## 4. Avisos y alarmas

El panel de consola, debajo del editor, muestra tres niveles:

- 🚨 **ALARMA** — problema real y grave (colisión prevista, herramienta demasiado corta, parámetro obligatorio ausente). La simulación de ese bloque no se fía hasta que lo corrijas.
- ⚠ **Aviso** — algo que deberías revisar, pero no bloquea la simulación (por ejemplo, una pasada de desbaste omitida por ser geométricamente imposible con el paso programado).
- ℹ **Información** — el simulador ha tenido que aproximar algo porque falta un parámetro opcional (te dice cuál y por qué).

Ningún aviso aparece porque sí — si ves uno, hay un motivo concreto explicado en el propio mensaje.

## 5. Tabla de herramientas

Cada herramienta usada en el programa aparece automáticamente en la tabla (pestaña correspondiente). Puedes:
- Editar longitud, radio, tipo y recubrimiento a mano.
- **📥 Cargar tabla TOOL.T** / **💾 Descargar tabla** para reutilizar entre programas.
- **🗑 Borrar todas** si quieres empezar de cero.

Si una herramienta no tiene longitud suficiente para la profundidad que pide el programa, la simulación lo avisa con una alarma real, no en silencio.

## 6. Calculadora tecnológica

Botón **🧮 Calculadora de mecanizado**. Dos modos:

- **Manual**: introduces Vc, diámetro, fz y calcula RPM y avance directamente.
- **Automático**: eliges material, aleación, tipo de herramienta (incluye cuatro opciones de torno — desbaste, acabado, ranurado, roscado — además de las de fresadora), material de herramienta, recubrimiento, y la calculadora sugiere valores de partida — con una insignia junto a cada resultado que indica si el dato de fuerza de corte está **verificado** (fuente de catálogo real), **contrastado** (varias fuentes coincidentes) o **estimado** (elaboración propia razonada, sin cifra de fabricante concreta). No trates un valor "estimado" como si fuera de catálogo. Los 14 materiales tienen ya datos de torno. En roscado de torno, a diferencia del macho de roscar, el diámetro es libre y el paso se escribe directamente — no se elige de una lista de tamaños de tornillo estándar.

Si activas los campos de **ap/ae reales**, la calculadora añade potencia, par y tiempo estimado — y avisa si superas la potencia o RPM máxima que hayas indicado para tu máquina.

**➕ Añadir a la tabla de herramientas** inserta directamente la herramienta calculada, lista para usar en el programa.

## 7. Preguntas frecuentes

**¿Por qué mi ciclo de torno no hace nada?**
Comprueba el panel del asistente (apartado 2) situando el cursor sobre esa línea — si el ciclo está marcado como bloqueado, el motivo está ahí. G86 (roscado longitudinal) ya está implementado, con alcance acotado (solo rosca ciega, J=0 — consulta el README para el detalle completo). G87 (roscado frontal) sigue bloqueado, igual que cualquier uso de G86 con repaso de roscas, múltiples entradas o paso variable, por requerir sincronización con el husillo que el simulador todavía no representa.

**¿Por qué aparece un aviso de colisión que no esperaba?**
El detector compara el movimiento contra el volumen del bruto, no contra qué material ya se ha retirado en operaciones anteriores del mismo programa — en programas con varias zonas mecanizadas por separado, puede avisar de algo que en la práctica ya está despejado. Revisa el bloque exacto que señala el aviso antes de asumir que es un error tuyo.

**¿Puedo confiar en los datos de la calculadora para mecanizar de verdad?**
Solo los marcados como **verificado**. Los marcados como **contrastado** o **estimado** son un punto de partida razonado, no un dato de catálogo — contrástalos con la documentación de tu propia herramienta antes de mecanizar una pieza real.

**El simulador dice que mi herramienta es del tipo equivocado para el ciclo — ¿cómo lo arreglo?**
Pulsa sobre ese aviso en la consola: si la corrección es inequívoca (el mensaje ya dice exactamente qué tipo hace falta), aparece un botón que la aplica directamente en la tabla de herramientas, sin que tengas que ir a cambiarla a mano.

## 8. Límites conocidos que conviene saber antes de usarlo en clase

- Torno Fagor: G86 (roscado longitudinal) implementado con alcance acotado (solo rosca ciega, sin repaso/múltiples entradas/paso variable — ver README). G87 (roscado frontal) sigue sin implementar. Desbaste de perfil completo (G68/G69) no incluye pasada de acabado todavía, y no soporta correctamente un perfil **cerrado** (el último tramo vuelve exactamente al punto de partida del primero) cuando hace falta desplazamiento real — el simulador lo detecta y avisa con claridad si pasa, en vez de dar un resultado incorrecto en silencio.
- Heidenhain: programación de contorno libre (FK) y sondas de contacto no implementadas.
- Ningún dato de la calculadora sustituye la verificación con el fabricante real de tu herramienta antes de mecanizar.

Para el detalle técnico completo de cada limitación, con su motivo documentado, consulta la tabla de cobertura del [README](README.md).
