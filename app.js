'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  MODEL_URL:       'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model',
  // Detection intervals (ms)
  FACE_INTERVAL:   120,   // face + emotion every ~120ms (≈8fps, plenty)
  OBJ_INTERVAL:    1400,  // objects every 1.4s (heavy model, no need faster)
  // Cooldowns for UI events (ms)
  COOLDOWN_EMO:    2000,
  COOLDOWN_OBJ:    3000,
  COOLDOWN_MSG:    3200,
  // Thresholds
  OBJ_CONF_MIN:    0.60,
  FACE_CONF_MIN:   0.22,
  TINY_SCORE:      0.30,
  TINY_INPUT:      320,   // smaller = faster (was 416)
  // Blend weights (model vs landmark)
  MODEL_WEIGHT:    0.80,  // trust face-api model more
  LM_WEIGHT:       0.20,  // landmark supplement
  // Smoothing: lower = smoother but lags, higher = snappier
  SMOOTH_ALPHA:    0.30,
  // Power to sharpen model predictions (>1 = more decisive)
  SHARPEN_EXP:     1.6,
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  objModel:   null,
  faceOK:     false,
  running:    false,
  sens:       25,
  tEmo:       0,
  tObj:       0,
  tMsg:       0,
  prevObj:    '',
  curEmo:     'neutral',
  tFaceLast:  0,
  tObjLast:   0,
  smoothed:   { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 },
  faceCount:  0,
  lastDets:   [],  // cached object detections between intervals
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const EMO = {
  happy:     { tr:'Mutlu',    emoji:'😊', color:'#f59e0b', ring:'#fbbf24' },
  sad:       { tr:'Üzgün',    emoji:'😢', color:'#3b82f6', ring:'#60a5fa' },
  angry:     { tr:'Kızgın',   emoji:'😠', color:'#ef4444', ring:'#f87171' },
  surprised: { tr:'Şaşkın',   emoji:'😲', color:'#9333ea', ring:'#c084fc' },
  fearful:   { tr:'Korkmuş',  emoji:'😨', color:'#06b6d4', ring:'#67e8f9' },
  neutral:   { tr:'Normal',   emoji:'😐', color:'#6b7280', ring:'#d1d5db' },
};

const EMO_EMOJIS = {
  happy:     ['😊','😄','🥳','🎉','✨','⭐','💛','😁','🌟','💖','🎊','🌈'],
  sad:       ['😢','💧','💙','🥺','💔','😿','🌧️','😞'],
  angry:     ['😠','💢','🔥','😤','💥','😡','⚡','🌋'],
  surprised: ['😲','😮','🤯','💫','❗','🎆','🌠','👀'],
  fearful:   ['😨','😰','💜','😱','👻','🫣'],
  neutral:   ['😐','🙂','💭','🤔','😌','🫤'],
};

const MESSAGES = {
  happy:     ['Çok mutlu görünüyorsun! 😊','Gülüşün harika! ✨','Ne güzel gülüyorsun! 🌟','Mutluluğun bulaşıcı! 💛','Harika bir gün geçiriyorsun! 🎉'],
  sad:       ['Üzgün görünüyorsun 😢','Her şey düzelecek! 💙','Moralini topla! 🌈','Yanındayım! 💜','Yarın daha güzel olacak! ☀️'],
  angry:     ['Biraz kızgın görünüyorsun 😠','Derin nefes al! 💨','Sakin ol, her şey yoluna girecek 🌊','Rahatla biraz! 🧘'],
  surprised: ['Çok şaşırdın! 😲','Ne oldu? 🤯','Vay be! 💫','İnanılmaz değil mi! ⭐','Harika bir sürpriz! 🎆'],
  fearful:   ['Endişelenme! 💜','Her şey yolunda! ✨','Güvendesin! 🛡️','Korkulacak bir şey yok! 🤗'],
  neutral:   ['Sakin ve huzurlu görünüyorsun 🙂','İyi görünüyorsun! 👍','Dengede! ⚖️','Her şey normal! 😌'],
};

