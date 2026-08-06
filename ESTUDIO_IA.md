# Estudio técnico: ¿merece la pena conectar una IA a CNC Studio Pro?

Análisis pedido como responsable técnico. Conclusión al final, con justificación, no por comodidad.

---

## 1. La restricción que decide casi todo

Antes de comparar proveedores hay que fijar la restricción arquitectónica real, porque descarta opciones enteras por sí sola:

**CNC Studio Pro es un único archivo HTML estático, pensado para publicarse en GitHub Pages y para funcionar abriéndolo desde el disco, sin servidor.**

De ahí se deduce, sin necesidad de mirar precios:

- **Una clave de API NO puede vivir dentro del archivo.** GitHub Pages sirve el archivo tal cual: cualquier alumno abre "ver código fuente" y tiene la clave. No es un riesgo teórico — es una filtración garantizada, y con facturación asociada. Esto elimina de raíz la idea de "meto una clave de Gemini/OpenAI y listo".
- Por tanto, cualquier IA exige **una de estas tres arquitecturas**, y solo tres:
  1. **BYOK** (*Bring Your Own Key*): cada usuario pega su propia clave, que se queda en su navegador.
  2. **Backend propio como intermediario**: la clave vive en el servidor, el navegador habla con el servidor.
  3. **Modelo local**: el modelo corre en el ordenador del usuario, sin clave ni Internet.

Todo lo demás es una variante de estas tres.

---

## 2. Proveedores de modelo

| Opción | Coste real | Límites | Privacidad | Veredicto para este proyecto |
|---|---|---|---|---|
| **Gemini API (free tier)** | 0 € sin tarjeta | ~1.500 peticiones/día, 10-15/min en Flash; los modelos Pro pasaron a ser solo de pago | ⚠️ Google puede usar los prompts para entrenar en el nivel gratuito | **La mejor opción gratuita.** El límite diario es holgado para un aula. La cesión de datos es aceptable aquí (programas CNC de ejercicio, no información sensible), pero hay que decirlo al usuario. |
| **OpenRouter** | Pago por uso; tiene modelos gratuitos con límites bajos | Variables por modelo | Depende del modelo enrutado | Útil como *puerta única* a muchos modelos con una sola integración. Buena opción si se quiere dar a elegir. |
| **OpenAI API** | Solo de pago, sin nivel gratuito real | Altos si se paga | Buena (no entrena con datos de API por defecto) | Sin ventaja decisiva aquí que justifique el coste frente a Gemini Flash. |
| **Ollama (local)** | 0 € | Los del ordenador del usuario | ✅ Total: nada sale del equipo | **Excelente para un centro educativo.** Requiere instalación y un equipo decente. Necesita configurar CORS (`OLLAMA_ORIGINS`) para que una página web pueda hablarle. |
| **LM Studio (local)** | 0 € | Los del equipo | ✅ Total | Igual que Ollama pero con interfaz gráfica; expone un servidor compatible con OpenAI. Más fácil para alguien no técnico. |

---

## 3. Dónde alojar un backend, si hiciera falta

| Opción | Coste | Mantenimiento | Veredicto |
|---|---|---|---|
| **Cloudflare Workers** | Nivel gratuito amplio | Muy bajo; sin servidor que administrar | **La mejor opción de backend.** Un único *worker* de ~30 líneas que guarda la clave y reenvía la petición. Despliegue en minutos. |
| **Vercel / Netlify Functions** | Nivel gratuito | Bajo | Equivalente, algo más pesado. Válido. |
| **Railway / Render / Fly.io** | Gratis limitado o de pago | Medio | Pensados para servicios que corren siempre. Sobredimensionado para reenviar una petición. |
| **VPS propio** | 3-6 €/mes | **Alto**: actualizaciones, seguridad, certificados, copias | No compensa para esta función. |
| **Raspberry Pi en casa** | Luz | **Alto**: IP dinámica, apertura de puertos, disponibilidad | Es un proyecto en sí mismo. Además, si el aula depende de que tu Pi esté encendida, el simulador deja de ser fiable. |
| **Servidor propio del centro** | Depende | Depende de que haya alguien que lo mantenga | Solo si el centro ya tiene infraestructura y quien la administre. |

**Aviso importante sobre el backend**: en cuanto pones un intermediario con TU clave, cualquiera que encuentre la URL puede gastar tu cuota. Haría falta, como mínimo, limitar peticiones por IP y restringir el origen. Eso es mantenimiento real y recurrente, no "lo despliego y me olvido".

---

## 4. Qué aportaría de verdad una IA, y qué no

