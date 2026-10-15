// JS compartido por los pitches derivados (tecnico/ y ventas/). Los bloques de
// abajo son copia literal de los de index.html (el pitch general): cada uno
// se desactiva solo si su diapositiva no existe en la baraja que lo carga.
Reveal.initialize({
  width: 1280,
  height: 720,
  margin: 0,
  controls: true,
  progress: true,
  slideNumber: false,
  hash: true,
  transition: "slide",
  center: false,
  // Notas del presentador (tecla S): solo en las barajas que cargan el
  // plugin (index.html, el pitch final).
  plugins: window.RevealNotes ? [RevealNotes] : [],
});

// Coreografía de la portada.
//
// Fases de entrada: 1) logo + título resaltados en el centro, 2) se
// reacomodan a la izquierda, 3) entra la demo a la derecha. Se reproduce
// al entrar a la diapositiva y se reinicia al salir.
//
// A partir de la fase 3 arranca el RELOJ DE ZONAS: un único temporizador
// gobierna el latido del corazón, la traza ECG, el número de BPM, el
// pulso del riel y el reordenamiento de la cola. Están encadenados a
// propósito — primero sube el pulso, después viaja la señal, y solo
// entonces cambia la cola — porque esa secuencia ES el argumento del
// pitch: el BPM manda, la playlist obedece.
(function () {
  var stage = document.getElementById("cover-stage");
  if (!stage) return;

  var monitor = stage.querySelector(".bpm-monitor");
  var number = stage.querySelector(".bpm-monitor-number");
  var zoneLabel = stage.querySelector(".bpm-monitor-zone");
  var link = stage.querySelector(".bpm-link");
  var frames = stage.querySelectorAll(".demo-queue-frame");
  var beating = monitor
    ? monitor.querySelectorAll(
        ".bpm-monitor-heart svg, .bpm-monitor-ring, .bpm-monitor-ecg-rail",
      )
    : [];

  // BPM de cada zona = el de la canción que suena en su frame de la cola.
  var ZONES = [
    { bpm: 67, tone: "calm", label: "Pulso en calma" },
    { bpm: 96, tone: "rising", label: "El pulso sube" },
    { bpm: 146, tone: "hot", label: "En esfuerzo" },
  ];

  var PHASE_MS = 3800; // cuánto dura cada zona en pantalla
  var LINK_MS = 380; // la señal sale del monitor…
  var QUEUE_MS = 900; // …y la cola responde medio segundo después

  var timers = [];
  var cycle = null;
  var countFrame = null;
  var zoneIndex = 0;
  var shownBpm = ZONES[0].bpm;
  var reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
    if (cycle) {
      clearInterval(cycle);
      cycle = null;
    }
    if (countFrame) {
      cancelAnimationFrame(countFrame);
      countFrame = null;
    }
  }

  // El número no salta: recorre el trayecto como lo haría una lectura real.
  function countTo(target) {
    if (!number) return;
    if (countFrame) cancelAnimationFrame(countFrame);
    var from = shownBpm;
    var start = performance.now();
    var span = 900;

    function step(now) {
      var t = Math.min(1, (now - start) / span);
      var eased = 1 - Math.pow(1 - t, 3);
      shownBpm = Math.round(from + (target - from) * eased);
      number.textContent = shownBpm;
      if (t < 1) countFrame = requestAnimationFrame(step);
      else countFrame = null;
    }
    countFrame = requestAnimationFrame(step);
  }

  // Reinicia latido, onda y ECG en el mismo frame: como el ciclo del ECG
  // dura exactamente 4 latidos, arrancar juntos los deja sincronizados
  // sin tener que calcular offsets.
  function restartBeat() {
    beating.forEach(function (el) {
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    });
  }

  function showFrame(i) {
    frames.forEach(function (frame, index) {
      frame.classList.toggle("is-active", index === i);
    });
  }

  function applyZone(i, animateChain) {
    var zone = ZONES[i];
    stage.dataset.zone = zone.tone;
    stage.style.setProperty("--beat", (60 / zone.bpm).toFixed(3) + "s");
    restartBeat();
    countTo(zone.bpm);

    if (zoneLabel) {
      zoneLabel.classList.add("is-swapping");
      later(function () {
        zoneLabel.textContent = zone.label;
        zoneLabel.classList.remove("is-swapping");
      }, 260);
    }

    if (!animateChain) {
      showFrame(i);
      return;
    }

    later(function () {
      if (link) {
        link.classList.remove("is-firing");
        void link.offsetWidth;
        link.classList.add("is-firing");
      }
    }, LINK_MS);

    later(function () {
      showFrame(i);
    }, QUEUE_MS);
  }

  function startZoneClock() {
    zoneIndex = 0;
    shownBpm = ZONES[0].bpm;
    applyZone(0, false);
    if (reduced) return;
    cycle = setInterval(function () {
      zoneIndex = (zoneIndex + 1) % ZONES.length;
      applyZone(zoneIndex, true);
    }, PHASE_MS);
  }

  function reset() {
    clearTimers();
    stage.classList.remove("rearranged", "show-demo");
    if (link) link.classList.remove("is-firing");
    showFrame(-1);
  }

  function playCoverIntro() {
    reset();
    void stage.offsetWidth; // forzar reflow para reiniciar las transiciones
    if (reduced) {
      stage.classList.add("rearranged", "show-demo");
      startZoneClock();
      return;
    }
    // Los glifos aterrizan cerca de 1.6s y la descripción entra a 2s;
    // el bloque se queda así, centrado, hasta 3.2s.
    later(function () {
      stage.classList.add("rearranged");
    }, 3200);
    // El reacomodo tarda 1.1s: el equipo entra al asentarse y la demo
    // después de él, nunca encima.
    later(function () {
      stage.classList.add("show-demo");
      startZoneClock();
    }, 4700);
  }

  function onSlideChange(event) {
    var slide = event.currentSlide;
    if (slide && slide.id === "title") playCoverIntro();
    else reset();
  }

  Reveal.on("ready", onSlideChange);
  Reveal.on("slidechanged", onSlideChange);
})();