const OBJ_TR = {
  person:       ['İnsan',          '🧑'],
  bicycle:      ['Bisiklet',        '🚲'],
  car:          ['Araba',           '🚗'],
  motorcycle:   ['Motor',           '🏍️'],
  bus:          ['Otobüs',          '🚌'],
  cat:          ['Kedi',            '🐱'],
  dog:          ['Köpek',           '🐕'],
  bird:         ['Kuş',             '🐦'],
  bottle:       ['Şişe',            '🍶'],
  cup:          ['Bardak',          '☕'],
  book:         ['Kitap',           '📚'],
  laptop:       ['Laptop',          '💻'],
  'cell phone': ['Telefon',         '📱'],
  clock:        ['Saat',            '🕐'],
  mouse:        ['Fare',            '🖱️'],
  keyboard:     ['Klavye',          '⌨️'],
  chair:        ['Sandalye',        '🪑'],
  tv:           ['TV',              '📺'],
  backpack:     ['Sırt Çantası',    '🎒'],
  umbrella:     ['Şemsiye',         '☂️'],
  scissors:     ['Makas',           '✂️'],
  teddy_bear:   ['Oyuncak Ayı',     '🧸'],
  apple:        ['Elma',            '🍎'],
  banana:       ['Muz',             '🍌'],
  orange:       ['Portakal',        '🍊'],
  pizza:        ['Pizza',           '🍕'],
  cake:         ['Pasta',           '🎂'],
};

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const D = {
  ld:         $('ld'),
  ldTxt:      $('ldTxt'),
  ldSub:      $('ldSub'),
  ldBar:      $('ldBar'),
  ldPct:      $('ldPct'),
  s1:         $('s1'),
  s2:         $('s2'),
  s3:         $('s3'),
  s4:         $('s4'),
  stars:      $('stars'),
  bubbles:    $('bubbles'),
  expl:       $('expl'),
  vid:        $('vid'),
  cv:         $('cv'),
  popup:      $('popup'),
  camEmo:     $('camEmo'),
  camStatus:  $('camStatus'),
  faceCount:  $('faceCount'),
  goBtn:      $('goBtn'),
  stopBtn:    $('stopBtn'),
  sensSlider: $('sensSlider'),
  sensVal:    $('sensVal'),
  msgIcon:    $('msgIcon'),
  msgText:    $('msgText'),
  bigEmo:     $('bigEmo'),
  emoRing:    $('emoRing'),
  emoLbl:     $('emoLbl'),
  emoConf:    $('emoConf'),
  miniE:      $('miniE'),
  detList:    $('detList'),
};

// ─── LOADING HELPERS ──────────────────────────────────────────────────────────
function setProgress(pct, text, sub) {
  D.ldBar.style.width = pct + '%';
  D.ldPct.textContent = pct + '%';
  if (text) D.ldTxt.textContent = text;
  if (sub)  D.ldSub.textContent = sub;
}
function stepDone(el, label) {
  el.textContent = '✅ ' + label;
  el.classList.remove('active');
  el.classList.add('done');
}
function stepActive(el, label) {
  el.textContent = '⏳ ' + label;
  el.classList.add('active');
}

// ─── BACKGROUND ───────────────────────────────────────────────────────────────
function initBG() {
  for (let i = 0; i < 55; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 3 + 1.5;
    s.style.cssText = `
      left:${Math.random()*100}%; top:${Math.random()*100}%;
      width:${sz}px; height:${sz}px;
      animation-delay:${Math.random()*3}s;
      animation-duration:${Math.random()*2+2}s;
    `;
    D.stars.appendChild(s);
  }
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const sz = Math.random() * 90 + 30;
    b.style.cssText = `
      left:${Math.random()*100}%;
      width:${sz}px; height:${sz}px;
      animation-delay:${Math.random()*18}s;
      animation-duration:${Math.random()*12+14}s;
    `;
    D.bubbles.appendChild(b);
  }
}

