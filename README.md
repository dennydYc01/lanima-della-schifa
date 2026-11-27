# L'Anima della Schifa

Menù di selezione del personaggio in stile action-RPG dark. Tutto goliardia.
Prodotto da **BigHorses** e **BigNotti**.

## Come si avvia
Apri `index.html` nel browser, oppure:

```bash
python3 -m http.server 8000   # poi vai su http://localhost:8000
```

- Frecce ↑↓ per scegliere, Invio per confermare, Esc per tornare indietro.
- Lingue: Italiano, Sardu, Calle (tutte le scritte diventano vocali di WhatsApp: cliccali).
- Scorciatoie di sviluppo: `index.html?skip=cc&lang=calle` (schermate: `warn`, `bighorses`, `bignotti`, `title`, `lang`, `credits`, `cc`).

Niente dipendenze: HTML/CSS/JS puro, audio sintetizzato con Web Audio.

## Asset privati (non sono nella repo)
Foto e voce sono di persone vere, quindi restano fuori dalla repo. Per far girare il gioco serve una cartella `assets/` con:

- `boss.png`, `seduttore.png`, `spiaggiato.png`, `sciamano.png`, `bandolero.png`,
  `fangoso.png`, `saltatore.png`, `posseduto.png`, `tuffatore.png`: sticker scontornati (PNG trasparenti)
- `calle.m4a`: serbatoio di sillabe rimescolate per la modalità Calle (se manca, si usa un borbottio sintetico)