// Diapositivas narradas: los fragmentos no solo aparecen, también
// cambian el ESTADO de la diapositiva.
//
//  - data-scene: el fragmento fija una escena en su <section> (el
//    aleatorio que rompe la sincronía en el gimnasio).
//  - data-stress: el fragmento mueve el medidor de estrés de la mañana.
//
// Ambas se recalculan desde CERO en cada evento, recorriendo los
// fragmentos ya visibles, en vez de aplicar solo el que se acaba de
// revelar: así retroceder con la flecha izquierda deshace el estado
// correctamente en lugar de dejarlo pegado en el último valor.
(function () {
  function currentSlide() {
    return Reveal.getCurrentSlide();
  }

  // El que manda es el orden de la NARRACIÓN (data-fragment-index), no el
  // del documento: en la mañana la escena va primero en el DOM pero su
  // tarjeta se revela hasta el final, así que recorrer el DOM y quedarse
  // con el último visible dejaba el medidor corto.
  function lastVisible(slide, attr) {
    var seen = null;
    var seenAt = -Infinity;
    slide
      .querySelectorAll(".fragment[data-" + attr + "]")
      .forEach(function (el, i) {
        if (!el.classList.contains("visible")) return;
        var at =
          el.dataset.fragmentIndex === undefined
            ? i
            : Number(el.dataset.fragmentIndex);
        if (at >= seenAt) {
          seenAt = at;
          seen = el.dataset[attr];
        }
      });
    return seen;
  }

  function sync() {
    var slide = currentSlide();
    if (!slide) return;

    var scene = lastVisible(slide, "scene");
    if (scene) slide.dataset.scene = scene;
    else delete slide.dataset.scene;

    var fill = slide.querySelector(".stress-fill");
    if (fill)
      fill.style.width = (lastVisible(slide, "stress") || 0) + "%";
  }

  Reveal.on("ready", sync);
  Reveal.on("slidechanged", sync);
  Reveal.on("fragmentshown", sync);
  Reveal.on("fragmenthidden", sync);
})();