// ─── TYPEWRITER ───────────────────────────────────────────────────────────────
let typeTimer = null;
function typeMessage(text, icon = '💬') {
  D.msgIcon.textContent = icon;
  D.msgText.textContent = '';
  if (typeTimer) clearInterval(typeTimer);
  let i = 0;
  typeTimer = setInterval(() => {
    if (i < text.length) {
      D.msgText.textContent += text[i++];
    } else {
      clearInterval(typeTimer);
      typeTimer = null;
    }
  }, 30);
}

// ─── EXPLOSION ────────────────────────────────────────────────────────────────
function explode(emo) {
  const list = EMO_EMOJIS[emo] || EMO_EMOJIS.neutral;
  const c = D.expl;
  for (let i = 0; i < 10; i++) {
    const e = document.createElement('div');
    e.className = 'fly-emoji';
    e.textContent = list[Math.floor(Math.random() * list.length)];
    e.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*0.25}s`;
    c.appendChild(e);
    setTimeout(() => e.remove(), 3500);
  }
  const cols = ['#fbbf24','#f87171','#60a5fa','#c084fc','#34d399','#f472b6','#fde68a'];
  for (let i = 0; i < 24; i++) {
    const cf = document.createElement('div');
    cf.className = 'confetti-bit';
    cf.style.cssText = `
      left:${Math.random()*100}%;
      background:${cols[Math.floor(Math.random()*cols.length)]};
      animation-delay:${Math.random()*0.5}s;
      border-radius:${Math.random()>0.5?'50%':'3px'};
    `;
    c.appendChild(cf);
    setTimeout(() => cf.remove(), 4000);
  }
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('div');
    s.className = 'starburst';
    s.textContent = ['⭐','🌟','✨'][Math.floor(Math.random()*3)];
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*60}%;animation-delay:${Math.random()*0.35}s`;
    c.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

// ─── MINI EMOJIS ──────────────────────────────────────────────────────────────
function showMiniEmojis(emo) {
  const list = EMO_EMOJIS[emo] || EMO_EMOJIS.neutral;
  D.miniE.innerHTML = list.slice(0, 5).map((e, i) =>
    `<span class="mini-e" style="animation-delay:${i * 0.06}s">${e}</span>`
  ).join('');
}

// ─── BARS ─────────────────────────────────────────────────────────────────────
function updateBars(scores) {
  ['happy','sad','angry','surprised','neutral'].forEach(k => {
    const pct = Math.min(100, Math.max(0, Math.round((scores[k] || 0) * 100)));
    const cap = k.charAt(0).toUpperCase() + k.slice(1);
    const bar = $('b' + cap);
    const val = $('v' + cap);
    if (bar) bar.style.width = pct + '%';
    if (val) val.textContent = pct + '%';
  });
}

// ─── OBJECT POPUP ─────────────────────────────────────────────────────────────
let popupTimer = null;
function showPopup(text, emoji) {
  D.popup.innerHTML = `${emoji} ${text}`;
  D.popup.classList.add('show');
  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(() => D.popup.classList.remove('show'), 2200);
}

// ─── OBJECT LIST ──────────────────────────────────────────────────────────────
function updateObjList(items) {
  if (!items.length) {
    D.detList.innerHTML = `
      <div class="obj-item obj-item--empty">
        <span>🔍</span><span>Nesne aranıyor...</span>
      </div>`;
    return;
  }
  D.detList.innerHTML = items.slice(0, 5).map(it => `
    <div class="obj-item">
      <span class="obj-icon">${it.emoji}</span>
      <div class="obj-info">
        <div class="obj-name">${it.name}</div>
        <div class="obj-conf">%${it.conf} emin</div>
      </div>
    </div>
  `).join('');
}

// ─── EMOTION UPDATE ───────────────────────────────────────────────────────────
function updateEmotion(emo, conf) {
  const ed = EMO[emo] || EMO.neutral;
  const now = Date.now();
  const threshold = S.sens / 100;

  D.bigEmo.textContent = ed.emoji;
  D.emoLbl.textContent = ed.tr;
  D.emoLbl.style.color = ed.color;
  D.emoConf.textContent = `%${Math.round(conf * 100)} emin`;
  D.emoRing.style.borderColor = ed.ring;
  D.emoRing.style.boxShadow = `0 4px 20px ${ed.ring}66`;
  D.camEmo.textContent = ed.emoji;

  if (emo !== S.curEmo && conf > threshold && now - S.tEmo > CFG.COOLDOWN_EMO) {
    S.curEmo = emo;
    S.tEmo = now;

    // Ring pop
    D.emoRing.classList.remove('pop');
    void D.emoRing.offsetWidth;
    D.emoRing.classList.add('pop');

    // Emoji celebrate
    D.bigEmo.classList.remove('celebrate');
    void D.bigEmo.offsetWidth;
    D.bigEmo.classList.add('celebrate');
    setTimeout(() => D.bigEmo.classList.remove('celebrate'), 700);

    explode(emo);
    showMiniEmojis(emo);

    if (now - S.tMsg > CFG.COOLDOWN_MSG) {
      S.tMsg = now;
      const msgs = MESSAGES[emo] || MESSAGES.neutral;
      typeMessage(msgs[Math.floor(Math.random() * msgs.length)], ed.emoji);
    }
  }
}

// ─── SHARPEN MODEL PREDICTIONS ────────────────────────────────────────────────
// Raise scores to a power > 1 so the dominant emotion wins more decisively
function sharpen(scores) {
  const out = {};
  let sum = 0;
  for (const k in scores) {
    out[k] = Math.pow(Math.max(0, scores[k]), CFG.SHARPEN_EXP);
    sum += out[k];
  }
  if (sum > 0) for (const k in out) out[k] /= sum;
  return out;
}

// ─── LANDMARK ANALYSIS ────────────────────────────────────────────────────────
// Lightweight geometric supplement; contributes 20% of final blend
function analyzeLandmarks(landmarks) {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) return null;
  const p = landmarks.positions;

  const faceW = Math.abs(p[16].x - p[0].x) || 1;
  const norm = v => v / faceW;

  // Eye openness
  const lEyeH = norm(Math.abs(((p[37].y+p[38].y)/2) - ((p[40].y+p[41].y)/2)));
  const rEyeH = norm(Math.abs(((p[43].y+p[44].y)/2) - ((p[46].y+p[47].y)/2)));
  const eyeOpen = (lEyeH + rEyeH) / 2;

  // Brow lift
  const browY  = (p[19].y + p[24].y) / 2;
  const eyeY   = (p[37].y + p[44].y) / 2;
  const browGap = norm(eyeY - browY);

  // Mouth geometry
  const mW        = norm(Math.abs(p[54].x - p[48].x));
  const mH        = norm(Math.abs(p[57].y - p[51].y));
  const mOpen     = mW > 0.001 ? mH / mW : 0;
  const cornerDiff = norm((p[51].y + p[57].y) / 2 - (p[48].y + p[54].y) / 2);
  const innerH    = norm(Math.abs(p[66].y - p[62].y));
  const jawTight  = innerH < 0.008 && mH < 0.01;

  const sc = { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:0 };

  // Happy: corners up, wide mouth
  if (cornerDiff > 0.006 && mW > 0.055)
    sc.happy = Math.min(1, cornerDiff * 60 + (mW - 0.055) * 5);

  // Sad: corners down, eyes narrowed
  if (cornerDiff < -0.005)
    sc.sad = Math.min(1, Math.abs(cornerDiff) * 60);
  if (eyeOpen < 0.012 && browGap < 0.032)
    sc.sad = Math.min(1, sc.sad + (0.012 - eyeOpen) * 40);

  // Angry: squinted eyes, furrowed brow, tight jaw
  let ang = 0;
  if (eyeOpen < 0.014) ang += 0.3;
  if (jawTight)        ang += 0.4;
  if (browGap < 0.030) ang += 0.3;
  if (mOpen < 0.1 && Math.abs(cornerDiff) < 0.006) ang += 0.15;
  sc.angry = Math.min(1, ang);

  // Surprised: wide eyes + open mouth + raised brows
  if (eyeOpen > 0.018 && mOpen > 0.28 && browGap > 0.040)
    sc.surprised = Math.min(1, (eyeOpen - 0.018)*50 + (mOpen - 0.28)*2.5);

  // Fearful: wide eyes + slightly open mouth + high brows
  if (eyeOpen > 0.016 && mOpen > 0.14 && mOpen < 0.40 && browGap > 0.036)
    sc.fearful = Math.min(1, (eyeOpen - 0.016)*48 + (mOpen - 0.14)*1.8);

  const tot = sc.happy + sc.sad + sc.angry + sc.surprised + sc.fearful;
  sc.neutral = Math.max(0, 1 - tot * 0.8);

  const sum = Object.values(sc).reduce((a,b) => a+b, 0);
  if (sum > 0) for (const k in sc) sc[k] /= sum;

  return sc;
}

