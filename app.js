'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CFG = {
  MODEL_URL:      'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model',
  COOLDOWN_EMO:   2200,
  COOLDOWN_OBJ:   3000,
  COOLDOWN_MSG:   3500,
  OBJ_CONF_MIN:   0.62,
  FACE_CONF_MIN:  0.20,
  TINY_THRESHOLD: 0.22,
  SMOOTH_ALPHA:   0.35,
  DETECT_INTERVAL: 80,
};

// ─── STATE ────────────────────────────────────────────────────────────────────
const S = {
  objModel: null,
  faceOK:   false,
  running:  false,
  sens:     25,
  tEmo:     0,
  tObj:     0,
  tMsg:     0,
  prevObj:  '',
  curEmo:   'neutral',
  lastDetect: 0,
  smoothed: { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 },
  faceCount: 0,
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
  bottle:       ['Şişe',            '🍼'],
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
  }, 35);
}

// ─── EXPLOSION ────────────────────────────────────────────────────────────────
function explode(emo) {
  const list = EMO_EMOJIS[emo] || EMO_EMOJIS.neutral;
  const c = D.expl;
  for (let i = 0; i < 12; i++) {
    const e = document.createElement('div');
    e.className = 'fly-emoji';
    e.textContent = list[Math.floor(Math.random() * list.length)];
    e.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*0.3}s`;
    c.appendChild(e);
    setTimeout(() => e.remove(), 3800);
  }
  const cols = ['#fbbf24','#f87171','#60a5fa','#c084fc','#34d399','#f472b6','#fde68a'];
  for (let i = 0; i < 28; i++) {
    const cf = document.createElement('div');
    cf.className = 'confetti-bit';
    cf.style.cssText = `
      left:${Math.random()*100}%;
      background:${cols[Math.floor(Math.random()*cols.length)]};
      animation-delay:${Math.random()*0.6}s;
      border-radius:${Math.random()>0.5?'50%':'3px'};
    `;
    c.appendChild(cf);
    setTimeout(() => cf.remove(), 4200);
  }
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('div');
    s.className = 'starburst';
    s.textContent = ['⭐','🌟','✨'][Math.floor(Math.random()*3)];
    s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*60}%;animation-delay:${Math.random()*0.4}s`;
    c.appendChild(s);
    setTimeout(() => s.remove(), 2000);
  }
}