// Fragmentos de las canciones narradas.
//
// Cada tarjeta de canción declara su archivo en data-audio y suena
// mientras esa tarjeta esté ACTIVA en pantalla. "Activa" son dos cosas
// distintas a la vez:
//
//  - su fragmento ya se reveló (data-fragment-index manda sobre el orden
//    del documento, igual que en el medidor de estrés), y
//  - si declara data-audio-scene, la escena de la diapositiva coincide.
//    En el gimnasio las dos canciones viven en el MISMO fragmento y quien
//    decide cuál se ve —y cuál suena— es el aleatorio: "broken" para la
//    canción en calma, "!broken" para la que iba a tope.
//
// Al cambiar de diapositiva o de canción, la anterior se desvanece y
// arranca la nueva; se recalcula desde cero en cada evento, así que
// retroceder con la flecha izquierda también deshace el audio.
//
// Va DESPUÉS del script de escenas a propósito: los oyentes corren en
// orden de registro y este necesita leer el data-scene ya actualizado.
(function () {
  var FADE_MS = 260;
  var TICK_MS = 40;

  var players = {}; // ruta -> <audio>, uno por canción, reutilizado
  var playingSrc = null; // la que debería estar sonando ahora
  var blockedSrc = null; // la que el navegador no dejó arrancar todavía

  function player(src) {
    if (!players[src]) {
      var a = new Audio(src);
      // El fragmento dura ~20s y el presentador puede tardar más en esa
      // tarjeta: en loop se sostiene sola, sin silencio a media narración.
      a.loop = true;
      a.preload = "auto";
      players[src] = a;
    }
    return players[src];
  }

  function fade(audio, to, done) {
    clearInterval(audio.fadeTimer);
    var step = (to - audio.volume) / Math.max(1, FADE_MS / TICK_MS);
    audio.fadeTimer = setInterval(function () {
      var v = Math.min(1, Math.max(0, audio.volume + step));
      audio.volume = v;
      if (v === to) {
        clearInterval(audio.fadeTimer);
        if (done) done();
      }
    }, TICK_MS);
  }

  function stop(src) {
    var a = players[src];
    if (!a) return;
    fade(a, 0, function () {
      a.pause();
      a.currentTime = 0;
    });
  }

  function start(src) {
    var a = player(src);
    a.volume = 0;
    var attempt = a.play();
    // Ningún navegador deja sonar audio antes del primer gesto del
    // usuario. Si lo bloquea, se anota y se reintenta con el gesto
    // siguiente — que en una presentación es la flecha de avanzar.
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        blockedSrc = src;
      });
    }
    fade(a, 1);
  }

  function activeSrc() {
    var slide = Reveal.getCurrentSlide();
    if (!slide) return null;

    var scene = slide.dataset.scene || "";
    var found = null;
    var foundAt = -Infinity;

    slide.querySelectorAll("[data-audio]").forEach(function (el, i) {
      var frag = el.closest(".fragment");
      if (frag && !frag.classList.contains("visible")) return;

      var want = el.dataset.audioScene;
      if (want) {
        var negated = want.charAt(0) === "!";
        var name = negated ? want.slice(1) : want;
        if (negated ? scene === name : scene !== name) return;
      }

      var at =
        frag && frag.dataset.fragmentIndex !== undefined
          ? Number(frag.dataset.fragmentIndex)
          : i;
      if (at >= foundAt) {
        foundAt = at;
        found = el.dataset.audio;
      }
    });

    return found;
  }

  function sync() {
    var src = activeSrc();
    if (src === playingSrc) return;
    if (playingSrc) stop(playingSrc);
    playingSrc = src;
    blockedSrc = null;
    if (src) start(src);
  }

  ["pointerdown", "keydown"].forEach(function (evt) {
    document.addEventListener(evt, function () {
      if (blockedSrc && blockedSrc === playingSrc) {
        var src = blockedSrc;
        blockedSrc = null;
        start(src);
      }
    });
  });

  Reveal.on("ready", sync);
  Reveal.on("slidechanged", sync);
  Reveal.on("fragmentshown", sync);
  Reveal.on("fragmenthidden", sync);
})();

