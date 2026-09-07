# Créditos de las fotos

Ambas de Unsplash, bajo la [Unsplash License](https://unsplash.com/license)
(uso libre, comercial incluido, sin permiso previo; la atribución no es
obligatoria pero se agradece).

| Archivo | Foto | Autor | Enlace |
|---|---|---|---|
| `gimnasio-audifonos.jpg` | "A man wearing headphones in a gym" | Daniel Azmanov | https://unsplash.com/photos/45thVQsUffQ |
| `volante-estres.jpg` | "Man resting head on steering wheel in car" | Vitaly Gariev | https://unsplash.com/photos/67aPIxznblE |

Descargadas localmente a propósito: la presentación no debe depender de
tener internet el día del pitch.

Sustituyen a `gimnasio.jpg` (Alora Griffiths) y `trafico.jpg` (Jacek Dylag),
que iban de fondo a sangre: ninguna mostraba la música y el fondo completo se
comía la narración. Las nuevas van enmarcadas (ver `.scene` en `base.css`) y
en la del gimnasio los audífonos son visibles, que es lo que hace que la foto
hable de cuerpo y música a la vez.

## Carátulas de álbum (`covers/`)

Obtenidas de la API pública de búsqueda de iTunes (`itunes.apple.com/search`,
sin credenciales) y guardadas localmente para que la baraja funcione sin
internet. Se usan solo como identificación visual de la canción dentro de los
ejemplos narrados.

Deliberadamente NO se toman del CDN de Spotify: los Spotify Developer Terms
piden no cachear su contenido más allá del uso inmediato.

| Archivo | Canción |
|---|---|
| `till-i-collapse.jpg` | Till I Collapse — Eminem |
| `te-para-3.jpg` | Té Para 3 — Soda Stereo (MTV Unplugged) |
| `chop-suey.jpg` | Chop Suey! — System Of A Down |

## Fragmentos de audio (`../audio/`)

Los `.mp3` los aportó el autor de la presentación; aquí solo se recortaron de
nombre y se movieron a `audio/`. Son fragmentos de ~20 s que suenan durante el
pitch mientras la tarjeta de esa canción está en pantalla (ver el bloque de
audio al final de `index.html`).

| Archivo | Canción | Duración |
|---|---|---|
| `till-i-collapse.mp3` | Till I Collapse — Eminem | 18 s |
| `te-para-3.mp3` | Té Para 3 — Soda Stereo (MTV Unplugged) | 25 s |
| `chop-suey.mp3` | Chop Suey! — System Of A Down | 22 s |
