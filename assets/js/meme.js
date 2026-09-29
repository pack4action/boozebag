// ---- The meme maker ----
// A picture or two, words laid out one of four ways, and stickers from the
// site's own art. Everything is drawn onto one canvas at the size it will be
// saved at and shown scaled down, so what is on the screen is what comes
// out. Nothing leaves the phone: a picture of your own is read in the
// browser and the finished meme is made there too.
(function () {
  const canvas = document.getElementById('meme-canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const $ = (id) => document.getElementById(id);

  // ---- What there is to work with ----
  const PAIRS = [['nah', 'yeah']];
  const TEMPLATES = [
    { id: 'upload', label: 'Your own', upload: true },
    // Him, in the moments people make memes of. The picker shows the small
    // copy in thumbs/ and the full one is only fetched when it is picked.
    // Each one's size is written down so the frame is the right shape while
    // the picture is still on its way.
    // When one is added here, the row count held open for the list in
    // meme.css (#meme-templates, --rows) may need to go up with it.
    ...[
      ['fine', 'This is fine'], ['warstare', 'War stare', 1086, 1448],
      ['pointing', 'Pointing'], ['cheers', 'Cheers', 1536, 1024],
      ['nah', 'Nah'], ['yeah', 'Yeah'],
    ].map(([id, label, w = 1254, h = 1254]) => ({
      id, label, kind: 'photo', w, h,
      // Where down the picture his face is. A frame that cuts the picture
      // shorter keeps that part in rather than the middle.
      focus: 0.35,
      src: 'assets/img/meme/' + id + '.webp', thumb: 'assets/img/meme/thumbs/' + id + '.webp',
      // Two halves of one meme: in Before / after, picking either puts
      // both in, in this order.
      pair: PAIRS.find((pr) => pr.includes(id)),
    })),
    { id: 'blank', label: 'Blank', kind: 'blank' },
  ];
  // Sizes are a share of the picture's short side, so a sticker is the same
  // size whatever shape the picture is.
  // Laser eyes, drawn here rather than fetched: a red glow with a white hot
  // middle and a beam out to the right. One per eye; Copy makes the second.
  function laserEye() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 440;
    const x = c.getContext('2d');
    const cy = 220;
    const ex = 220;
    const beam = x.createLinearGradient(ex, 0, 1024, 0);
    beam.addColorStop(0, 'rgba(255, 40, 30, 0.95)');
    beam.addColorStop(0.55, 'rgba(255, 40, 30, 0.5)');
    beam.addColorStop(1, 'rgba(255, 40, 30, 0)');
    x.fillStyle = beam;
    x.beginPath();
    x.moveTo(ex, cy - 44);
    x.lineTo(1024, cy - 8);
    x.lineTo(1024, cy + 8);
    x.lineTo(ex, cy + 44);
    x.closePath();
    x.fill();
    const core = x.createLinearGradient(ex, 0, 900, 0);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    core.addColorStop(1, 'rgba(255, 200, 190, 0)');
    x.fillStyle = core;
    x.beginPath();
    x.moveTo(ex, cy - 13);
    x.lineTo(900, cy - 3);
    x.lineTo(900, cy + 3);
    x.lineTo(ex, cy + 13);
    x.closePath();
    x.fill();
    const glow = x.createRadialGradient(ex, cy, 0, ex, cy, 215);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.17, 'rgba(255, 236, 226, 1)');
    glow.addColorStop(0.34, 'rgba(255, 46, 36, 1)');
    glow.addColorStop(0.65, 'rgba(255, 20, 20, 0.42)');
    glow.addColorStop(1, 'rgba(255, 0, 0, 0)');
    x.fillStyle = glow;
    x.fillRect(0, 0, 440, 440);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }
  const LASER = laserEye();
  const STICKERS = [
    ...(LASER ? [{ id: 'laser', src: LASER, size: 0.55 }] : []),
    // Him, cut out. When one is added here, the row count held open for
    // the stickers in meme.css (#meme-stickers, --rows) may need to go up.
    { id: 'head-shocked', src: 'assets/img/meme/stickers/head-shocked.webp', size: 0.34 },
    { id: 'head-grin', src: 'assets/img/meme/stickers/head-grin.webp', size: 0.34 },
    { id: 'thumbs', src: 'assets/img/meme/stickers/thumbs.webp', size: 0.5 },
    { id: 'can', src: 'assets/img/can.png', size: 0.36 },
    { id: 'syringe', src: 'assets/img/syringe.png', size: 0.26 },
    { id: 'degen', src: 'assets/img/degen-sign.png', size: 0.36 },
    { id: 'legend', src: 'assets/img/east-coast-legend.png', size: 0.32 },
    { id: 'shades', src: 'assets/img/work-harder.png', size: 0.5 },
    { id: 'another', src: 'assets/img/another-one.png', size: 0.44 },
  ];
  const EMOJI = ['\u{1F37A}', '\u{1F37B}', '\u{1F4AA}', '\u{1F525}', '\u{1F480}', '\u{1F4C8}',
    '\u{1F680}', '\u{1F602}', '\u{1F974}', '\u{1F921}', '\u{1F451}', '\u{1F48E}'];
  const FACE = "Anton, Impact, 'Arial Narrow', sans-serif";
  const PLAIN = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
  const EMOJI_FACE = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  const MARKER = "Caveat, 'Comic Sans MS', cursive";
  const SERIF = "Georgia, 'Times New Roman', Times, serif";
  // How the words look. The first three are meme lettering; Fire is the
  // same with flames in it, Box is the white box a phone video puts its
  // captions in, and Marker is written by hand, as typed.
  const STYLES = {
    classic: { fill: '#ffffff', stroke: '#000000' },
    amber: { fill: '#ffc632', stroke: '#000000' },
    neon: { fill: '#ffffff', stroke: '#0a0a0d', glow: '#51fb18' },
    fire: { fire: true, stroke: '#2b0600', glow: '#ff5a00' },
    box: { box: true, face: PLAIN, weight: '800 ', upper: false, lh: 1.3, cap: 0.72 },
    marker: { fill: '#ffffff', stroke: '#111111', face: MARKER, weight: '700 ', upper: false, thin: true, lh: 0.98, cap: 0.6 },
  };
  const look = () => STYLES[S.style] || STYLES.classic;
  const letterFont = (size) => (look().weight || '') + size + 'px ' + (look().face || FACE);
  const cased = (t) => (look().upper === false ? t : t.toUpperCase());
  // The layouts with two pictures in them.
  const TWO = new Set(['split', 'side']);
  const twoUp = () => TWO.has(S.layout);
  // Width over height. Fit takes the picture's own.
  const SHAPES = { square: 1, portrait: 0.8, story: 9 / 16, wide: 16 / 9 };
  const LONGEST = 1600;
  const TICKER = '$BOOZEBAG  •  NOBODY SELLS  •  24 DRINKS A DAY  •  BOOZEBAG.US';

  // What the two boxes are called in each layout, and what they suggest.
  const FIELDS = {
    classic: ['Top', 'Bottom', 'Me after one drink', 'Me after 24'],
    caption: ['Caption', 'On the picture (optional)', 'pov: you asked him what his macros are', ''],
    news: ['Headline', 'Ticker (optional)', 'Local man walks the stage on 24 drinks a day', TICKER],
    split: ['Top picture', 'Bottom picture', 'Sober', '24 drinks in'],
    side: ['Next to the top picture', 'Next to the bottom one', 'Going to the gym', 'Going to the bar'],
    poster: ['Title', 'Line under it', 'Dedication', 'Some men lift. Some men drink 24 a day and walk the stage anyway.'],
  };

  // A joke to start from, for anybody staring at an empty box. Written for
  // each layout, since a news headline and a caption are not the same joke.
  const JOKES = {
    classic: [
      ['Me after one drink', 'Me after 24'],
      ['No lifting', 'Still walked the stage'],
      ['I don’t have a drinking problem', 'I have a drinking schedule'],
      ['Rest day?', 'Never heard of her'],
      ['Nobody sells', 'Nobody sobers up'],
      ['Sober Steve', 'Could never'],
      ['My macros', 'Beer, beer and beer'],
      ['Cardio?', 'I walk to the fridge'],
      ['Gym is closed', 'Bar is open'],
      ['Doctor said cut back', 'So I cut the lime'],
      ['24 hours', '24 drinks'],
      ['Not financial advice', 'Not fitness advice either'],
      ['Holding $BOOZEBAG', 'Like I hold my beer'],
      ['Winning my ex wife back', 'One drink at a time'],
      ['Degen mode', 'Permanently on'],
      ['Didn’t lift', 'Still shredded'],
      ['Bulking season', 'Every season'],
      ['When somebody says they’re selling', 'Another one?'],
    ],
    caption: [
      ['me at 9am telling everyone i’m cutting back', ''],
      ['pov: you asked him what his macros are', ''],
      ['my liver and my bag have one thing in common. neither of them sells', ''],
      ['pov: you bought $BOOZEBAG and he’s still only on drink 19', ''],
      ['when the doctor asks how many drinks a week and you have to do maths', ''],
      ['day 40 of no lifting and the arms are somehow bigger', ''],
      ['me explaining to my trainer that the can counts as a dumbbell', ''],
      ['when your pre workout is a 30 rack', ''],
      ['sober steve watching me win the beer mile again', ''],
      ['me checking the chart between drinks 14 and 15', ''],
      ['when somebody in the telegram asks if you’re selling', ''],
      ['nobody:  me at the gym: *opens a cold one*', ''],
    ],
    news: [
      ['Local man walks bodybuilding stage on 24 drinks a day', ''],
      ['Scientists baffled as man gains muscle without lifting', ''],
      ['Sober Steve loses the beer mile for the 400th time', ''],
      ['Breaking: nobody sells', ''],
      ['Holders report feeling roughly 24 drinks in', ''],
      ['Man adds one nicotine pouch a day, science has questions', ''],
      ['Gym shuts down after man turns up with a cooler', ''],
      ['Experts confirm beer is technically carbs', ''],
      ['Liver files for overtime', ''],
    ],
    split: [
      ['Sober', '24 drinks in'],
      ['Day 1', 'Day 150'],
      ['What my trainer planned', 'What I did'],
      ['Before $BOOZEBAG', 'After $BOOZEBAG'],
      ['How it started', 'How it’s going'],
      ['Paper hands', 'Beer hands'],
      ['Sober Steve', 'Me'],
      ['Weekday me', 'Weekend me'],
    ],
    side: [
      ['Going to the gym', 'Going to the bar'],
      ['Selling the dip', 'Buying another beer'],
      ['Rest days', '24 drinks a day'],
      ['Protein shake', 'A cold one'],
      ['Paper hands', 'Nobody sells'],
      ['Lifting weights', 'Lifting cans'],
      ['Counting calories', 'Counting cans'],
      ['Taking profit', 'Taking another sip'],
    ],
    poster: [
      ['Dedication', 'Some men lift. Some men drink 24 a day and walk the stage anyway.'],
      ['Discipline', 'Doing the same thing every day. Even when the thing is beer.'],
      ['Hydration', 'Technically, beer is mostly water.'],
      ['Diamond hands', 'It is not a strategy if you forgot your password.'],
      ['Leadership', 'He never lifted, and yet here we all are.'],
      ['Patience', 'The chart will be fine. The liver, we will see.'],
      ['Recovery', 'Is a word for people who stop.'],
    ],
  };

  // ---- Pictures, fetched once each ----
  const loading = new Map();
  const images = new Map();   // src -> image, once it has arrived
  function load(src) {
    if (loading.has(src)) return loading.get(src);
    const p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { images.set(src, img); resolve(img); };
      img.onerror = () => reject(new Error('no picture'));
      img.src = src;
    });
    loading.set(src, p);
    return p;
  }
  // Pictures people bring, by a key the saved state can name.
  const own = new Map();
  let ownCount = 0;
  function picFor(key) {
    if (!key) return null;
    if (key.startsWith('own:')) {
      const c = own.get(key);
      return c ? { kind: 'photo', img: c } : null;
    }
    const tpl = TEMPLATES.find((t) => t.id === key);
    if (!tpl || tpl.upload) return null;
    if (tpl.kind === 'blank') return { kind: 'blank' };
    const img = images.get(tpl.src);
    if (!img) { load(tpl.src).then(redraw, () => {}); return { kind: tpl.kind, img: null, w: tpl.w, h: tpl.h, focus: tpl.focus }; }
    return { kind: tpl.kind, img, w: tpl.w, h: tpl.h, focus: tpl.focus };
  }
  const artById = (id) => STICKERS.find((s) => s.id === id);
  function artImage(id) {
    const a = artById(id);
    if (!a) return null;
    const img = images.get(a.src);
    if (!img) load(a.src).then(redraw, () => {});
    return img || null;
  }

  // ---- The meme, as data ----
  // Everything here can be written down and read back, which is what undo
  // and picking up where you left off both run on.
  const fresh = () => ({
    layout: 'classic',
    shape: 'auto',
    style: 'classic',
    filter: 'none',
    tsize: 1,    // how big the top and bottom words are, against their usual
    fxk: 1,      // how strong the finish is
    top: '',
    bottom: '',
    panels: [
      { pic: 'fine', zoom: 1, ox: 0, oy: 0 },
      { pic: 'pointing', zoom: 1, ox: 0, oy: 0 },
    ],
    items: [],   // { kind: 'art'|'text'|'emoji', art|text|ch, nx, ny, nw, rot, flip }
  });
  let S = fresh();
  let sel = -1;       // which item is picked
  let panel = 0;      // which picture the picker fills
  let guides = null;  // centre lines while something is snapped to them

  // ---- Where things go ----
  function short() { return Math.min(canvas.width, canvas.height); }

  // The picture's own shape, used when the shape is Fit.
  function ownAspect(p) {
    const pic = picFor(p.pic);
    if (pic && pic.kind === 'photo' && pic.img) return pic.img.width / pic.img.height;
    if (pic && pic.kind === 'photo' && pic.w && pic.h) return pic.w / pic.h;
    return 1;
  }
  // How big the caption bar is, which depends on its words.
  function captionBar(W) {
    const pad = W * 0.05;
    const text = S.top.trim();
    const size = Math.round(W * 0.056);
    if (!text) return { h: Math.round(W * 0.16), size, lines: [] };
    let s = size;
    let lines = wrap(text, s, W - pad * 2, '800 ', PLAIN);
    while (lines.length > 4 && s > W * 0.034) {
      s -= 2;
      lines = wrap(text, s, W - pad * 2, '800 ', PLAIN);
    }
    return { h: Math.round(pad * 1.7 + lines.length * s * 1.22), size: s, lines };
  }
  // The whole layout: the canvas size and where each picture sits.
  function frame() {
    const shaped = SHAPES[S.shape];
    if (S.layout === 'side') {
      // Two rows, a picture on the left of each and its words on white to
      // the right of it.
      const W = 1200;
      const H = shaped ? Math.round(W / shaped) : 1200;
      const gap = 6;
      const row = (H - gap) / 2;
      const half = W / 2;
      return {
        W, H,
        regions: [{ x: 0, y: 0, w: half, h: row }, { x: 0, y: row + gap, w: half, h: row }],
        boxes: [{ x: half, y: 0, w: half, h: row }, { x: half, y: row + gap, w: half, h: row }],
      };
    }
    if (S.layout === 'poster') {
      // The picture in a thin white frame on black, a title under it and a
      // line under that.
      const W = 1200;
      if (shaped) {
        const H = Math.round(W / shaped);
        const m = Math.round(Math.min(W, H) * 0.08);
        const zone = Math.round(Math.max(H * 0.27, 240));
        return { W, H, regions: [{ x: m, y: m, w: W - m * 2, h: Math.max(80, H - m - zone) }] };
      }
      const m = Math.round(W * 0.09);
      const pw = W - m * 2;
      const ph = Math.round(Math.max(pw * 0.55, Math.min(pw * 1.3, pw / ownAspect(S.panels[0]))));
      return { W, H: m + ph + Math.round(W * 0.3), regions: [{ x: m, y: m, w: pw, h: ph }] };
    }
    if (S.layout === 'split') {
      const W = 1080;
      const H = shaped ? Math.round(W / shaped) : 1440;
      const gap = 8;
      const half = (H - gap) / 2;
      return { W, H, regions: [{ x: 0, y: 0, w: W, h: half }, { x: 0, y: half + gap, w: W, h: half }] };
    }
    const first = S.panels[0];
    const pic = picFor(first.pic);
    const aspect = shaped || ownAspect(first);
    let W;
    if (shaped) W = aspect >= 1.2 ? 1200 : 1080;
    else if (pic && pic.kind === 'photo' && (pic.img || pic.w)) W = Math.min(LONGEST, Math.max(720, pic.img ? pic.img.width : pic.w));
    else W = 1080;
    if (aspect > 1 && !shaped) W = Math.min(W, LONGEST);
    let picH = Math.round(W / aspect);
    if (!shaped && picH > LONGEST) { W = Math.round(W * LONGEST / picH); picH = LONGEST; }
    if (S.layout === 'caption') {
      const bar = captionBar(W);
      // With a shape picked the whole thing keeps it, and the picture gives
      // up the height the bar takes.
      if (shaped) {
        // A caption too long for the shape takes no more than half of it.
        if (bar.h > picH * 0.5) bar.h = Math.round(picH * 0.5);
        return { W, H: picH, regions: [{ x: 0, y: bar.h, w: W, h: picH - bar.h }], bar };
      }
      return { W, H: picH + bar.h, regions: [{ x: 0, y: bar.h, w: W, h: picH }], bar };
    }
    return { W, H: picH, regions: [{ x: 0, y: 0, w: W, h: picH }] };
  }
  let F = frame();

  function fit(W, H) {
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      canvas.style.aspectRatio = W + ' / ' + H;
    }
  }

  // ---- Drawing a picture into its place ----
  // Photos cover their place and can be dragged and zoomed within it; the
  // art stands whole on the site's dark with a warm light behind it.
  function picGeometry(p, r) {
    const pic = picFor(p.pic);
    if (!pic || !pic.img) return null;
    const iw = pic.img.width;
    const ih = pic.img.height;
    const base = pic.kind === 'photo'
      ? Math.max(r.w / iw, r.h / ih)
      : Math.min((r.w * 0.96) / iw, (r.h * 0.9) / ih);
    const s = base * p.zoom;
    const w = iw * s;
    const h = ih * s;
    const cx = r.x + r.w / 2 + p.ox * r.w;
    const cy = pic.kind === 'photo'
      ? r.y + r.h / 2 + lean(pic, h, r) + p.oy * r.h
      : r.y + r.h - h / 2 - r.h * 0.05 + p.oy * r.h;
    return { pic, w, h, cx, cy };
  }
  // How far a photo taller than its frame sits off centre so that its
  // focus, rather than its middle, is what shows; never so far an edge does.
  function lean(pic, h, r) {
    const slack = Math.max(0, (h - r.h) / 2);
    const want = (0.5 - (pic.focus == null ? 0.5 : pic.focus)) * h;
    return Math.max(-slack, Math.min(slack, want));
  }
  // A photo is never dragged so far that the edge of it shows, and the art
  // never so far that it leaves.
  function clamp(p, r) {
    const g = picGeometry(p, r);
    if (!g) return;
    if (g.pic.kind !== 'photo') {
      p.ox = Math.max(-0.45, Math.min(0.45, p.ox));
      p.oy = Math.max(-0.6, Math.min(0.45, p.oy));
      return;
    }
    const mx = Math.max(0, (g.w - r.w) / 2) / r.w;
    const my = Math.max(0, (g.h - r.h) / 2) / r.h;
    const off = lean(g.pic, g.h, r) / r.h;
    p.ox = Math.max(-mx, Math.min(mx, p.ox));
    p.oy = Math.max(-my - off, Math.min(my - off, p.oy));
  }
  function drawPicture(p, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const pic = picFor(p.pic);
    if (!pic || pic.kind !== 'photo') {
      ctx.fillStyle = '#0d0b10';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      const glow = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.62, 0,
        r.x + r.w / 2, r.y + r.h * 0.62, Math.max(r.w, r.h) * 0.62);
      glow.addColorStop(0, 'rgba(255, 170, 30, 0.34)');
      glow.addColorStop(0.55, 'rgba(255, 90, 40, 0.1)');
      glow.addColorStop(1, 'rgba(255, 90, 40, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    const g = picGeometry(p, r);
    if (g) ctx.drawImage(g.pic.img, g.cx - g.w / 2, g.cy - g.h / 2, g.w, g.h);
    ctx.restore();
  }

  // ---- Words ----
  function wrap(text, size, maxW, weight, face) {
    ctx.font = (weight || '') + size + 'px ' + (face || FACE);
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width <= maxW || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  }
  // As big as the width allows, two lines at most, three only when there is
  // no other way. Measured with the face actually in use, so nothing ever
  // runs off the edge.
  function fitWords(text, maxW, big, small, face, weight) {
    for (const most of [2, 3]) {
      for (let size = big; size >= small; size -= 2) {
        const lines = wrap(text, size, maxW, weight, face);
        const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (lines.length <= most && widest <= maxW) return { size, lines };
      }
    }
    return { size: small, lines: wrap(text, small, maxW, weight, face) };
  }
  function outlined(line, x, y, size) {
    const l = look();
    // Where the middle of the letters is, whichever baseline is in use.
    const mid = ctx.textBaseline === 'middle' ? y : y - size * 0.36;
    if (l.box) {
      const w = ctx.measureText(line).width + size * 0.56;
      const h = size * 1.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - w / 2, mid - h / 2, w, h, size * 0.24);
      else ctx.rect(x - w / 2, mid - h / 2, w, h);
      ctx.fill();
      ctx.fillStyle = '#0b0b0b';
      ctx.fillText(line, x, y);
      return;
    }
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    if (l.glow) { ctx.shadowColor = l.glow; ctx.shadowBlur = size * 0.35; }
    ctx.lineWidth = size * (l.thin ? 0.11 : 0.17);
    ctx.strokeStyle = l.stroke;
    ctx.strokeText(line, x, y);
    ctx.shadowBlur = 0;
    if (l.fire) {
      const g = ctx.createLinearGradient(0, mid - size * 0.5, 0, mid + size * 0.5);
      g.addColorStop(0, '#fff6a8');
      g.addColorStop(0.45, '#ffb300');
      g.addColorStop(1, '#ff2d00');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = l.fill;
    }
    ctx.fillText(line, x, y);
  }
  // The meme lettering in a place: at its top or its bottom.
  function drawBlock(text, r, where, reserve) {
    const clean = cased(text.trim());
    if (!clean) return;
    const l = look();
    const k = S.tsize || 1;
    const sh = Math.min(r.w, r.h);
    const pad = sh * 0.05;
    const { size, lines } = fitWords(clean, r.w - pad * 2,
      Math.round(Math.min(sh * 0.14, r.w * 0.11) * k), Math.round(sh * 0.05 * Math.min(1, k)), l.face || FACE, l.weight || '');
    const lh = size * (l.lh || 1.04);
    const cap = size * (l.cap || 0.74);
    ctx.save();
    ctx.font = letterFont(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let y = where === 'top' ? r.y + pad + cap : r.y + r.h - pad - (reserve || 0) - (lines.length - 1) * lh;
    lines.forEach((line) => { outlined(line, r.x + r.w / 2, y, size); y += lh; });
    ctx.restore();
  }
  function drawCaptionBar(bar, W) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, bar.h);
    ctx.fillStyle = '#0b0b0b';
    ctx.font = '800 ' + bar.size + 'px ' + PLAIN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = bar.size * 1.22;
    const top = bar.h / 2 - ((bar.lines.length - 1) * lh) / 2;
    bar.lines.forEach((line, i) => ctx.fillText(line, W / 2, top + i * lh));
    ctx.restore();
  }
  // Words on the white beside a picture, in Side by side: plain, dark, as
  // big as the box lets them be.
  function drawSideText(text, r, reserve) {
    const clean = text.trim();
    if (!clean) return;
    const pad = r.w * 0.08;
    const maxW = r.w - pad * 2;
    const maxH = r.h - pad * 2 - (reserve || 0);
    let size = Math.round(r.w * 0.11 * (S.tsize || 1));
    let lines = [];
    for (; size >= 16; size -= 2) {
      lines = wrap(clean, size, maxW, '800 ', PLAIN);
      const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
      if (lines.length * size * 1.18 <= maxH && widest <= maxW) break;
    }
    ctx.save();
    ctx.fillStyle = '#0b0b0b';
    ctx.font = '800 ' + size + 'px ' + PLAIN;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = size * 1.18;
    let y = r.y + (r.h - (reserve || 0)) / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln) => { ctx.fillText(ln, r.x + r.w / 2, y); y += lh; });
    ctx.restore();
  }
  // The poster: a white keyline round the picture, the title in spaced
  // capitals and the line under it, all on black.
  function drawPoster() {
    const r = F.regions[0];
    const W = F.W;
    const k = S.tsize || 1;
    const gap = W * 0.012;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.strokeRect(r.x - gap, r.y - gap, r.w + gap * 2, r.h + gap * 2);
    const top = r.y + r.h + gap;
    const zone = F.H - top;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    const title = S.top.trim().toUpperCase();
    const spaced = 'letterSpacing' in ctx;
    if (title) {
      let size = Math.round(Math.min(W * 0.1, zone * 0.34) * k);
      for (; size > 18; size -= 2) {
        ctx.font = size + 'px ' + SERIF;
        if (spaced) ctx.letterSpacing = Math.round(size * 0.08) + 'px';
        if (ctx.measureText(title).width <= W * 0.88) break;
      }
      ctx.fillText(title, W / 2, top + zone * 0.3);
      if (spaced) ctx.letterSpacing = '0px';
    }
    const sub = S.bottom.trim();
    if (sub) {
      let size = Math.round(Math.min(W * 0.04, zone * 0.13) * k);
      let lines = wrap(sub, size, W * 0.8, '', SERIF);
      while (lines.length > 2 && size > 14) { size -= 1; lines = wrap(sub, size, W * 0.8, '', SERIF); }
      ctx.font = size + 'px ' + SERIF;
      ctx.fillStyle = '#d6d6d6';
      const lh = size * 1.3;
      let y = top + zone * 0.55;
      lines.forEach((ln) => { ctx.fillText(ln, W / 2, y); y += lh; });
    }
    ctx.restore();
  }
  // A news banner along the bottom: a red tag, the headline on white, and a
  // ticker under it.
  function drawNews(r) {
    const W = r.w;
    const sh = Math.min(r.w, r.h);
    const tickH = Math.round(sh * 0.062);
    const headline = S.top.trim().toUpperCase() || 'BREAKING';
    const pad = W * 0.03;
    const fitted = fitWords(headline, W - pad * 2, Math.round(sh * 0.085), Math.round(sh * 0.04), FACE, '');
    const lh = fitted.size * 1.08;
    const headH = Math.round(pad * 1.1 + fitted.lines.length * lh);
    const tagH = Math.round(sh * 0.07);
    const bottom = r.y + r.h - sh * 0.05;
    const tickY = bottom - tickH;
    const headY = tickY - headH;
    const tagY = headY - tagH;
    ctx.save();
    // The tag.
    ctx.font = Math.round(tagH * 0.62) + 'px ' + FACE;
    const tag = '$BOOZEBAG NEWS';
    const tagW = ctx.measureText(tag).width + tagH * 0.9;
    ctx.fillStyle = '#e5202e';
    ctx.fillRect(r.x, tagY, tagW, tagH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(tag, r.x + tagH * 0.45, tagY + tagH / 2 + tagH * 0.04);
    // The live dot, after the tag.
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(r.x + tagW, tagY, tagH * 1.6, tagH);
    ctx.fillStyle = '#e5202e';
    ctx.beginPath();
    ctx.arc(r.x + tagW + tagH * 0.42, tagY + tagH / 2, tagH * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = Math.round(tagH * 0.46) + 'px ' + FACE;
    ctx.fillText('LIVE', r.x + tagW + tagH * 0.68, tagY + tagH / 2 + tagH * 0.03);
    // The headline.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x, headY, W, headH);
    ctx.fillStyle = '#0b0b0b';
    ctx.font = fitted.size + 'px ' + FACE;
    ctx.textBaseline = 'alphabetic';
    let y = headY + pad * 0.55 + fitted.size * 0.8;
    fitted.lines.forEach((line) => { ctx.fillText(line, r.x + pad, y); y += lh; });
    // The ticker.
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(r.x, tickY, W, tickH);
    ctx.fillStyle = '#ffc632';
    ctx.font = Math.round(tickH * 0.56) + 'px ' + FACE;
    ctx.textBaseline = 'middle';
    const tick = (S.bottom.trim() || TICKER).toUpperCase();
    let run = '';
    while (ctx.measureText(run + tick + '  •  ').width < W * 1.6 && run.length < 600) run += tick + '  •  ';
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, tickY, W, tickH);
    ctx.clip();
    ctx.fillText(run, r.x + pad, tickY + tickH / 2 + tickH * 0.04);
    ctx.restore();
    ctx.restore();
  }

  // ---- The coin's name ----
  // In a corner of everything that goes out: small enough not to be the
  // joke, big enough to be read in a feed. News puts it top right, since the
  // banner has the bottom.
  function drawStamp(W, H) {
    const size = Math.max(14, Math.round(Math.min(W, H) * 0.034));
    const pad = Math.min(W, H) * 0.028;
    ctx.save();
    ctx.font = size + 'px ' + FACE;
    const nameW = ctx.measureText('$BOOZEBAG').width;
    ctx.font = Math.round(size * 0.62) + 'px ' + FACE;
    const siteW = ctx.measureText('boozebag.us').width;
    const gap = size * 0.4;
    const w = nameW + gap + siteW + size * 0.9;
    const h = size * 1.45;
    const x = W - pad - w;
    const y = S.layout === 'news' ? pad : H - pad - h;
    ctx.fillStyle = 'rgba(10, 10, 13, 0.62)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = size + 'px ' + FACE;
    ctx.fillStyle = '#ffc632';
    ctx.fillText('$BOOZEBAG', x + size * 0.45, y + h / 2 + size * 0.04);
    ctx.font = Math.round(size * 0.62) + 'px ' + FACE;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('boozebag.us', x + size * 0.45 + nameW + gap, y + h / 2 + size * 0.06);
    ctx.restore();
    return S.layout === 'news' ? 0 : h + pad * 0.6;
  }

  // ---- Things on top: stickers, text and emoji ----
  function itemBox(it) {
    const sh = short();
    const x = it.nx * canvas.width;
    const y = it.ny * canvas.height;
    if (it.kind === 'art') {
      const img = artImage(it.art);
      const w = it.nw * sh;
      const h = img ? w * (img.height / img.width) : w;
      return { x, y, w, h };
    }
    const size = it.nw * sh;
    if (it.kind === 'emoji') return { x, y, w: size * 1.15, h: size * 1.15, size };
    ctx.font = letterFont(size);
    const w = Math.max(size, ctx.measureText(cased(it.text || ' ')).width) + size * (look().box ? 0.7 : 0.3);
    return { x, y, w, h: size * (look().box ? 1.3 : 1.15), size };
  }
  function drawItem(it) {
    const b = itemBox(it);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(it.rot);
    if (it.flip) ctx.scale(-1, 1);
    if (it.kind === 'art') {
      const img = artImage(it.art);
      const art = artById(it.art);
      if (img) {
        if (art && art.round) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
          ctx.restore();
          ctx.beginPath();
          ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(3, b.w * 0.035);
          ctx.strokeStyle = '#ffc632';
          ctx.stroke();
        } else {
          ctx.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
        }
      }
    } else if (it.kind === 'emoji') {
      ctx.font = b.size + 'px ' + EMOJI_FACE;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(it.ch, 0, b.size * 0.06);
    } else {
      ctx.font = letterFont(b.size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      outlined(cased(it.text || ''), 0, b.size * 0.06, b.size);
    }
    ctx.restore();
  }
  function handleAt(it) {
    const b = itemBox(it);
    const hx = b.w / 2;
    const hy = b.h / 2;
    const c = Math.cos(it.rot);
    const n = Math.sin(it.rot);
    return { x: b.x + hx * c - hy * n, y: b.y + hx * n + hy * c };
  }
  const HANDLE = () => Math.max(18, short() * 0.034);
  function drawPicked() {
    const it = S.items[sel];
    const line = Math.max(2, short() * 0.004);
    if (guides) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 60, 170, 0.9)';
      ctx.lineWidth = line;
      if (guides.x) { ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke(); }
      if (guides.y) { ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke(); }
      ctx.restore();
    }
    if (!it) return;
    const b = itemBox(it);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(it.rot);
    ctx.setLineDash([line * 4, line * 3]);
    ctx.lineWidth = line;
    ctx.strokeStyle = '#ffc632';
    ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
    const h = handleAt(it);
    ctx.save();
    ctx.beginPath();
    ctx.arc(h.x, h.y, HANDLE(), 0, Math.PI * 2);
    ctx.fillStyle = '#ffc632';
    ctx.fill();
    ctx.lineWidth = line * 1.5;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(h.x, h.y, HANDLE() * 0.48, -Math.PI * 0.2, Math.PI * 1.3);
    ctx.lineWidth = line * 1.6;
    ctx.stroke();
    ctx.restore();
  }
  // Which picture is being filled, when there are two of them.
  function drawPanelMark() {
    if (!twoUp()) return;
    const r = F.regions[panel];
    const line = Math.max(3, short() * 0.006);
    ctx.save();
    ctx.strokeStyle = '#ffc632';
    ctx.lineWidth = line;
    ctx.setLineDash([line * 3, line * 2]);
    ctx.strokeRect(r.x + line / 2, r.y + line / 2, r.w - line, r.h - line);
    ctx.restore();
  }

  // ---- Filters ----
  // Done on the finished picture, words and all, the way a fried meme is
  // fried all the way through.
  // Noise made once and read from, rather than worked out for every pixel
  // of every drawing, which is what kept the grainy finishes from keeping
  // up with a finger.
  const NOISE = (() => {
    const n = new Int8Array(1 << 16);
    let seed = 7654321;
    for (let i = 0; i < n.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      n[i] = ((seed >> 8) & 255) - 128;
    }
    return n;
  })();
  function filterPixels(name) {
    if (name === 'none') return;
    const W = canvas.width;
    const H = canvas.height;
    const id = ctx.getImageData(0, 0, W, H);
    const d = id.data;
    // What was there before, for the effects that move pixels about and for
    // the strength slider, which mixes the two.
    const k = Math.max(0.1, Math.min(1, S.fxk == null ? 1 : S.fxk));
    const moves = name === 'vhs' || name === 'glitch' || name === 'pixel';
    const orig = k < 1 || moves ? new Uint8ClampedArray(d) : null;
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >> 8) / 8388608; };
    const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    if (name === 'noir') {
      for (let i = 0; i < d.length; i += 4) {
        let v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        v = (v - 128) * 1.28 + 128;
        v = v < 0 ? 0 : v > 255 ? 255 : v;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    } else if (name === 'gold') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.min(255, d[i] * 1.08 + 14);
        d[i + 1] = Math.min(255, d[i + 1] * 1.02 + 6);
        d[i + 2] = d[i + 2] * 0.84;
      }
    } else if (name === 'fried') {
      for (let i = 0; i < d.length; i += 4) {
        let r = d[i];
        let g = d[i + 1];
        let b = d[i + 2];
        const l = r * 0.3 + g * 0.59 + b * 0.11;
        // Everything turned right up: colour, then contrast, then grit.
        r = l + (r - l) * 2.3;
        g = l + (g - l) * 2.3;
        b = l + (b - l) * 2.3;
        r = (r - 128) * 1.55 + 140;
        g = (g - 128) * 1.55 + 128;
        b = (b - 128) * 1.55 + 106;
        const grit = (NOISE[(i >> 2) & 65535] * 22) >> 7;
        r += grit; g += grit; b += grit;
        d[i] = r < 0 ? 0 : r > 255 ? 255 : (r >> 3) << 3;
        d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : (g >> 3) << 3;
        d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : (b >> 3) << 3;
      }
    } else if (name === 'film') {
      // Warm, faded and grainy, like a print left in a drawer.
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        const grain = (NOISE[(i >> 2) & 65535] * 17) >> 7;
        const r = l * 0.55 + d[i] * 0.45;
        const g = l * 0.55 + d[i + 1] * 0.45;
        const b = l * 0.55 + d[i + 2] * 0.45;
        d[i] = clamp8(r * 0.86 + 34 + grain);
        d[i + 1] = clamp8(g * 0.84 + 24 + grain);
        d[i + 2] = clamp8(b * 0.72 + 14 + grain);
      }
    } else if (name === 'pump' || name === 'dump') {
      // The whole picture in the colour of the candle: dark to light,
      // from nearly black to the brightest green, or red.
      const lo = name === 'pump' ? [2, 22, 8] : [26, 2, 6];
      const hi = name === 'pump' ? [150, 255, 110] : [255, 96, 96];
      for (let i = 0; i < d.length; i += 4) {
        let t = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
        t = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        d[i] = lo[0] + (hi[0] - lo[0]) * t;
        d[i + 1] = lo[1] + (hi[1] - lo[1]) * t;
        d[i + 2] = lo[2] + (hi[2] - lo[2]) * t;
      }
    } else if (name === 'vhs') {
      // A tape: the colours pulled apart sideways, lines across it, washed
      // out, with noise.
      const off = Math.max(2, Math.round(W * 0.005));
      const line = Math.max(2, Math.round(H / 300));
      const shift = off * 4;
      const last = (W - 1) * 4;
      for (let y = 0; y < H; y++) {
        const dark = (Math.floor(y / line) % 2) ? 0.8 : 1;
        const row = y * W * 4;
        for (let x4 = 0; x4 <= last; x4 += 4) {
          const i = row + x4;
          const n = (NOISE[(i >> 2) & 65535] * 13) >> 7;
          const r = orig[row + (x4 + shift > last ? last : x4 + shift)];
          const b = orig[row + (x4 < shift ? 0 : x4 - shift) + 2];
          d[i] = (r * 0.86 + 22 + n) * dark;
          d[i + 1] = (orig[i + 1] * 0.84 + 16 + n) * dark;
          d[i + 2] = (b * 0.86 + 26 + n) * dark;
        }
      }
    } else if (name === 'glitch') {
      // Bands of the picture knocked sideways, and the colours split.
      const shift = new Int32Array(H);
      let y = 0;
      while (y < H) {
        const band = Math.round(H * (0.006 + rnd() * 0.05));
        const s = rnd() < 0.38 ? Math.round((rnd() - 0.5) * W * 0.14) : 0;
        for (let j = y; j < Math.min(H, y + band); j++) shift[j] = s;
        y += band;
      }
      const split = Math.max(3, Math.round(W * 0.008));
      const at = (x, yy, c) => orig[(yy * W + Math.max(0, Math.min(W - 1, x))) * 4 + c];
      for (let yy = 0; yy < H; yy++) {
        const s = shift[yy];
        for (let x = 0; x < W; x++) {
          const i = (yy * W + x) * 4;
          d[i] = at(x - s + split, yy, 0);
          d[i + 1] = at(x - s, yy, 1);
          d[i + 2] = at(x - s - split, yy, 2);
        }
      }
    } else if (name === 'pixel') {
      // Big square pixels, like an old game.
      const size = Math.max(4, Math.round(Math.min(W, H) / 72));
      for (let by = 0; by < H; by += size) {
        for (let bx = 0; bx < W; bx += size) {
          let r = 0; let g = 0; let b = 0; let n = 0;
          for (let yy = by; yy < Math.min(H, by + size); yy++) {
            for (let xx = bx; xx < Math.min(W, bx + size); xx++) {
              const i = (yy * W + xx) * 4;
              r += orig[i]; g += orig[i + 1]; b += orig[i + 2]; n++;
            }
          }
          // A short palette, which is most of what makes it look like one.
          r = (Math.round(r / n / 36) * 36); g = (Math.round(g / n / 36) * 36); b = (Math.round(b / n / 36) * 36);
          for (let yy = by; yy < Math.min(H, by + size); yy++) {
            for (let xx = bx; xx < Math.min(W, bx + size); xx++) {
              const i = (yy * W + xx) * 4;
              d[i] = clamp8(r); d[i + 1] = clamp8(g); d[i + 2] = clamp8(b);
            }
          }
        }
      }
    }
    if (k < 1) {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = orig[i] + (d[i] - orig[i]) * k;
        d[i + 1] = orig[i + 1] + (d[i + 1] - orig[i + 1]) * k;
        d[i + 2] = orig[i + 2] + (d[i + 2] - orig[i + 2]) * k;
      }
    }
    ctx.putImageData(id, 0, 0);
  }
  function vignette() {
    const W = canvas.width;
    const H = canvas.height;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // Frying finishes with a pass through a cheap JPEG, the one part that has
  // to wait on the browser. It runs when things go still, and always before
  // anything is saved.
  let crunched = null;   // the fried picture once it has been through
  let crunchKey = '';
  let crunchFailed = '';  // a picture the browser would not crunch is not asked again
  function crunch() {
    const key = stamp();
    return new Promise((resolve) => {
      let url = '';
      try { url = canvas.toDataURL('image/jpeg', 0.2); } catch (e) { url = ''; }
      if (!url) { crunchFailed = key; resolve(null); return; }
      const img = new Image();
      img.onload = () => { crunched = img; crunchKey = key; resolve(img); };
      img.onerror = () => { crunchFailed = key; resolve(null); };
      img.src = url;
    });
  }

  // ---- The whole picture ----
  function compose() {
    F = frame();
    fit(F.W, F.H);
    ctx.clearRect(0, 0, F.W, F.H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, F.W, F.H);
    if (F.boxes) {
      ctx.fillStyle = '#ffffff';
      F.boxes.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
    }
    if (twoUp()) {
      drawPicture(S.panels[0], F.regions[0]);
      drawPicture(S.panels[1], F.regions[1]);
    } else {
      drawPicture(S.panels[0], F.regions[0]);
    }
    if (S.filter === 'gold' || S.filter === 'noir' || S.filter === 'film') vignette();
    S.items.forEach(drawItem);
    // Glitch and 8-bit take the picture apart, so they are done before the
    // words go on and the words stay readable. The rest go over everything.
    const under = S.filter === 'glitch' || S.filter === 'pixel';
    if (under) filterPixels(S.filter);
    const reserve = drawStamp(F.W, F.H);
    const r0 = F.regions[0];
    if (S.layout === 'classic') {
      drawBlock(S.top, r0, 'top', 0);
      drawBlock(S.bottom, r0, 'bottom', reserve);
    } else if (S.layout === 'caption') {
      drawCaptionBar(F.bar, F.W);
      drawBlock(S.bottom, r0, 'bottom', reserve);
    } else if (S.layout === 'news') {
      drawNews(r0);
    } else if (S.layout === 'split') {
      drawBlock(S.top, F.regions[0], 'bottom', 0);
      drawBlock(S.bottom, F.regions[1], 'bottom', reserve);
    } else if (S.layout === 'side') {
      drawSideText(S.top, F.boxes[0], 0);
      drawSideText(S.bottom, F.boxes[1], reserve);
    } else if (S.layout === 'poster') {
      drawPoster();
    }
    if (!under) filterPixels(S.filter);
  }
  // What the picture is right now, as a string, so a fried version can tell
  // whether it is still the picture on the screen.
  function stamp() { return JSON.stringify(S) + '|' + canvas.width + 'x' + canvas.height; }

  let crunchTimer = 0;
  function draw() {
    compose();
    if (S.filter === 'fried') {
      const now = stamp();
      if (crunched && crunchKey === now) ctx.drawImage(crunched, 0, 0, canvas.width, canvas.height);
      else if (crunchFailed !== now) {
        clearTimeout(crunchTimer);
        crunchTimer = setTimeout(() => {
          compose();
          crunch().then(() => draw());
        }, 160);
      }
    }
    drawPanelMark();
    drawPicked();
  }
  let queued = false;
  function redraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  }
  // The finished picture, with none of the editing marks on it.
  async function finished() {
    compose();
    if (S.filter === 'fried') {
      const img = await crunch();
      if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    draw();
    return blob;
  }

  // ---- Undo, and remembering ----
  const past = [];
  const future = [];
  let last = JSON.stringify(S);
  const undoBtn = $('meme-undo');
  const redoBtn = $('meme-redo');
  function buttons() {
    undoBtn.disabled = !past.length;
    redoBtn.disabled = !future.length;
  }
  function commit() {
    const now = JSON.stringify(S);
    if (now === last) return;
    past.push(last);
    if (past.length > 80) past.shift();
    future.length = 0;
    last = now;
    buttons();
    remember();
  }
  function restore(json) {
    S = JSON.parse(json);
    last = json;
    sel = -1;
    if (panel > 0 && !twoUp()) panel = 0;
    syncControls();
    showSel();
    redraw();
    remember();
  }
  undoBtn.addEventListener('click', () => {
    if (!past.length) return;
    future.push(last);
    restore(past.pop());
    buttons();
  });
  redoBtn.addEventListener('click', () => {
    if (!future.length) return;
    past.push(last);
    restore(future.pop());
    buttons();
  });

  // Kept in this browser, so a meme half made is still there after a
  // refresh. Pictures of your own go in too while they are small enough.
  const KEEP = 'boozebagMeme';
  const KEEP_OWN = 'boozebagMemeOwn';
  let rememberTimer = 0;
  function remember(now) {
    clearTimeout(rememberTimer);
    const write = () => {
      try {
        localStorage.setItem(KEEP, JSON.stringify(S));
        // The shape it was, for the page to lay itself out with next time
        // before this script has loaded (see the script under the canvas).
        localStorage.setItem(KEEP + 'Size', canvas.width + 'x' + canvas.height);
        const used = new Set(S.panels.map((p) => p.pic).filter((k) => k.startsWith('own:')));
        const out = {};
        used.forEach((k) => {
          const c = own.get(k);
          if (c) out[k] = c.toDataURL('image/jpeg', 0.86);
        });
        const text = JSON.stringify(out);
        if (text.length < 2500000) localStorage.setItem(KEEP_OWN, text);
        else localStorage.removeItem(KEEP_OWN);
      } catch (e) { /* a full or blocked store just means no memory */ }
    };
    // Written straight away when asked, otherwise once things go still, so
    // a drag is not a write on every frame.
    if (now) { rememberTimer = 0; write(); return; }
    rememberTimer = setTimeout(() => { rememberTimer = 0; write(); }, 400);
    pending = write;
  }
  // Anything still waiting is written before the page goes, so a refresh
  // straight after a change does not lose it.
  let pending = null;
  window.addEventListener('pagehide', () => {
    if (rememberTimer && pending) { clearTimeout(rememberTimer); rememberTimer = 0; pending(); }
  });
  function recall() {
    let saved = null;
    let pics = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEEP));
      pics = JSON.parse(localStorage.getItem(KEEP_OWN)) || {};
    } catch (e) { saved = null; }
    if (!saved || !Array.isArray(saved.panels) || !Array.isArray(saved.items)) return Promise.resolve(false);
    const waits = Object.keys(pics).map((k) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        own.set(k, c);
        const n = Number(k.split(':')[1]);
        if (n > ownCount) ownCount = n;
        resolve();
      };
      img.onerror = resolve;
      img.src = pics[k];
    }));
    return Promise.all(waits).then(() => {
      // A picture of your own that did not fit in the store is gone, and a
      // picture the maker no longer has is too; either place falls back to
      // the one it starts with rather than to nothing.
      const starts = fresh().panels;
      saved.panels.forEach((p, i) => {
        const gone = p.pic.startsWith('own:') ? !own.has(p.pic) : !TEMPLATES.some((t) => t.id === p.pic);
        if (gone) p.pic = starts[i] ? starts[i].pic : starts[0].pic;
      });
      // Likewise a sticker the maker no longer has.
      saved.items = saved.items.filter((it) => it.kind !== 'art' || artById(it.art));
      S = Object.assign(fresh(), saved);
      last = JSON.stringify(S);
      wantMarker();
      return true;
    });
  }

  // ---- The controls ----
  const note = $('meme-note');
  function say(text) { if (note) note.textContent = text || ''; }
  function flash(btn, text, back) {
    const label = btn.querySelector('.btn-label') || btn;
    label.textContent = text;
    setTimeout(() => { label.textContent = back; }, 1600);
  }
  function chips(rowId, attr, value) {
    $(rowId).querySelectorAll('[data-' + attr + ']').forEach((b) => {
      const on = b.dataset[attr] === String(value);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  const topIn = $('meme-top');
  const bottomIn = $('meme-bottom');
  const zoomIn = $('meme-zoom');
  function syncControls() {
    topIn.value = S.top;
    bottomIn.value = S.bottom;
    const f = FIELDS[S.layout];
    $('lab-top').textContent = f[0];
    $('lab-bottom').textContent = f[1];
    topIn.placeholder = f[2];
    bottomIn.placeholder = f[3];
    chips('meme-layouts', 'layout', S.layout);
    chips('meme-shapes', 'shape', S.shape);
    chips('meme-styles', 'style', S.style);
    chips('meme-filters', 'filter', S.filter);
    $('meme-panels').hidden = !twoUp();
    chips('meme-panels', 'panel', panel);
    zoomIn.value = S.panels[panel].zoom;
    $('meme-tsize').value = S.tsize || 1;
    $('meme-fxk').value = S.fxk == null ? 1 : S.fxk;
    $('meme-fxk-row').hidden = S.filter === 'none';
    markPicked();
  }
  // The size of the words, and how strong the finish is: both slide, and
  // go into the undo list once the sliding stops.
  $('meme-tsize').addEventListener('input', (e) => { S.tsize = Number(e.target.value); redraw(); typed(); });
  $('meme-fxk').addEventListener('input', (e) => { S.fxk = Number(e.target.value); redraw(); typed(); });

  // Layout, shape, lettering, finish.
  function onChip(rowId, attr, apply) {
    $(rowId).querySelectorAll('[data-' + attr + ']').forEach((b) => {
      b.addEventListener('click', () => {
        apply(b.dataset[attr]);
        syncControls();
        redraw();
        commit();
      });
    });
  }
  onChip('meme-layouts', 'layout', (v) => {
    const fromPair = PAIRS.some((pr) => pr[0] === S.panels[0].pic && pr[1] === S.panels[1].pic);
    S.layout = v;
    if (!twoUp()) panel = 0;
    // A two picture layout opened on pictures nobody has touched starts on
    // a real pair: Nah and Yeah.
    const starts = fresh().panels;
    const untouched = S.panels.every((p) => p.zoom === 1 && !p.ox && !p.oy)
      && (fromPair || S.panels.every((p, i) => p.pic === starts[i].pic));
    if (twoUp() && untouched) {
      PAIRS[0].forEach((k, i) => { S.panels[i].pic = k; });
    }
    hint();
  });
  onChip('meme-shapes', 'shape', (v) => { S.shape = v; S.panels.forEach((p) => { p.ox = 0; p.oy = 0; }); });
  onChip('meme-styles', 'style', (v) => { S.style = v; wantMarker(); });
  // The handwriting is only fetched once somebody picks it, and the
  // picture drawn again when it arrives.
  function wantMarker() {
    if (S.style !== 'marker' || !document.fonts || !document.fonts.load) return;
    document.fonts.load('700 64px Caveat').then(redraw, () => {});
  }
  onChip('meme-filters', 'filter', (v) => { S.filter = v; });
  onChip('meme-panels', 'panel', (v) => { panel = Number(v); });

  // The words, and the rest of the words.
  let typing = 0;
  function typed() { clearTimeout(typing); typing = setTimeout(commit, 600); }
  topIn.addEventListener('input', () => { S.top = topIn.value; redraw(); typed(); });
  bottomIn.addEventListener('input', () => { S.bottom = bottomIn.value; redraw(); typed(); });
  let lastJoke = -1;
  $('meme-roll').addEventListener('click', () => {
    const list = JOKES[S.layout];
    let i = Math.floor(Math.random() * list.length);
    if (i === lastJoke && list.length > 1) i = (i + 1) % list.length;
    lastJoke = i;
    S.top = list[i][0];
    S.bottom = list[i][1];
    syncControls();
    redraw();
    commit();
  });

  // ---- Pictures ----
  function markPicked() {
    const key = S.panels[panel].pic;
    tplButtons.forEach((b) => {
      const on = key.startsWith('own:') ? b.dataset.id === 'upload' : b.dataset.id === key;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  function usePicture(key) {
    const tpl = TEMPLATES.find((t) => t.id === key);
    const both = twoUp() && tpl && tpl.pair;
    (both ? S.panels : [S.panels[panel]]).forEach((p, i) => {
      p.pic = both ? tpl.pair[i] : key;
      p.zoom = 1;
      p.ox = 0;
      p.oy = 0;
    });
    syncControls();
    redraw();
    commit();
  }
  const fileIn = $('meme-file');
  // A picture from anywhere, kept at a size a feed shows without shrinking.
  function takeFile(file) {
    if (!file || !/^image\//.test(file.type || 'image/')) {
      say('That is not a picture this browser can open. A screenshot works.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, LONGEST / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ownCount += 1;
      const key = 'own:' + ownCount;
      own.set(key, c);
      say('');
      usePicture(key);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      say('That file is not a picture this browser can open. A screenshot works.');
    };
    img.src = url;
  }
  fileIn.addEventListener('change', () => {
    const file = fileIn.files && fileIn.files[0];
    fileIn.value = '';
    if (file) takeFile(file);
  });
  const tplRow = $('meme-templates');
  const tplButtons = [];
  TEMPLATES.forEach((tpl) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meme-pick';
    b.setAttribute('role', 'radio');
    b.dataset.id = tpl.id;
    if (tpl.upload) {
      b.innerHTML = '<span class="meme-pick-art meme-pick-plus"><svg viewBox="0 0 24 24" aria-hidden="true">'
        + '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></span>';
    } else if (tpl.src) {
      b.innerHTML = '<span class="meme-pick-art' + (tpl.kind === 'art' ? ' is-dark' : '') + '"><img src="'
        + (tpl.thumb || tpl.src) + '" alt="" loading="lazy" decoding="async" /></span>';
    } else {
      b.innerHTML = '<span class="meme-pick-art is-dark is-blank"></span>';
    }
    const label = document.createElement('span');
    label.className = 'meme-pick-label';
    label.textContent = tpl.label;
    b.appendChild(label);
    b.addEventListener('click', () => {
      if (tpl.upload) { fileIn.click(); return; }
      if (tpl.src) load(tpl.src).then(() => usePicture(tpl.id), () => say('That picture would not load.'));
      else usePicture(tpl.id);
    });
    tplRow.appendChild(b);
    tplButtons.push(b);
  });

  // Zoom, for the picture being filled.
  zoomIn.addEventListener('input', () => {
    const p = S.panels[panel];
    p.zoom = Number(zoomIn.value);
    clamp(p, F.regions[Math.min(panel, F.regions.length - 1)]);
    redraw();
  });
  zoomIn.addEventListener('change', commit);
  $('meme-reframe').addEventListener('click', () => {
    const p = S.panels[panel];
    p.zoom = 1;
    p.ox = 0;
    p.oy = 0;
    syncControls();
    redraw();
    commit();
  });

  // Pasted, or dropped on the picture.
  document.addEventListener('paste', (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const item of items) {
      if (item.kind === 'file' && /^image\//.test(item.type)) {
        e.preventDefault();
        takeFile(item.getAsFile());
        return;
      }
    }
  });
  const wrapEl = $('meme-wrap');
  wrapEl.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    wrapEl.classList.add('is-dropping');
  });
  wrapEl.addEventListener('dragleave', () => wrapEl.classList.remove('is-dropping'));
  wrapEl.addEventListener('drop', (e) => {
    wrapEl.classList.remove('is-dropping');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    takeFile(file);
  });

  // ---- Stickers, text and emoji ----
  const selBar = $('meme-sel');
  const selText = $('sel-text');
  function showSel() {
    const it = S.items[sel];
    selBar.hidden = !it;
    selText.hidden = !it || it.kind !== 'text';
    if (it && it.kind === 'text' && document.activeElement !== selText) selText.value = it.text;
    hint();
  }
  function pick(i) {
    sel = i;
    showSel();
    redraw();
  }
  // Each new thing lands a little off the last, so a second of the same is
  // not hidden exactly under the first.
  function spot() {
    const n = S.items.length;
    return { nx: 0.5 + ((n % 3) - 1) * 0.08, ny: 0.5 + ((n % 2) ? 0.06 : -0.04) };
  }
  function add(item) {
    S.items.push(Object.assign(spot(), { rot: 0, flip: false }, item));
    pick(S.items.length - 1);
    commit();
  }
  const stickRow = $('meme-stickers');
  STICKERS.forEach((art) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meme-stick';
    b.dataset.id = art.id;
    b.setAttribute('aria-label', 'Add sticker');
    b.innerHTML = '<img src="' + art.src + '" alt="" loading="lazy" decoding="async"'
      + (art.round ? ' class="is-round"' : '') + ' />';
    b.addEventListener('click', () => {
      load(art.src).then(() => add({ kind: 'art', art: art.id, nw: art.size }), () => say('That sticker would not load.'));
    });
    stickRow.appendChild(b);
  });
  const emojiRow = $('meme-emoji');
  EMOJI.forEach((ch) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'meme-emo';
    b.textContent = ch;
    b.setAttribute('aria-label', 'Add emoji');
    b.addEventListener('click', () => add({ kind: 'emoji', ch, nw: 0.16 }));
    emojiRow.appendChild(b);
  });
  $('meme-addtext').addEventListener('click', () => {
    add({ kind: 'text', text: 'Your text', nw: 0.09 });
    selText.value = 'Your text';
    selText.focus();
    selText.select();
  });
  selText.addEventListener('input', () => {
    const it = S.items[sel];
    if (!it || it.kind !== 'text') return;
    it.text = selText.value;
    redraw();
    typed();
  });
  $('sel-flip').addEventListener('click', () => {
    const it = S.items[sel];
    if (it) { it.flip = !it.flip; redraw(); commit(); }
  });
  $('sel-dup').addEventListener('click', () => {
    const it = S.items[sel];
    if (!it) return;
    const copy = JSON.parse(JSON.stringify(it));
    copy.nx = Math.min(0.95, copy.nx + 0.05);
    copy.ny = Math.min(0.95, copy.ny + 0.05);
    S.items.push(copy);
    pick(S.items.length - 1);
    commit();
  });
  $('sel-front').addEventListener('click', () => {
    const it = S.items[sel];
    if (!it) return;
    S.items.splice(sel, 1);
    S.items.push(it);
    pick(S.items.length - 1);
    commit();
  });
  function removePicked() {
    if (sel < 0) return;
    S.items.splice(sel, 1);
    pick(-1);
    commit();
  }
  $('sel-remove').addEventListener('click', removePicked);

  // Keys, on a desk.
  document.addEventListener('keydown', (e) => {
    const inField = e.target && /INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range';
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !inField && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      (e.shiftKey ? redoBtn : undoBtn).click();
      return;
    }
    if (mod && !inField && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redoBtn.click(); return; }
    if (inField || sel < 0) return;
    const it = S.items[sel];
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePicked(); return; }
    if (e.key === 'Escape') { pick(-1); return; }
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      it.nx += moves[e.key][0];
      it.ny += moves[e.key][1];
      redraw();
      typed();
    }
  });

  const hintEl = $('meme-hint');
  function hint() {
    if (!hintEl) return;
    const it = S.items[sel];
    if (it && it.kind === 'text') hintEl.textContent = 'Type to change it. Drag it, pull the corner to size and turn.';
    else if (it) hintEl.textContent = 'Drag it. Pull the corner to size and turn it.';
    else if (twoUp()) hintEl.textContent = 'Tap a picture to fill it. Drag to frame it.';
    else hintEl.textContent = 'Drag the picture to frame it.';
  }

  // ---- Hands on the picture ----
  // On a picked thing: one finger moves it, the corner handle or two fingers
  // size and turn it. Anywhere else: one finger frames the picture under it,
  // two fingers zoom it.
  function toPicture(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height),
    };
  }
  function hit(p) {
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      const b = itemBox(it);
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const c = Math.cos(-it.rot);
      const n = Math.sin(-it.rot);
      const lx = dx * c - dy * n;
      const ly = dx * n + dy * c;
      if (Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2) return i;
    }
    return -1;
  }
  function regionAt(p) {
    for (let i = 0; i < F.regions.length; i++) {
      const r = F.regions[i];
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
    }
    return -1;
  }
  const SNAP = 0.012;
  const fingers = new Map();
  let grab = null;
  canvas.addEventListener('pointerdown', (e) => {
    const p = toPicture(e);
    fingers.set(e.pointerId, p);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
    e.preventDefault();
    const it = S.items[sel];
    if (fingers.size === 2) {
      const [a, b] = [...fingers.values()];
      const base = { dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
      if (it) grab = Object.assign({ mode: 'pinch', it, nw: it.nw, rot: it.rot }, base);
      else {
        const ri = regionAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        if (ri >= 0) grab = Object.assign({ mode: 'zoom', ri, zoom: S.panels[ri].zoom }, base);
      }
      return;
    }
    if (it) {
      const h = handleAt(it);
      if (Math.hypot(p.x - h.x, p.y - h.y) <= HANDLE() * 1.6) {
        const b = itemBox(it);
        grab = { mode: 'turn', it, dist: Math.hypot(p.x - b.x, p.y - b.y),
          ang: Math.atan2(p.y - b.y, p.x - b.x), nw: it.nw, rot: it.rot };
        return;
      }
    }
    const i = hit(p);
    if (i >= 0) {
      pick(i);
      const t = S.items[i];
      grab = { mode: 'move', it: t, dx: p.x - t.nx * canvas.width, dy: p.y - t.ny * canvas.height };
      return;
    }
    pick(-1);
    const ri = regionAt(p);
    if (ri < 0) { grab = null; return; }
    if (twoUp() && ri !== panel) {
      panel = ri;
      syncControls();
    }
    const pp = S.panels[ri];
    grab = { mode: 'pan', ri, x: p.x, y: p.y, ox: pp.ox, oy: pp.oy };
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    const p = toPicture(e);
    fingers.set(e.pointerId, p);
    if (!grab) return;
    const W = canvas.width;
    const H = canvas.height;
    if (grab.mode === 'move') {
      let nx = (p.x - grab.dx) / W;
      let ny = (p.y - grab.dy) / H;
      guides = { x: Math.abs(nx - 0.5) < SNAP, y: Math.abs(ny - 0.5) < SNAP };
      if (guides.x) nx = 0.5;
      if (guides.y) ny = 0.5;
      grab.it.nx = Math.min(1.1, Math.max(-0.1, nx));
      grab.it.ny = Math.min(1.1, Math.max(-0.1, ny));
    } else if (grab.mode === 'turn') {
      const b = itemBox(grab.it);
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      grab.it.nw = Math.min(2.2, Math.max(0.03, grab.nw * dist / Math.max(1, grab.dist)));
      let rot = grab.rot + Math.atan2(p.y - b.y, p.x - b.x) - grab.ang;
      // Straight is sticky, so a level one is easy to get back to.
      const q = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
      if (Math.abs(rot - q) < 0.05) rot = q;
      grab.it.rot = rot;
    } else if ((grab.mode === 'pinch' || grab.mode === 'zoom') && fingers.size >= 2) {
      const [a, b] = [...fingers.values()];
      const k = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, grab.dist);
      if (grab.mode === 'pinch') {
        grab.it.nw = Math.min(2.2, Math.max(0.03, grab.nw * k));
        grab.it.rot = grab.rot + Math.atan2(b.y - a.y, b.x - a.x) - grab.ang;
      } else {
        const pp = S.panels[grab.ri];
        pp.zoom = Math.min(3, Math.max(1, grab.zoom * k));
        clamp(pp, F.regions[grab.ri]);
        if (grab.ri === panel) zoomIn.value = pp.zoom;
      }
    } else if (grab.mode === 'pan') {
      const r = F.regions[grab.ri];
      const pp = S.panels[grab.ri];
      pp.ox = grab.ox + (p.x - grab.x) / r.w;
      pp.oy = grab.oy + (p.y - grab.y) / r.h;
      clamp(pp, r);
    }
    redraw();
  });
  function letGo(e) {
    fingers.delete(e.pointerId);
    if (fingers.size === 0) {
      if (grab) commit();
      grab = null;
      if (guides) { guides = null; redraw(); }
    } else if (grab && (grab.mode === 'pinch' || grab.mode === 'zoom')) {
      commit();
      grab = null;
    }
  }
  canvas.addEventListener('pointerup', letGo);
  canvas.addEventListener('pointercancel', letGo);
  // A wheel sizes a picked thing, or zooms the picture under it.
  let wheelTimer = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const k = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    const it = S.items[sel];
    if (it) it.nw = Math.min(2.2, Math.max(0.03, it.nw * k));
    else {
      const ri = regionAt(toPicture(e));
      if (ri < 0) return;
      const pp = S.panels[ri];
      pp.zoom = Math.min(3, Math.max(1, pp.zoom * k));
      clamp(pp, F.regions[ri]);
      if (ri === panel) zoomIn.value = pp.zoom;
    }
    redraw();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(commit, 300);
  }, { passive: false });

  // ---- Out ----
  const NAME = 'boozebag-meme.png';
  const dl = $('meme-download');
  dl.addEventListener('click', () => {
    finished().then((blob) => {
      if (!blob) { say('That did not save. Try again.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash(dl, 'Saved', 'Download');
    });
  });
  // Handing a picture to another app is a phone thing, and only some of
  // them. The button is only there where it works.
  const shareBtn = $('meme-share');
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], NAME, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) shareBtn.hidden = false;
  } catch (e) { /* no sharing here */ }
  shareBtn.addEventListener('click', () => {
    finished().then((blob) => {
      if (!blob) return;
      const file = new File([blob], NAME, { type: 'image/png' });
      navigator.share({ files: [file], text: '$BOOZEBAG boozebag.us' }).catch(() => { /* closed */ });
    });
  });
  const copyBtn = $('meme-copy');
  if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write && shareBtn.hidden) {
    copyBtn.hidden = false;
  }
  copyBtn.addEventListener('click', () => {
    // Handed a promise rather than the finished picture, which is what
    // Safari needs to keep treating it as a press.
    const item = new window.ClipboardItem({ 'image/png': finished() });
    navigator.clipboard.write([item]).then(
      () => flash(copyBtn, 'Copied', 'Copy image'),
      () => say('This browser would not copy a picture. Download it instead.'),
    );
  });
  // X will not take a picture through a link, so this opens the post with
  // the words and the site, and says to attach the one just saved.
  const post = $('meme-post');
  post.href = 'https://x.com/intent/post?text='
    + encodeURIComponent('Made this on boozebag.us $BOOZEBAG')
    + '&url=' + encodeURIComponent('https://boozebag.us/meme.html');
  post.addEventListener('click', () => say('Save it first, then add the picture to the post.'));

  // ---- Starting over ----
  function startFresh() {
    S = fresh();
    panel = 0;
    sel = -1;
  }
  $('meme-reset').addEventListener('click', () => {
    startFresh();
    syncControls();
    showSel();
    say('');
    redraw();
    commit();
    remember(true);
  });

  // ---- First picture ----
  // Whatever was being made last time, or a fresh one.
  startFresh();
  last = JSON.stringify(S);
  recall().then(() => {
    syncControls();
    showSel();
    buttons();
    redraw();
  });
  if (document.fonts && document.fonts.load) {
    document.fonts.load('80px Anton').then(redraw, () => {});
    document.fonts.load('800 40px Inter').then(redraw, () => {});
    if (document.fonts.ready) document.fonts.ready.then(redraw, () => {});
  }
  // Everything the sticker tray shows, fetched while nothing else is going
  // on, so the first tap on one is instant.
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
  idle(() => STICKERS.forEach((a) => load(a.src).catch(() => {})));
}());