// ─── EMA SMOOTHING ────────────────────────────────────────────────────────────
function smooth(raw) {
  const a = CFG.SMOOTH_ALPHA;
  for (const k in S.smoothed) {
    S.smoothed[k] = a * (raw[k] || 0) + (1 - a) * S.smoothed[k];
  }
  // Re-normalise
  const sum = Object.values(S.smoothed).reduce((a,b) => a+b, 0);
  if (sum > 0) for (const k in S.smoothed) S.smoothed[k] /= sum;
  return { ...S.smoothed };
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
function drawFaceBox(ctx, box, emo) {
  const ed = EMO[emo] || EMO.neutral;
  ctx.save();

  // Glow
  ctx.shadowColor = ed.ring;
  ctx.shadowBlur  = 20;
  ctx.strokeStyle = ed.ring;
  ctx.lineWidth   = 4;

  // Rounded rect
  const r = 10;
  const { x, y, width: w, height: h } = box;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label badge
  const lbl = `${ed.emoji} ${ed.tr}`;
  ctx.font = 'bold 14px Nunito, sans-serif';
  const tw = ctx.measureText(lbl).width;
  ctx.fillStyle = ed.ring;
  // Pill background
  const bx = x, by = y - 30, bw = tw + 18, bh = 26, br = 8;
  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
  ctx.lineTo(bx + br, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
  ctx.lineTo(bx, by + br);
  ctx.quadraticCurveTo(bx, by, bx + br, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.fillText(lbl, bx + 9, by + 18);
  ctx.restore();
}

function drawLandmarks(ctx, pts) {
  const groups = [
    { range:[36,47], color:'rgba(251,191,36,0.9)'  },   // eyes
    { range:[17,26], color:'rgba(96,165,250,0.9)'  },   // brows
    { range:[48,67], color:'rgba(248,113,113,0.9)' },   // mouth
    { range:[27,35], color:'rgba(52,211,153,0.9)'  },   // nose
  ];
  groups.forEach(g => {
    ctx.fillStyle = g.color;
    for (let i = g.range[0]; i <= g.range[1]; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawObjBox(ctx, bbox, info) {
  const [x, y, w, h] = bbox;
  ctx.save();
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 4]);
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 10;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  const lbl = `${info[1]} ${info[0]}`;
  ctx.font = 'bold 13px Nunito, sans-serif';
  const tw = ctx.measureText(lbl).width;
  ctx.fillStyle = 'rgba(192,132,252,0.92)';
  ctx.fillRect(x, y - 26, tw + 14, 24);
  ctx.fillStyle = 'white';
  ctx.fillText(lbl, x + 7, y - 8);
  ctx.restore();
}

// ─── MAIN DETECTION LOOP ──────────────────────────────────────────────────────
// Two separate throttles: face (fast) and objects (slow)
// requestAnimationFrame drives the loop; we skip work based on elapsed time.

async function detect() {
  if (!S.running) return;

  const now = Date.now();
  const vid = D.vid;
  const cv  = D.cv;

  // Sync canvas pixel dims to video source dims every frame
  // (video CSS uses object-fit:fill so coords align perfectly)
  if (cv.width !== vid.videoWidth || cv.height !== vid.videoHeight) {
    cv.width  = vid.videoWidth;
    cv.height = vid.videoHeight;
  }

  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);

  // ── FACE DETECTION (fast path) ──────────────────────────────────────────────
  if (S.faceOK && now - S.tFaceLast >= CFG.FACE_INTERVAL) {
    S.tFaceLast = now;
    try {
      const faces = await faceapi
        .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({
          inputSize:      CFG.TINY_INPUT,
          scoreThreshold: CFG.TINY_SCORE,
        }))
        .withFaceLandmarks()
        .withFaceExpressions();

      S.faceCount = faces.length;
      D.faceCount.textContent = `👤 ${faces.length} Yüz`;

      if (faces.length > 0) {
        const face = faces[0];
        const exp  = face.expressions;

        // Raw model scores
        const modelSc = {
          happy:     exp.happy     || 0,
          sad:       exp.sad       || 0,
          angry:     exp.angry     || 0,
          surprised: exp.surprised || 0,
          fearful:   exp.fearful   || 0,
          neutral:   exp.neutral   || 0,
        };

        // Sharpen so the dominant emotion wins more clearly
        const sharpSc = sharpen(modelSc);

        // Optional landmark supplement (20% weight)
        const lmSc = analyzeLandmarks(face.landmarks);
        const blended = {};
        for (const k in sharpSc) {
          blended[k] = lmSc
            ? sharpSc[k] * CFG.MODEL_WEIGHT + lmSc[k] * CFG.LM_WEIGHT
            : sharpSc[k];
        }

        // Smooth over time
        const smoothed = smooth(blended);

        // Find dominant emotion
        let maxEmo = 'neutral', maxVal = 0;
        for (const [k, v] of Object.entries(smoothed)) {
          if (v > maxVal) { maxVal = v; maxEmo = k; }
        }

        // Draw all faces
        faces.forEach(f => {
          drawFaceBox(ctx, f.detection.box, maxEmo);
          if (f.landmarks) drawLandmarks(ctx, f.landmarks.positions);
        });

        updateEmotion(maxEmo, maxVal);
        updateBars(smoothed);

      } else {
        D.emoLbl.textContent = 'Yüz bekleniyor...';
        D.emoConf.textContent = '';
        D.camEmo.textContent  = '🔍';
        // Gently decay toward neutral
        smooth({ happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 });
        updateBars(S.smoothed);
      }
    } catch (err) {
      console.warn('Yüz algılama hatası:', err.message);
    }
  } else if (!S.faceOK) {
    // Face model not ready yet – draw cached objects only
  } else {
    // Re-draw face boxes from previous frame if within face interval
    // (canvas clears each rAF, so re-draw cached objects here)
  }

  // ── OBJECT DETECTION (slow path) ──────────────────────────────────────────
  if (S.objModel && now - S.tObjLast >= CFG.OBJ_INTERVAL) {
    S.tObjLast = now;
    S.lastDets = [];
    try {
      const preds = await S.objModel.detect(vid);
      for (const p of preds) {
        if (p.score < CFG.OBJ_CONF_MIN) continue;
        const info = OBJ_TR[p.class] || [p.class, '📦'];
        const conf = Math.round(p.score * 100);
        S.lastDets.push({ bbox: p.bbox, info, conf, cls: p.class });

        if (p.class !== S.prevObj && now - S.tObj > CFG.COOLDOWN_OBJ) {
          S.prevObj = p.class;
          S.tObj    = now;
          showPopup(info[0], info[1]);
        }
      }
    } catch (err) {
      console.warn('Nesne algılama hatası:', err.message);
    }
    updateObjList(S.lastDets.map(d => ({ name: d.info[0], emoji: d.info[1], conf: d.conf })));
  }

  // Always draw cached object boxes on canvas
  for (const d of S.lastDets) {
    drawObjBox(ctx, d.bbox, d.info);
  }

  if (S.running) requestAnimationFrame(detect);
}

// ─── LOAD MODELS ──────────────────────────────────────────────────────────────
async function loadModels() {
  try {
    // TensorFlow backend
    stepActive(D.s1, 'TensorFlow');
    setProgress(5, 'TensorFlow hazırlanıyor...', 'GPU backend başlatılıyor');
    await tf.ready();
    await tf.setBackend('webgl');
    stepDone(D.s1, 'TensorFlow');
    setProgress(15, 'Yüz dedektörü yükleniyor...', 'Sinir ağı modeli indiriliyor');

    // Face models
    stepActive(D.s2, 'Yüz Dedektörü');
    await faceapi.nets.tinyFaceDetector.loadFromUri(CFG.MODEL_URL);
    setProgress(40);
    await faceapi.nets.faceLandmark68Net.loadFromUri(CFG.MODEL_URL);
    setProgress(58);
    stepDone(D.s2, 'Yüz Dedektörü');

    // Expression model
    stepActive(D.s3, 'Duygu Modeli');
    setProgress(58, 'Duygu modeli yükleniyor...', 'İfade tanıma hazırlanıyor');
    await faceapi.nets.faceExpressionNet.loadFromUri(CFG.MODEL_URL);
    S.faceOK = true;
    stepDone(D.s3, 'Duygu Modeli');
    setProgress(78);

    // COCO-SSD
    stepActive(D.s4, 'Nesne Modeli');
    setProgress(78, 'Nesne modeli yükleniyor...', 'COCO-SSD hazırlanıyor');
    S.objModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' }); // lighter = faster
    stepDone(D.s4, 'Nesne Modeli');
    setProgress(100, '✅ Hazır!', 'Başlat butonuna tıkla!');

    setTimeout(() => D.ld.classList.add('hide'), 800);

  } catch (err) {
    console.error('Model yükleme hatası:', err);
    D.ldTxt.textContent = '❌ Yükleme Hatası!';
    D.ldSub.textContent = 'Sayfayı yenileyin veya internet bağlantınızı kontrol edin.';
  }
}

// ─── CAMERA ───────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width:  { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      }
    });
    D.vid.srcObject = stream;
    return new Promise(resolve => {
      D.vid.onloadedmetadata = () => {
        // Set canvas to exact video source dimensions
        D.cv.width  = D.vid.videoWidth;
        D.cv.height = D.vid.videoHeight;
        resolve();
      };
    });
  } catch (err) {
    alert('📷 Kamera izni gerekli!\n\nLütfen kamera erişimine izin verin ve sayfayı yenileyin.');
    console.error('Kamera hatası:', err);
  }
}