Esta es la parte que decide, más que el precio.

**Lo que el asesor de reglas ya hace, y una IA NO haría mejor:**
- Explicar ciclos y parámetros: el proyecto tiene la documentación oficial ya verificada, ciclo a ciclo, con fuentes contrastadas. Una IA generalista daría respuestas *plausibles* sobre Fagor y Heidenhain, y este proyecto lleva toda su vida evitando exactamente eso. **Sería un retroceso en rigor.**
- Detectar los fallos que ya detecta: son deterministas, instantáneos, gratuitos y funcionan sin Internet. Una IA sería más lenta, más cara y menos fiable para lo mismo.

**Lo que una IA sí aportaría de verdad:**
- Responder preguntas abiertas en lenguaje natural ("¿por qué me sale mal el acabado en esta pared?").
- Explicar el programa *concreto* del alumno con sus palabras, adaptándose a su nivel.
- Generar un programa de partida desde una descripción ("quiero una cajera de 40×20 centrada, 5 de profundidad").
- Reformular una explicación cuando el alumno no la entiende a la primera. Esto es genuinamente valioso en enseñanza y las reglas no lo pueden hacer.

**El riesgo pedagógico, que es el argumento más serio en contra**: un alumno de FP no puede distinguir cuándo la IA acierta y cuándo inventa. Si la IA se equivoca sobre un parámetro de Fagor, el alumno lo aprende mal. En un simulador cuyo valor principal es *ser fiable*, eso es un daño real.

---

## 5. Recomendación

**Sí merece la pena, pero solo con esta arquitectura concreta:**

### Sistema híbrido, en tres capas, con el núcleo intacto

1. **Capa determinista (la que ya existe y sigue mandando).** El asesor de reglas, la calculadora y toda la validación siguen funcionando **exactamente igual, sin Internet, sin claves y sin cambios**. Es la fuente de verdad del proyecto. Nada de lo que decida una IA puede contradecirla ni sustituirla.

2. **Capa IA opcional, apagada por defecto.** Aparece como una pestaña o botón claramente separado ("Preguntar al asistente IA"), con un aviso visible de que esas respuestas son orientativas y no están verificadas contra documentación oficial, a diferencia del resto del programa.

3. **Conexión configurable por el usuario, sin clave en el archivo:**
   - **Opción A — BYOK con Gemini Flash**: el usuario pega su clave gratuita (se guarda solo en su navegador, nunca viaja al proyecto). Coste para ti: cero. Coste para el alumno: cero. Sin backend que mantener.
   - **Opción B — Modelo local (Ollama / LM Studio)**: el usuario indica la dirección local. Privacidad total, funciona sin Internet, ideal si el centro tiene equipos capaces.
   - **Opción C — Cloudflare Worker propio**: solo si algún día quieres que funcione sin que cada alumno configure nada. Es la única que requiere mantenimiento tuyo.

**Por qué esta arquitectura y no otra**: es la única que añade lo que la IA aporta de verdad (lenguaje natural, adaptación al alumno) **sin poner en riesgo lo que hace bueno al proyecto** (rigor verificado, funcionamiento sin Internet, coste cero, sin mantenimiento). Si mañana Google cambia sus límites, si el aula no tiene Internet, o si nadie configura nada, el simulador sigue funcionando al 100% de lo que hace hoy.

**Lo que descarto explícitamente, y por qué:**
- **Clave en el archivo**: filtración garantizada. No es negociable.
- **VPS, Raspberry Pi o servidor propio**: el coste de mantenimiento supera con mucho el beneficio de evitarle al usuario pegar una clave.
- **Sustituir el asesor de reglas por IA**: sería cambiar conocimiento verificado por conocimiento plausible. Es exactamente lo contrario de lo que este proyecto ha hecho durante toda su vida.

---

## 6. Estado actual y decisión de alcance

**No se ha implementado la capa de IA en esta sesión**, deliberadamente. Motivos:

1. La prioridad absoluta que fijaste era convertir el asistente en un profesor CNC de verdad. Eso **está hecho y probado**, con conocimiento verificado y sin depender de nada externo — que es la base sobre la que cualquier IA tendría que apoyarse después.
2. Añadir la capa de IA implica interfaz nueva (configuración de proveedor, gestión de clave, historial de conversación, manejo de errores de red), y hacerlo con prisa al final de una sesión larga es la mejor forma de meter fallos en un producto que ahora mismo está estable y con 100 pruebas en verde.
3. La decisión de proveedor (BYOK vs local vs Worker) depende de algo que solo tú sabes: si los equipos del aula tienen Internet, si puedes pedir a los alumnos que se saquen una clave gratuita, y si quieres asumir mantenimiento.