// ─── MINI EMOJIS ──────────────────────────────────────────────────────────────
function showMiniEmojis(emo) {
  const list = EMO_EMOJIS[emo] || EMO_EMOJIS.neutral;
  D.miniE.innerHTML = list.slice(0, 5).map((e, i) =>
    `<span class="mini-e" style="animation-delay:${i * 0.07}s">${e}</span>`
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

    D.emoRing.classList.remove('pop');
    void D.emoRing.offsetWidth;
    D.emoRing.classList.add('pop');

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

// ─── LANDMARK ANALYSIS ────────────────────────────────────────────────────────
function analyzeLandmarks(landmarks) {
  if (!landmarks || !landmarks.positions || landmarks.positions.length < 68) return null;
  const p = landmarks.positions;

  const faceW = Math.abs(p[16].x - p[0].x) || 1;
  const norm = v => v / faceW;

  const lEyeH = norm(Math.abs(((p[37].y+p[38].y)/2) - ((p[40].y+p[41].y)/2)));
  const rEyeH = norm(Math.abs(((p[43].y+p[44].y)/2) - ((p[46].y+p[47].y)/2)));
  const eyeOpen = (lEyeH + rEyeH) / 2;

  const browY  = (p[19].y + p[24].y) / 2;
  const eyeY   = (p[37].y + p[44].y) / 2;
  const browGap = norm(eyeY - browY);

  const mW  = norm(Math.abs(p[54].x - p[48].x));
  const mH  = norm(Math.abs(p[57].y - p[51].y));
  const mOpen = mW > 0.001 ? mH / mW : 0;
  const cornerDiff = norm((p[51].y + p[57].y) / 2 - (p[48].y + p[54].y) / 2);
  const innerH = norm(Math.abs(p[66].y - p[62].y));
  const jawTight = innerH < 0.008 && mH < 0.01;

  const sc = { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:0 };

  if (cornerDiff > 0.007 && mW > 0.06)
    sc.happy = Math.min(1, cornerDiff * 55 + (mW - 0.06) * 6);

  if (cornerDiff < -0.005)
    sc.sad = Math.min(1, Math.abs(cornerDiff) * 55);
  if (eyeOpen < 0.011 && browGap < 0.03)
    sc.sad = Math.min(1, sc.sad + (0.011 - eyeOpen) * 45);

  let ang = 0;
  if (eyeOpen < 0.013) ang += 0.3;
  if (jawTight)        ang += 0.4;
  if (browGap < 0.028) ang += 0.35;
  if (mOpen < 0.1 && Math.abs(cornerDiff) < 0.005) ang += 0.2;
  sc.angry = Math.min(1, ang);

  if (eyeOpen > 0.017 && mOpen > 0.3 && browGap > 0.038)
    sc.surprised = Math.min(1, (eyeOpen - 0.017)*55 + (mOpen - 0.3)*2.5);

  if (eyeOpen > 0.016 && mOpen > 0.15 && mOpen < 0.38 && browGap > 0.034)
    sc.fearful = Math.min(1, (eyeOpen - 0.016)*50 + (mOpen - 0.15)*2);

  const tot = sc.happy + sc.sad + sc.angry + sc.surprised + sc.fearful;
  sc.neutral = Math.max(0, 1 - tot * 0.85);

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
  const sum = Object.values(S.smoothed).reduce((a,b) => a+b, 0);
  if (sum > 0) for (const k in S.smoothed) S.smoothed[k] /= sum;
  return { ...S.smoothed };
}

// ─── DRAW HELPERS ─────────────────────────────────────────────────────────────
function drawFaceBox(ctx, box, emo) {
  const ed = EMO[emo] || EMO.neutral;
  ctx.save();
  ctx.strokeStyle = ed.ring;
  ctx.lineWidth = 4;
  ctx.shadowColor = ed.ring;
  ctx.shadowBlur = 18;
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.shadowBlur = 0;
  const lbl = `${ed.emoji} ${ed.tr}`;
  ctx.font = 'bold 14px Nunito, sans-serif';
  const tw = ctx.measureText(lbl).width;
  ctx.fillStyle = ed.ring;
  ctx.fillRect(box.x, box.y - 28, tw + 16, 26);
  ctx.fillStyle = 'white';
  ctx.fillText(lbl, box.x + 8, box.y - 10);
  ctx.restore();
}

function drawLandmarks(ctx, pts) {
  const groups = [
    { range:[36,47], color:'rgba(251,191,36,0.85)'  },
    { range:[17,26], color:'rgba(96,165,250,0.85)'  },
    { range:[48,67], color:'rgba(248,113,113,0.85)' },
    { range:[27,35], color:'rgba(52,211,153,0.85)'  },
  ];
  groups.forEach(g => {
    ctx.fillStyle = g.color;
    for (let i = g.range[0]; i <= g.range[1]; i++) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawObjBox(ctx, bbox, info) {
  const [x, y, w, h] = bbox;
  ctx.save();
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 3]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  const lbl = `${info[1]} ${info[0]}`;
  ctx.font = 'bold 13px Nunito, sans-serif';
  const tw = ctx.measureText(lbl).width;
  ctx.fillStyle = 'rgba(192,132,252,0.92)';
  ctx.fillRect(x, y - 26, tw + 14, 24);
  ctx.fillStyle = 'white';
  ctx.fillText(lbl, x + 7, y - 8);
  ctx.restore();
}

// ─── MAIN DETECT LOOP ─────────────────────────────────────────────────────────
async function detect() {
  if (!S.running) return;

  const now = Date.now();
  if (now - S.lastDetect < CFG.DETECT_INTERVAL) {
    requestAnimationFrame(detect);
    return;
  }
  S.lastDetect = now;

  const vid = D.vid, cv = D.cv;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const dets = [];

  // ── FACE ──
  if (S.faceOK) {
    try {
      let faces = await faceapi
        .detectAllFaces(vid, new faceapi.SsdMobilenetv1Options({ minConfidence: CFG.FACE_CONF_MIN }))
        .withFaceLandmarks()
        .withFaceExpressions();

      if (!faces.length) {
        faces = await faceapi
          .detectAllFaces(vid, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: CFG.TINY_THRESHOLD }))
          .withFaceLandmarks()
          .withFaceExpressions();
      }

      S.faceCount = faces.length;
      D.faceCount.textContent = `👤 ${faces.length} Yüz`;

      if (faces.length > 0) {
        // Use first face for emotion
        const face = faces[0];
        const box  = face.detection.box;
        const exp  = face.expressions;

        // Model scores
        const modelSc = {
          happy:     exp.happy     || 0,
          sad:       exp.sad       || 0,
          angry:     exp.angry     || 0,
          surprised: exp.surprised || 0,
          fearful:   exp.fearful   || 0,
          neutral:   exp.neutral   || 0,
        };

        // Landmark scores
        const lmSc = analyzeLandmarks(face.landmarks);

        // Blend: 55% landmark, 45% model
        const blended = {};
        for (const k in modelSc) {
          blended[k] = lmSc
            ? lmSc[k] * 0.55 + modelSc[k] * 0.45
            : modelSc[k];
        }

        // Smooth
        const smoothed = smooth(blended);

        // Find dominant
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
        // No face
        D.emoLbl.textContent = 'Yüz bekleniyor...';
        D.emoConf.textContent = '';
        D.camEmo.textContent = '🔍';
        // Decay smoothed toward neutral
        smooth({ happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 });
        updateBars(S.smoothed);
      }
    } catch (err) {
      console.warn('Yüz algılama hatası:', err.message);
    }
  }

  // ── OBJECTS ──
  if (S.objModel) {
    try {
      const preds = await S.objModel.detect(vid);
      preds.forEach(p => {
        if (p.score < CFG.OBJ_CONF_MIN) return;
        const info = OBJ_TR[p.class] || [p.class, '📦'];
        const conf = Math.round(p.score * 100);
        drawObjBox(ctx, p.bbox, info);
        dets.push({ name: info[0], emoji: info[1], conf });

        if (p.class !== S.prevObj && now - S.tObj > CFG.COOLDOWN_OBJ) {
          S.prevObj = p.class;
          S.tObj = now;
          showPopup(info[0], info[1]);
        }
      });
    } catch (err) {
      console.warn('Nesne algılama hatası:', err.message);
    }
  }

  updateObjList(dets);
  if (S.running) requestAnimationFrame(detect);
}

// ─── LOAD MODELS ──────────────────────────────────────────────────────────────
async function loadModels() {
  try {
    // TF
    stepActive(D.s1, 'TensorFlow');
    setProgress(5, 'TensorFlow hazırlanıyor...', 'GPU backend başlatılıyor');
    await tf.ready();
    await tf.setBackend('webgl');
    stepDone(D.s1, 'TensorFlow');
    setProgress(15, 'Yüz dedektörü yükleniyor...', 'Sinir ağı modeli indiriliyor');

    // Face detector
    stepActive(D.s2, 'Yüz Dedektörü');
    await faceapi.nets.tinyFaceDetector.loadFromUri(CFG.MODEL_URL);
    setProgress(30);
    await faceapi.nets.ssdMobilenetv1.loadFromUri(CFG.MODEL_URL);
    setProgress(50);
    await faceapi.nets.faceLandmark68Net.loadFromUri(CFG.MODEL_URL);
    setProgress(65);
    stepDone(D.s2, 'Yüz Dedektörü');

    // Expression model
    stepActive(D.s3, 'Duygu Modeli');
    setProgress(65, 'Duygu modeli yükleniyor...', 'İfade tanıma hazırlanıyor');
    await faceapi.nets.faceExpressionNet.loadFromUri(CFG.MODEL_URL);
    S.faceOK = true;
    stepDone(D.s3, 'Duygu Modeli');
    setProgress(80);

    // COCO-SSD
    stepActive(D.s4, 'Nesne Modeli');
    setProgress(80, 'Nesne modeli yükleniyor...', 'COCO-SSD hazırlanıyor');
    S.objModel = await cocoSsd.load();
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
  S.running  = true;
  S.prevObj  = '';
  S.curEmo   = 'neutral';
  S.tEmo = S.tObj = S.tMsg = 0;
  S.smoothed = { happy:0, sad:0, angry:0, surprised:0, fearful:0, neutral:1 };

  D.goBtn.disabled  = true;
  D.stopBtn.disabled = false;

  // Update camera badge
  D.camStatus.innerHTML = '<span class="pulse-dot"></span> Algılıyor';

  typeMessage('Kameraya bak ve yüz ifadeni göster! 😊', '🎭');
  detect();
}

function stopDetection() {
  S.running = false;
  D.goBtn.disabled  = false;
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