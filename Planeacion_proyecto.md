Nombre del proyecto:

## Physical

**Contexto**: Proyecto para el U-Challenge (feria del emprendimiento de la Universidad Anáhuac Mayab).

**Concepto**: Aplicación móvil que se conecte a una banda que haga mediciones en tiempo real de tu BPM y utilizando la API de Spotify adapte tu queue de canciones de acuerdo a este. El efecto que tendría será configurable (se podrá configurar si, a más pulsaciones, canciones más aceleradas o menos aceleradas, en una especie de modo estudio / modo ejercicio).
Originalmente se planeaba hacer una app de streaming completa (similar a spotify), pero con esta y otras funciones integradas, pero fue parcialmente desechada por exceso de complejidad. Actualmente, como parte del Pitch, también se está comtemplando vender Physical como un "ecosistema", del cuál la función de música según BPM en tiempo real sea una parte nada más, pero aún está trabajándose la idea.

**Concepto para prototipo**:
Una banda que mida pulsaciones, en conjunto con una aplicación móvil que se conecte por Bluetooth, y utilizando la API de Spotify controle la queue y playback del usuario de acuerdo a lo medido por la pulsera.

**Planeación y stack actual**:

Banda ESP-32 -> Se conecta por Bluetooth (ESP-32) a un teléfono -> El teléfono tiene una sesión de Spotify abierta, utilizando la API para controlar el playback.

Cuando se inicia una sesión de escucha:
La app empieza a leer datos de la banda ->
Compara contra la base de datos que tiene de las canciones guardades y que le gustan del usuario (extraídas de la API de Spotify). ->
Utiliza esta base de datos (que es un cross referencing de alguna base de datos que almacene los BPM de las canciones y las canciones guardadas del usuario) para elegir una canción que quede dentro del rango de BPM establecido para las pulsaciones actuales ->
Las añade a la cola, o si el cambio es demasiado drástico, skippea a la siguiente canción. ->
Al terminar la sesión, desactivar el sensor de la pulsera.

Pitch:

Se pitcheará a partir de la frase
"Haz que tu música nunca más te vuelva a sacar del momento que estás viviendo"
o algo parecido.

- Vender como una necesidad
  "Haz que tu música siempre se adapte al momento en el que estás"

PRECIO DE VENTA:
Costo estimado actual de producir el prototipo:

- $120 aprox ESP-32
- $100 aprox sensor BPM
- $50 aprox batería
- $50 aprox materiales para armar como "banda", cables, etc
  Total: $320
  A la hora de marketear el producto, hacer énfasis que en la producción, al no tener que comprar componentes de maqueteo, el precio será mucho menor.

Presentación: Falta armar la presentación.