// Maqueta de configuración: alterna sola entre modo zen y modo
// ejercicio mientras la diapositiva está en pantalla. (El modo zen se
// llama "estudio" en el data-mode y en los selectores de base.css: es
// el nombre interno, anterior al cambio de nombre visible.) Enseñar la
// configuración CAMBIANDO comunica "es configurable" mucho mejor que
// una viñeta que lo prometa; el CSS deriva de data-mode el selector, la
// regla, el rango, el color y qué tarjeta se enciende.
(function () {
  var slide = document.getElementById("adapts");
  if (!slide) return;

  var bpmOut = slide.querySelector(".phone-bpm");
  var MODES = [
    { name: "estudio", bpm: 78 },
    { name: "ejercicio", bpm: 146 },
  ];
  var SWITCH_MS = 3600;

  var at = 0;
  var timer = null;
  var raf = null;
  var shown = MODES[0].bpm;

  // El pulso de la sesión recorre el trayecto en vez de saltar: es el
  // mismo gesto que el número del monitor de la portada.
  function countTo(target) {
    if (!bpmOut) return;
    if (raf) cancelAnimationFrame(raf);
    var from = shown,
      t0 = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - t0) / 900);
      shown = Math.round(
        from + (target - from) * (1 - Math.pow(1 - t, 3)),
      );
      bpmOut.textContent = shown;
      raf = t < 1 ? requestAnimationFrame(step) : null;
    })(performance.now());
  }

  function apply(i) {
    slide.dataset.mode = MODES[i].name;
    countTo(MODES[i].bpm);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function start() {
    stop();
    at = 0;
    shown = MODES[0].bpm;
    apply(0);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    timer = setInterval(function () {
      at = (at + 1) % MODES.length;
      apply(at);
    }, SWITCH_MS);
  }

  Reveal.on("slidechanged", function (e) {
    if (e.currentSlide === slide) start();
    else stop();
  });
  Reveal.on("ready", function (e) {
    if (e.currentSlide === slide) start();
  });
})();

// Cifras que se cuentan al entrar a su diapositiva, en vez de aparecer ya
// escritas: el número recorriendo su rango es lo que hace que el dato se
// registre. Se reinicia cada vez que se entra, para que también funcione
// al regresar sobre la baraja.
(function () {
  var running = [];

  function stop() {
    running.forEach(cancelAnimationFrame);
    running = [];
  }

  function play(slide) {
    stop();
    if (!slide) return;
    var reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    slide.querySelectorAll("[data-count-to]").forEach(function (el, i) {
      var to = parseFloat(el.dataset.countTo);
      var from = parseFloat(el.dataset.countFrom || 0);
      var pre = el.dataset.countPrefix || "";
      var suf = el.dataset.countSuffix || "";

      if (reduce) {
        el.textContent = pre + to + suf;
        return;
      }

      el.textContent = pre + from + suf;
      var delay = 350 + i * 200;
      var span = 1100;
      var t0 = performance.now() + delay;

      (function step(now) {
        var t = Math.max(0, Math.min(1, (now - t0) / span));
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent =
          pre + Math.round(from + (to - from) * eased) + suf;
        if (t < 1) running.push(requestAnimationFrame(step));
      })(performance.now());
    });
  }

  Reveal.on("ready", function (e) {
    play(e.currentSlide);
  });
  Reveal.on("slidechanged", function (e) {
    play(e.currentSlide);
  });
})();