**Es la primera tarea recomendada para una sesión futura**, con el diseño ya cerrado en este documento: no habría que investigar nada más, solo implementarlo.

---

## 7. REVISIÓN ACTUALIZADA (segunda pasada, con datos de mediados de 2026)

Se volvió a investigar con datos actuales. **Sí ha aparecido información que cambia el análisis anterior.**

### Lo que ha cambiado

| Hallazgo nuevo | Consecuencia |
|---|---|
| **Groq** publica los límites gratuitos más generosos del mercado: ~30 peticiones/min y ~14.400/día en `llama-3.1-8b-instant`, con API **compatible con OpenAI** y hardware muy rápido. | **Es ahora la mejor opción gratuita por volumen**, y no aparecía en el análisis anterior. Sus modelos grandes son mucho más restrictivos (~1.000 peticiones/día). |
| **Google dejó de publicar los límites del nivel gratuito de Gemini** (página de límites actualizada en julio de 2026): ahora remite a consultarlos en tu propia cuenta. | Ya no se puede prometer una cifra concreta. Sigue siendo válido, pero es menos predecible para planificar un aula. |
| **El uso comercial del nivel gratuito de Gemini está excluido en la UE/EEE/Reino Unido/Suiza.** | **Relevante para un centro español.** Para uso educativo gratuito no debería aplicar, pero conviene saberlo antes de montarlo en un centro. |
| **El catálogo de modelos gratuitos de OpenRouter ROTA.** Modelos gratuitos populares (DeepSeek, Mistral, variantes de Gemini) han desaparecido y han entrado otros. | **Riesgo real para un producto educativo estable**: fijar un modelo concreto puede dejar de funcionar sin aviso. Obliga a permitir elegir el modelo, no a fijarlo por dentro. |
| OpenRouter gratuito: ~20 pet./min y 50-200/día sin tarjeta (1.000/día con 10 $ una vez). **BYOK: 1 millón de peticiones de enrutado gratis al mes.** | Sigue siendo la mejor "puerta única" a muchos modelos con una sola integración. |
| **Cerebras** (~1M tokens/día) y **Mistral** (nivel Experiment, ~1.000M tokens/mes pero **obligando a ceder datos para entrenamiento**). | Alternativas válidas; la de Mistral con una contrapartida de privacidad que en un aula conviene pensar. |

### La conclusión que sí cambia el diseño

Casi todo el mercado gratuito (**Groq, OpenRouter, LM Studio, Ollama**) habla el **mismo formato compatible con OpenAI**. Solo Gemini usa uno distinto.

Eso significa que **no hay que elegir proveedor ahora**: con **un solo adaptador compatible con OpenAI** (cambiando la URL base) quedan cubiertos cuatro de los cinco candidatos, y con un segundo adaptador se cubre Gemini. Es exactamente así como se ha implementado la arquitectura del copiloto en el simulador.

### ¿Hay alguna opción claramente superior a las anteriores?

**Para volumen y velocidad, sí: Groq**, por sus límites publicados y su compatibilidad con OpenAI. **Para privacidad total, sigue siendo el modelo local** (Ollama / LM Studio), que además funciona sin Internet — algo que en un aula con red inestable no es un detalle menor.

**Pero ninguna cambia la decisión de fondo**, que no depende del proveedor: un archivo estático no puede contener una clave sin filtrarla, así que la vía sigue siendo **BYOK o modelo local**. Lo único que ha cambiado es que ahora hay **más y mejores opciones dentro de esa misma vía**, y que la arquitectura correcta es un adaptador compatible con OpenAI en vez de atarse a un proveedor.

### Estado de implementación

**La arquitectura está construida y probada; ninguna IA está conectada, a propósito.** En el simulador ya existen:
- Los dos adaptadores (`COPILOT_PROVIDERS`: compatible con OpenAI, y Gemini).
- El constructor de contexto verificado (`buildCopilotContext`), con instrucciones de sistema que **prohíben explícitamente inventar comportamiento de Fagor o Heidenhain** y obligan a decir "no lo sé".
- El motor de respuesta **sin IA** (`answerFromRules`), que es el que funciona hoy.
- El punto de entrada único (`askCopilot`), que intentaría la IA si algún día hay proveedor configurado y **cae al motor de reglas si falla cualquier cosa**.

Sin proveedor configurado —que es el estado actual— **no sale ninguna petición de red**. Verificado con una prueba automatizada.