// ─── CONTROLS ─────────────────────────────────────────────────────────────────
function startDetection() {
  S.running    = true;
  S.prevObj    = '';
  S.curEmo     = 'neutral';
  S.tEmo = S.tObj = S.tMsg = S.tFaceLast = S.tObjLast = 0;
  S.smoothed   = { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 };
  S.lastDets   = [];

  D.goBtn.disabled   = true;
  D.stopBtn.disabled = false;
  D.camStatus.innerHTML = '<span class="pulse-dot"></span> Algılıyor';

  typeMessage('Kameraya bak ve yüz ifadeni göster! 😊', '🎭');
  requestAnimationFrame(detect);
}

function stopDetection() {
  S.running = false;
  D.goBtn.disabled   = false;
  D.stopBtn.disabled = true;

  D.camStatus.innerHTML = '<span class="pulse-dot red"></span> Durduruldu';

  const ctx = D.cv.getContext('2d');
  ctx.clearRect(0, 0, D.cv.width, D.cv.height);
  D.camEmo.textContent = '';
  D.faceCount.textContent = '👤 0 Yüz';

  typeMessage('Durduruldu. Tekrar başlatmak için butona tıkla! 🚀', '⏹️');
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
D.goBtn.addEventListener('click', startDetection);
D.stopBtn.addEventListener('click', stopDetection);
D.sensSlider.addEventListener('input', function () {
  S.sens = parseInt(this.value);
  D.sensVal.textContent = S.sens + '%';
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
(async () => {
  initBG();
  await loadModels();
  await startCamera();
})();