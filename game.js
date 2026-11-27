(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const D = window.I18N;

  // ---------- stato ----------
  let lang = "it";
  try { lang = localStorage.getItem("adm-lang") || "it"; } catch (e) {}
  if (!["it", "sc", "calle"].includes(lang)) lang = "it";
  let screen = "s-gate";
  let cls = +(new URLSearchParams(location.search).get("cls") || 0);
  let langReturn = "s-title";
  let seqTimer = null;
  let screenAt = 0;

  // ---------- testi ----------
  const txt = key => (lang === "sc" ? D.sc : D.it)[key];
  const hash = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

  // Bolla di un vocale WhatsApp al posto di una scritta
  function vm(text) {
    // vocali di Calle: tutti sopra i 6 minuti, più lungo il testo più lungo il vocale
    const secs = 360 + (hash(text) % 180) + text.length * 2;
    const h = hash(text);
    const bars = Math.min(48, Math.max(18, 14 + Math.round(text.length / 4)));
    let wf = "";
    let r = h;
    for (let i = 0; i < bars; i++) {
      r = (r * 1103515245 + 12345) >>> 0;
      const v = 3 + ((r >>> 16) % 17);
      wf += `<i style="height:${v}px"></i>`;
    }
    const dur = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    return `<span class="vm" data-secs="${secs}" data-seed="${h % 233280}" data-dur="${dur}">` +
      `<span class="av"></span><span class="pl"></span><span class="wf">${wf}</span>` +
      `<span class="du">${dur}</span><span class="ck">✓✓</span></span>`;
  }
  const put = (el, key) => {
    if (lang === "calle") el.innerHTML = vm(D.it[key]);
    else el.textContent = txt(key);
  };
  const putText = (el, s) => { if (lang === "calle") el.innerHTML = vm(s); else el.textContent = s; };

  // riproduzione vocale
  let playing = null;
  function playVm(el) {
    if (!el) return;
    if (playing) { playing.stop(); if (playing.el === el) { playing = null; return; } }
    const secs = +el.dataset.secs;
    const stop = SFX.voice(secs, +el.dataset.seed);
    const bars = [...el.querySelectorAll(".wf i")];
    const du = el.querySelector(".du");
    const t0 = performance.now();
    el.classList.add("playing");
    const me = { el, stop: () => { stop(); cancelAnimationFrame(me.raf); reset(); } };
    function reset() {
      el.classList.remove("playing");
      bars.forEach(b => b.classList.remove("done"));
      du.textContent = el.dataset.dur;
    }
    (function step() {
      const p = (performance.now() - t0) / 1000;
      const k = Math.min(1, p / secs);
      bars.forEach((b, i) => b.classList.toggle("done", i / bars.length < k));
      const left = Math.max(0, Math.ceil(p));
      const sh = Math.min(left, secs);
      du.textContent = `${Math.floor(sh / 60)}:${String(sh % 60).padStart(2, "0")}`;
      if (k < 1) me.raf = requestAnimationFrame(step);
      else { reset(); if (playing === me) playing = null; }
    })();
    playing = me;
  }
  document.addEventListener("click", e => {
    const v = e.target.closest(".vm");
    if (v && SFX.ready) playVm(v);
  });

  function applyLang() {
    document.body.classList.toggle("calle", lang === "calle");
    document.documentElement.lang = lang === "sc" ? "sc" : "it";
    $$("[data-i18n]").forEach(el => put(el, el.dataset.i18n));
    const title = $(".game-title");
    if (lang === "calle") title.innerHTML = `<span class="t1">${vm("L'Anima")}</span><span class="t2">${vm("della Schifa")}</span>`;
    else title.innerHTML = `<span class="t1">L'Anima</span><span class="t2">della Schifa</span>`;
    $("#cc-name").placeholder = lang === "calle" ? "🎤 ..." : txt("cc_name_ph");
    $$("[data-lang]").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
    renderCC();
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem("adm-lang", l); } catch (e) {}
    applyLang();
  }

  // ---------- schermate ----------
  function show(id) {
    if (playing) { playing.stop(); playing = null; }
    $$(".screen").forEach(s => s.classList.toggle("active", s.id === id));
    screen = id;
    screenAt = performance.now();
    document.body.dataset.screen = id;
  }
  function after(ms, fn) { clearTimeout(seqTimer); seqTimer = setTimeout(fn, ms); }

  const intro = {
    "s-warn": () => {
      show("s-warn");
      const r = $("#s-warn .rating");
      setTimeout(() => { r.classList.add("struck"); SFX.back(); }, 2600);
      setTimeout(() => r.classList.add("gone"), 3000);
      setTimeout(() => { r.classList.add("stamped"); SFX.confirm(); }, 3400);
      after(7000, intro["s-bighorses"]);
    },
    "s-bighorses": () => { show("s-bighorses"); SFX.duck(0.04, 0.6); setTimeout(() => SFX.horses(), 300); after(4600, intro["s-bignotti"]); },
    "s-bignotti": () => { show("s-bignotti"); neonShow(); after(4600, intro["s-title"]); },
    "s-title": () => { clearTimeout(seqTimer); show("s-title"); SFX.duck(0.22, 4); menuSel("#title-menu", 0); },
  };
  // Accensioni del neon BigNotti: [secondi, luminosità]. La stessa tabella guida luce e ronzio.
  const NEON_MARK = [[0.3, 1], [0.36, 0], [0.48, 1], [0.6, 0], [0.95, 1], [1.02, 0.25], [1.1, 1]];
  const NEON_NAME = [[1.45, 1], [1.5, 0], [1.62, 1], [1.72, 0.2], [1.8, 1], [2.25, 0], [2.4, 1]];
  let neonTimers = [];
  function neonShow() {
    neonTimers.forEach(clearTimeout); neonTimers = [];
    const mark = $("#s-bignotti .bn-mark"), name = $("#s-bignotti .bn-name"), tag = $("#s-bignotti .bn-tag");
    [mark, name, tag].forEach(el => el.style.opacity = 0);
    const at = (d, fn) => neonTimers.push(setTimeout(fn, d * 1000));
    NEON_MARK.forEach(([d, v]) => at(d, () => mark.style.opacity = v));
    NEON_NAME.forEach(([d, v]) => at(d, () => name.style.opacity = v));
    at(2.8, () => tag.style.opacity = 1);
    // per l'audio: luminosità complessiva (bicchiere 60%, scritta 40%) a ogni cambio
    let m = 0, n = 0;
    const ev = [...NEON_MARK.map(e => [...e, "m"]), ...NEON_NAME.map(e => [...e, "n"])]
      .sort((a, b) => a[0] - b[0])
      .map(([d, v, w]) => { if (w === "m") m = v; else n = v; return [d, m * 0.6 + n * 0.4]; });
    SFX.notti(ev, 4.4);
  }
  const introOrder = ["s-warn", "s-bighorses", "s-bignotti", "s-title"];
  function skipIntro() {
    if (performance.now() - screenAt < 900) return;
    const i = introOrder.indexOf(screen);
    if (i >= 0 && i < 3) intro[introOrder[i + 1]]();
  }

  function start() {
    if (screen !== "s-gate") return;
    SFX.init();
    SFX.ambient();
    intro["s-warn"]();
  }
  $("#s-gate").addEventListener("click", start);

  // ---------- menu generici ----------
  const sel = {};
  function menuSel(menu, i) {
    const btns = $$(menu + " button");
    sel[menu] = (i + btns.length) % btns.length;
    btns.forEach((b, k) => b.classList.toggle("sel", k === sel[menu]));
    if (lang === "calle") playVm(btns[sel[menu]].querySelector(".vm"));
  }
  $$(".menu").forEach(m => {
    const id = "#" + m.id;
    [...m.children].forEach((b, k) => b.addEventListener("mouseenter", () => {
      if (sel[id] !== k) { SFX.move(); sel[id] = k; [...m.children].forEach((x, j) => x.classList.toggle("sel", j === k)); }
    }));
  });

  function titleAct(act) {
    if (act === "quit") SFX.deny(); else SFX.confirm();
    if (act === "new") { show("s-cc"); renderCC(); setTimeout(revealSelected, 60); }
    if (act === "lang") { langReturn = "s-title"; show("s-lang"); menuSel("#lang-menu", ["it", "sc", "calle"].indexOf(lang)); }
    if (act === "credits") { show("s-credits"); }
    if (act === "quit") {
      const t = $("#quit-toast"); t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 2200);
      if (lang === "calle") playVm(t.querySelector(".vm"));
    }
  }
  $("#title-menu").addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) titleAct(b.dataset.act);
  });
  $$("[data-lang]").forEach(b => b.addEventListener("click", () => {
    SFX.confirm(); setLang(b.dataset.lang);
    if (screen === "s-lang") { show(langReturn); if (langReturn === "s-title") menuSel("#title-menu", 1); }
  }));

  // ---------- crediti: copie statiche dei due loghi ----------
  function cloneLogo(srcSel, dest, suffix) {
    const html = $(srcSel).outerHTML.replace(/id="(bhc|bhlines)"/g, `id="$1${suffix}"`).replace(/url\(#(bhc|bhlines)\)/g, `url(#$1${suffix})`);
    dest.insertAdjacentHTML("afterbegin", html);
    dest.querySelectorAll(".bh-tag, .bn-tag").forEach(el => el.remove()); // niente tagline duplicate
  }
  cloneLogo("#s-bighorses .bh", $(".cr-bh"), "-cr");
  cloneLogo("#s-bignotti .bn", $(".cr-bn"), "-cr");
  $("#cr-back").addEventListener("click", () => { SFX.back(); show("s-title"); menuSel("#title-menu", 2); });

  // ---------- creazione personaggio ----------
  const AVG = 11;
  function renderCC() {
    const list = $("#class-list");
    list.innerHTML = "";
    CLASSES.forEach((c, i) => {
      const li = document.createElement("li");
      putText(li, (lang === "sc" ? D.sc : D.it)[c.key + "_n"]);
      if (lang === "calle") li.innerHTML = vm(D.it[c.key + "_n"]);
      li.classList.toggle("sel", i === cls);
      li.addEventListener("click", () => pick(i));
      list.appendChild(li);
    });
    const c = CLASSES[cls];
    const T = lang === "sc" ? D.sc : D.it;
    const img = $("#cc-portrait");
    if (!img.getAttribute("src")) img.src = c.img;
    putText($("#cc-classname"), lang === "calle" ? D.it[c.key + "_n"] : T[c.key + "_n"]);
    $("#cc-lvl").textContent = c.lvl;
    $("#stat-list").innerHTML = STAT_KEYS.map(k => {
      const v = c.st[k];
      const cl = k === "pol" || k === "sfi" ? "down" : v > AVG + 2 ? "up" : v < AVG - 2 ? "down" : "";
      const label = lang === "calle" ? vm(D.it["st_" + k]) : T["st_" + k];
      return `<li><span>${label}</span><b class="${cl}">${v}</b></li>`;
    }).join("");
    $("#equip-list").innerHTML = (lang === "calle" ? D.it : T)[c.key + "_e"]
      .map(e => `<li>${lang === "calle" ? vm(e) : e}</li>`).join("");
  }
  function pick(i) {
    i = (i + CLASSES.length) % CLASSES.length;
    if (i === cls) return;
    cls = i;
    SFX.move();
    const img = $("#cc-portrait");
    img.classList.add("swap");
    setTimeout(() => { img.src = CLASSES[cls].img; img.classList.remove("swap"); }, 220);
    renderCC();
    revealSelected();
    if (lang === "calle") playVm($("#cc-classname .vm"));
  }
  CLASSES.forEach(c => { new Image().src = c.img; });
  // qualsiasi nome tu scriva, il gioco sa meglio di te
  $("#cc-name").addEventListener("input", e => { e.target.value = "Pogga"; });

  // mobile: frecce e swipe sul personaggio, la classe scelta resta visibile nella riga
  $("#cc-prev").addEventListener("click", () => pick(cls - 1));
  $("#cc-next").addEventListener("click", () => pick(cls + 1));
  let touchX = null;
  $(".altar").addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
  $(".altar").addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 40) pick(cls + (dx < 0 ? 1 : -1));
  });
  function revealSelected() {
    const li = $("#class-list li.sel");
    if (li && matchMedia("(max-width: 900px)").matches) li.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  const modal = $("#confirm");
  function askConfirm() { SFX.confirm(); modal.classList.add("show"); if (lang === "calle") playVm(modal.querySelector("p .vm")); }
  function closeConfirm() { modal.classList.remove("show"); }
  // due tempi: prima l'illusione, poi la verità
  function confirmYes() {
    closeConfirm();
    show("s-begin");
    SFX.begin();
    if (lang === "calle") setTimeout(() => playVm($("#s-begin .big-banner .vm")), 400);
    after(3400, () => {
      show("s-end");
      SFX.death();
      if (lang === "calle") setTimeout(() => playVm($("#s-end .big-banner .vm")), 1200);
      after(7000, toMenu);
    });
  }
  function toMenu() { clearTimeout(seqTimer); show("s-title"); menuSel("#title-menu", 0); }
  $("#cc-ok").addEventListener("click", askConfirm);
  $("#cc-back").addEventListener("click", () => { SFX.back(); show("s-title"); menuSel("#title-menu", 0); });
  // due "Sì": non si torna indietro
  $$("#confirm .modal-btns .btn").forEach(b => b.addEventListener("click", confirmYes));

  // click per saltare l'intro
  ["s-warn", "s-bighorses", "s-bignotti"].forEach(id => $("#" + id).addEventListener("click", e => { if (!e.target.closest(".vm")) skipIntro(); }));

  // ---------- tastiera ----------
  document.addEventListener("keydown", e => {
    if (e.target.id === "cc-name") { if (e.key === "Enter") e.target.blur(); return; }
    const k = e.key;
    if (screen === "s-gate") return start();
    if (["s-warn", "s-bighorses", "s-bignotti"].includes(screen)) return skipIntro();
    if (screen === "s-title" || screen === "s-lang") {
      const m = screen === "s-title" ? "#title-menu" : "#lang-menu";
      if (k === "ArrowDown") { SFX.move(); menuSel(m, sel[m] + 1); }
      else if (k === "ArrowUp") { SFX.move(); menuSel(m, sel[m] - 1); }
      else if (k === "Enter" || k === " ") $$(m + " button")[sel[m] || 0].click();
      else if (k === "Escape" && screen === "s-lang") { SFX.back(); show(langReturn); }
      e.preventDefault();
    } else if (screen === "s-cc") {
      if (modal.classList.contains("show")) {
        if (k === "Enter" || k === "Escape") confirmYes();
        return;
      }
      if (k === "ArrowDown") pick(cls + 1);
      else if (k === "ArrowUp") pick(cls - 1);
      else if (k === "Enter") askConfirm();
      else if (k === "Escape") $("#cc-back").click();
    } else if (screen === "s-credits" && (k === "Escape" || k === "Enter")) $("#cr-back").click();
    else if (screen === "s-end" && performance.now() - screenAt > 3000) toMenu();
  });

  // ---------- braci ----------
  const cv = $("#embers"), g = cv.getContext("2d");
  let W, H, parts = [];
  function resize() { W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio; }
  addEventListener("resize", resize); resize();
  for (let i = 0; i < 70; i++) parts.push(spawn(true));
  function spawn(any) {
    return { x: Math.random() * W, y: any ? Math.random() * H : H + 10, r: (0.6 + Math.random() * 1.8) * devicePixelRatio,
      vy: (0.3 + Math.random() * 0.9) * devicePixelRatio, ph: Math.random() * 6.28, life: 0.4 + Math.random() * 0.6 };
  }
  (function loop(t) {
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    parts.forEach((p, i) => {
      p.y -= p.vy; p.x += Math.sin(t / 900 + p.ph) * 0.4 * devicePixelRatio;
      const a = p.life * (0.5 + 0.5 * Math.sin(t / 200 + p.ph)) * Math.min(1, p.y / (H * 0.3));
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grd.addColorStop(0, `rgba(255,190,110,${a})`); grd.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, p.r * 4, 0, 6.28); g.fill();
      if (p.y < -10) parts[i] = spawn(false);
    });
    requestAnimationFrame(loop);
  })(0);

  applyLang();
  // ?skip=cc per saltare direttamente alla creazione (utile in sviluppo)
  // ?skip=cc|title|bighorses|... e ?lang=calle per saltare direttamente a una schermata (sviluppo)
  const qs = new URLSearchParams(location.search);
  if (qs.get("lang")) setLang(qs.get("lang"));
  if (qs.get("skip")) { document.body.classList.add("notrans"); const id = "s-" + qs.get("skip"); show(id); if (id === "s-title") menuSel("#title-menu", 0); }
})();
