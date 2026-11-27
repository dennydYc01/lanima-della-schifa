// Tutto l'audio è sintetizzato al volo con Web Audio: niente file da scaricare.
window.SFX = (() => {
  let ctx, master, verb, calleBuf = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -12; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.2;
    master.connect(lim).connect(ctx.destination);
    // riverbero da cattedrale con impulso generato
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 4.5;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = buf;
    const vg = ctx.createGain();
    vg.gain.value = 0.5;
    verb.connect(vg).connect(master);
    fetch("assets/calle.mp4").then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))
      .then(b => { calleBuf = b; }).catch(() => { /* da file:// non si carica: si usa il borbottio sintetico */ });
  }

  const now = () => ctx.currentTime;
  function out(node, wet = 0.3) {
    const dry = ctx.createGain(); dry.gain.value = 1 - wet * 0.5;
    const w = ctx.createGain(); w.gain.value = wet;
    node.connect(dry).connect(master);
    node.connect(w).connect(verb);
  }
  function noise(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function env(g, t, a, peak, r) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
  }

  // Drone cupo + coro lontano
  let amb;
  const MUSIC = ["assets/music.mp3", "assets/music.m4a", "assets/music.ogg"];
  async function loadMusic() {
    for (const url of MUSIC) {
      try {
        const r = await fetch(url); if (!r.ok) continue;
        return await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) {}
    }
    return null;
  }
  function ambient() {
    if (amb) return;
    amb = ctx.createGain(); amb.gain.value = 0;
    amb.gain.linearRampToValueAtTime(0.22, now() + 6);
    out(amb, 0.15);
    loadMusic().then(buf => {
      if (buf) {
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        const g = ctx.createGain(); g.gain.value = 3;   // 0.22 * 3 ≈ 0.66 a regime
        src.connect(g).connect(amb); src.start();
      } else synthAmbient(amb);
    });
  }
  function synthAmbient(dest) {
    const g = dest;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    [55, 55.4, 82.4, 110.2].forEach(f => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      o.connect(lp); o.start();
    });
    // coro: La minore con vibrato
    const choir = ctx.createGain(); choir.gain.value = 0.05;
    [220, 261.6, 329.6, 440].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const v = ctx.createOscillator(); v.frequency.value = 4.5 + i * 0.3;
      const vg = ctx.createGain(); vg.gain.value = 2.5;
      v.connect(vg).connect(o.frequency); v.start();
      const tg = ctx.createGain(); tg.gain.value = 0;
      const sw = ctx.createOscillator(); sw.frequency.value = 0.07 + i * 0.023;
      const swg = ctx.createGain(); swg.gain.value = 0.5;
      sw.connect(swg).connect(tg.gain); sw.start();
      o.connect(tg).connect(choir); o.start();
    });
    lp.connect(g); choir.connect(g);
  }
  function duck(level, sec = 1.5) {
    if (!amb) return;
    amb.gain.cancelScheduledValues(now());
    amb.gain.setValueAtTime(amb.gain.value, now());
    amb.gain.linearRampToValueAtTime(level, now() + sec);
  }

  // tocco di legno: rumore filtrato cortissimo + colpo sordo
  function knock(freq, peak, wet) {
    const t = now();
    const n = noise(0.08); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq * 4; bp.Q.value = 3;
    const ng = ctx.createGain(); env(ng, t, 0.001, peak, 0.05);
    n.connect(bp).connect(ng); out(ng, wet); n.start(t);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.08);
    const og = ctx.createGain(); env(og, t, 0.002, peak * 0.9, 0.09);
    o.connect(og); out(og, wet); o.start(t); o.stop(t + 0.15);
  }
  function move() { if (ctx) knock(520, 0.16, 0.25); }
  function back() { if (ctx) knock(260, 0.22, 0.35); }
  // rintocco metallico basso, parziali non armoniche come una piccola campana di ferro
  function confirm() {
    if (!ctx) return;
    const t = now();
    knock(300, 0.18, 0.3);
    [[196, 0.11], [196 * 2.76, 0.05], [196 * 5.4, 0.025], [196 * 8.9, 0.012]].forEach(([f, a]) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); env(g, t + 0.005, 0.004, a, 1.6);
      o.connect(g); out(g, 0.6); o.start(t); o.stop(t + 1.8);
    });
  }
  function deny() { if (ctx) { knock(140, 0.3, 0.4); setTimeout(() => knock(120, 0.25, 0.4), 110); } }
  const tick = move;

  function boom() {
    if (!ctx) return;
    const t = now();
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 1.5);
    const g = ctx.createGain(); env(g, t, 0.01, 0.45, 2.5);
    o.connect(g); out(g, 0.7); o.start(); o.stop(t + 3);
    const n = noise(2); const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400;
    const ng = ctx.createGain(); env(ng, t, 0.005, 0.2, 1.2);
    n.connect(f).connect(ng); out(ng, 0.8); n.start();
    // campana
    [523, 1046, 1569, 2093].forEach((fr, i) => {
      const b = ctx.createOscillator(); b.frequency.value = fr * (1 + i * 0.002);
      const bg = ctx.createGain(); env(bg, t + 0.05, 0.005, 0.12 / (i + 1), 3);
      b.connect(bg); out(bg, 0.9); b.start(t); b.stop(t + 4);
    });
  }

  // "Inizia l'avventura": accordo luminoso che sale piano
  function begin() {
    if (!ctx) return;
    const t = now();
    [261.6, 329.6, 392, 523.3].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.6 + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      o.connect(g); out(g, 0.8); o.start(t); o.stop(t + 3.3);
    });
  }

  // "SEI MORTO": silenzio, poi un colpo grave con un grappolo di ottoni dissonanti
  // e un gong che si spegne lentamente nel riverbero
  function death() {
    if (!ctx) return;
    duck(0, 0.25);
    const t = now() + 0.35;
    // colpo di sub
    const sub = ctx.createOscillator(); sub.type = "sine";
    sub.frequency.setValueAtTime(70, t); sub.frequency.exponentialRampToValueAtTime(28, t + 2.5);
    const sg = ctx.createGain(); env(sg, t, 0.008, 0.55, 3.2);
    sub.connect(sg); out(sg, 0.5); sub.start(t); sub.stop(t + 3.5);
    // ottoni gravi: re, mi bemolle, la (dissonanza da cattedrale)
    [73.4, 77.8, 110, 146.8, 155.6].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass";
      lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(180, t + 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 / (1 + i * 0.3), t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
      o.connect(lp).connect(g); out(g, 0.9); o.start(t); o.stop(t + 5.2);
    });
    // gong: parziali non armoniche, coda lunga
    [98, 98 * 2.08, 98 * 2.91, 98 * 4.13, 98 * 5.6].forEach((f, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const g = ctx.createGain(); env(g, t + 0.01, 0.006, 0.07 / (i + 1), 6 - i * 0.6);
      o.connect(g); out(g, 1); o.start(t); o.stop(t + 6.5);
    });
    // soffio di polvere
    const n = noise(3); const bp = ctx.createBiquadFilter(); bp.type = "lowpass"; bp.frequency.value = 600;
    const ng = ctx.createGain(); env(ng, t, 0.02, 0.12, 2.5);
    n.connect(bp).connect(ng); out(ng, 1); n.start(t);
    // la musica torna piano dopo
    setTimeout(() => duck(0.22, 4), 6500);
  }

  // Onda + galoppo per BigHorses
  function horses() {
    if (!ctx) return;
    const t = now();
    const n = noise(3); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 1.2);
    bp.frequency.exponentialRampToValueAtTime(400, t + 2.8);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 1); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    n.connect(bp).connect(g); out(g, 0.5); n.start(t);
    // zoccoli: ta-ta-ta-tam
    for (let k = 0; k < 4; k++) {
      [0, 0.09, 0.18, 0.33].forEach(d => {
        const tt = t + 0.9 + k * 0.42 + d;
        const o = ctx.createOscillator(); o.type = "square"; o.frequency.setValueAtTime(180, tt);
        o.frequency.exponentialRampToValueAtTime(60, tt + 0.05);
        const og = ctx.createGain(); env(og, tt, 0.002, 0.18 * (1 - k * 0.15), 0.07);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
        o.connect(lp).connect(og); out(og, 0.3); o.start(tt); o.stop(tt + 0.12);
      });
    }
    // nitrito sintetico
    const w = ctx.createOscillator(); w.type = "sawtooth";
    const tw = t + 2.6;
    w.frequency.setValueAtTime(700, tw); w.frequency.linearRampToValueAtTime(1100, tw + 0.15);
    w.frequency.linearRampToValueAtTime(500, tw + 0.9);
    const vib = ctx.createOscillator(); vib.frequency.value = 22; const vg = ctx.createGain(); vg.gain.value = 60;
    vib.connect(vg).connect(w.frequency); vib.start(tw); vib.stop(tw + 1);
    const wf = ctx.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 1200; wf.Q.value = 3;
    const wg = ctx.createGain(); env(wg, tw, 0.05, 0.12, 0.85);
    w.connect(wf).connect(wg); out(wg, 0.5); w.start(tw); w.stop(tw + 1);
  }

  // Ronzio neon per BigNotti. events = [[secondi, luminosità 0..1], ...]: la stessa tabella
  // che game.js usa per accendere il logo, così suono e luce vanno insieme.
  function notti(events, total) {
    if (!ctx) return;
    const t = now();
    const hum = ctx.createOscillator(); hum.type = "sawtooth"; hum.frequency.value = 100;
    const hum2 = ctx.createOscillator(); hum2.type = "square"; hum2.frequency.value = 50;
    const hf = ctx.createBiquadFilter(); hf.type = "lowpass"; hf.frequency.value = 700;
    const h2g = ctx.createGain(); h2g.gain.value = 0.3;
    const hg = ctx.createGain(); hg.gain.setValueAtTime(0, t);
    hum.connect(hf); hum2.connect(h2g).connect(hf); hf.connect(hg); out(hg, 0.15);
    let prev = 0;
    events.forEach(([d, v]) => {
      hg.gain.setValueAtTime(0.035 * v, t + d);
      if (v > prev + 0.3) {                         // scintilla a ogni accensione
        const z = noise(0.05); const zf = ctx.createBiquadFilter(); zf.type = "highpass"; zf.frequency.value = 2500;
        const zg = ctx.createGain(); env(zg, t + d, 0.001, 0.08, 0.03);
        z.connect(zf).connect(zg); out(zg, 0.2); z.start(t + d);
      }
      prev = v;
    });
    hg.gain.setValueAtTime(hg.gain.value, t + total - 0.6);
    hg.gain.linearRampToValueAtTime(0, t + total);  // sfuma, niente colpo finale
    hum.start(t); hum2.start(t); hum.stop(t + total + 0.1); hum2.stop(t + total + 0.1);
    // ghiaccio nel bicchiere, piano
    [0.95, 1.05, 1.12].forEach((d, i) => {
      const o = ctx.createOscillator(); o.frequency.value = 2400 + i * 600;
      const g = ctx.createGain(); env(g, t + d, 0.002, 0.04, 0.2);
      o.connect(g); out(g, 0.5); o.start(t + d); o.stop(t + d + 0.3);
    });
  }

  // Borbottio da vocale WhatsApp: restituisce una funzione per fermarlo
  function synthVoice(sec, seed = 1) {
    if (!ctx) return () => {};
    let r = seed;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const t = now();
    const base = 95 + rnd() * 70;
    const src = ctx.createOscillator(); src.type = "sawtooth";
    const f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.value = 6;
    const f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.value = 8;
    const g = ctx.createGain(); g.gain.value = 0;
    const mix = ctx.createGain(); mix.gain.value = 1.6;
    src.connect(f1).connect(g); src.connect(f2).connect(g);
    // telefono: banda stretta + un filo di fruscio
    const tel = ctx.createBiquadFilter(); tel.type = "bandpass"; tel.frequency.value = 1400; tel.Q.value = 0.7;
    g.connect(tel).connect(mix); out(mix, 0.05);
    const hiss = noise(sec + 0.5); const hs = ctx.createGain(); hs.gain.value = 0.008;
    hiss.connect(hs).connect(master); hiss.start(t);
    const vowels = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [300, 870], [660, 1700]];
    let tt = t;
    while (tt < t + sec) {
      const syl = 0.08 + rnd() * 0.14;
      const v = vowels[Math.floor(rnd() * vowels.length)];
      f1.frequency.setTargetAtTime(v[0], tt, 0.02);
      f2.frequency.setTargetAtTime(v[1], tt, 0.02);
      src.frequency.setTargetAtTime(base * (0.85 + rnd() * 0.5), tt, 0.03);
      const pause = rnd() < 0.12;
      g.gain.setTargetAtTime(pause ? 0 : 0.5 + rnd() * 0.4, tt, 0.015);
      g.gain.setTargetAtTime(pause ? 0 : 0.15, tt + syl * 0.7, 0.02);
      tt += syl + (pause ? 0.2 : 0);
    }
    g.gain.setTargetAtTime(0, t + sec, 0.03);
    src.start(t); src.stop(t + sec + 0.3);
    return () => { try { g.gain.cancelScheduledValues(now()); g.gain.setTargetAtTime(0, now(), 0.02); src.stop(now() + 0.1); hiss.stop(); } catch (e) {} };
  }

  // Voce vera di Calle: frammenti presi a caso dal serbatoio già tagliuzzato,
  // programmati poco alla volta così il vocale può durare quanto vuole.
  function voice(sec, seed = 1) {
    if (!ctx) return () => {};
    if (!calleBuf) return synthVoice(Math.min(sec, 20), seed);
    let r = seed || 1;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    const bus = ctx.createGain(); bus.gain.value = 0.9;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 180;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 6500;
    bus.connect(hp).connect(lp).connect(master);
    const t0 = now() + 0.05, end = t0 + sec, F = 0.012;
    let t = t0, timer, alive = [];
    function schedule() {
      while (t < Math.min(end, now() + 1.5)) {
        const len = Math.min(0.35 + rnd() * 1.2, end - t);
        const off = rnd() * (calleBuf.duration - len);
        const s = ctx.createBufferSource(); s.buffer = calleBuf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + F);
        g.gain.setValueAtTime(1, t + len - F); g.gain.linearRampToValueAtTime(0, t + len);
        s.connect(g).connect(bus); s.start(t, off, len);
        alive.push(s); s.onended = () => { alive = alive.filter(x => x !== s); };
        t += len - F;
      }
      if (t < end) timer = setTimeout(schedule, 400);
    }
    schedule();
    return () => {
      clearTimeout(timer);
      bus.gain.setTargetAtTime(0, now(), 0.02);
      alive.forEach(s => { try { s.stop(now() + 0.1); } catch (e) {} });
    };
  }

  return { init, ambient, duck, tick, move, back, confirm, deny, boom, begin, death, horses, notti, voice, get ready() { return !!ctx; } };
})();
