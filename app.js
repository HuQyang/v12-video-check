import {items, study} from './items.js';

// One generated video per item, judged blind (no model name, no automatic result). Four questions plus defect tags.
const QUESTIONS = [
  {key: 'camera', title: '镜头实际怎么动？', hint: '看近处和远处是否相对移动、遮挡是否变化。',
   options: [['static', '几乎不动'], ['turn', '原地转动（摇镜，近远处一起平移）'], ['zoom', '只是放大或缩小（像变焦，没有视差）'],
             ['parallax', '真的在移动（近处比远处动得快）'], ['unsure', '说不准']]},
  {key: 'follows', title: '运镜和提示词相符吗？',
   options: [['yes', '相符'], ['partial', '部分相符（方向对但幅度不对等）'], ['no', '不相符'], ['unsure', '说不准']]},
  {key: 'defect', title: '画面有没有明显问题？', hint: '形变、凭空出现、剪辑、闪烁、内容跑题等。',
   options: [['none', '没有'], ['mild', '轻微'], ['obvious', '明显'], ['severe', '严重（不能用）'], ['unsure', '说不准']]},
  {key: 'usable', title: '能当一次静态场景的拍摄用吗？',
   options: [['yes', '能'], ['mostly', '大体能，有局部问题'], ['no', '不能'], ['unsure', '说不准']]},
];
const TAGS = [['cut', '中途剪辑或画面跳变'], ['appear', '物体凭空出现或消失'], ['morph', '物体变形或不刚性'],
              ['drift', '物体或背景漂移'], ['flicker', '闪烁或光照突变'], ['offtopic', '内容和提示词不符（如画出三脚架）'],
              ['blur', '模糊或细节很差'], ['noise', '噪声或损坏'], ['other', '其他（写在备注）']];
const STORE = `video-check:${study}`, CURSOR = `video-check:${study}:cursor`;

const $ = id => document.getElementById(id);
let labels = {}, cursor = 0, active = 0, startedAt = Date.now(), rate = 1;
try { labels = JSON.parse(localStorage.getItem(STORE)) || {}; } catch { labels = {}; }
const done = it => { const l = labels[it.id]; return !!l && QUESTIONS.every(q => l[q.key]); };
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(labels)); } catch {} };

function buildForm() {
  const form = $('form');
  form.replaceChildren(...QUESTIONS.map((q, i) => {
    const fs = document.createElement('fieldset'); fs.dataset.key = q.key;
    const lg = document.createElement('legend'); lg.textContent = `${i + 1}. ${q.title}`;
    if (q.hint) { const s = document.createElement('small'); s.textContent = ' ' + q.hint; lg.append(s); }
    fs.append(lg);
    q.options.forEach(([v, text], j) => {
      const l = document.createElement('label'), r = document.createElement('input'), k = document.createElement('kbd');
      l.className = 'opt'; r.type = 'radio'; r.name = q.key; r.value = v; k.textContent = j + 1;
      r.onchange = () => { capture(); setActive(Math.min(i + 1, QUESTIONS.length - 1)); };
      l.append(r, k, document.createTextNode(text)); fs.append(l);
    });
    fs.onclick = () => setActive(i);
    return fs;
  }));
  const tf = document.createElement('fieldset'), tl = document.createElement('legend'), grid = document.createElement('div');
  tl.textContent = '问题类型（可多选，可不选）'; grid.className = 'tags';
  for (const [v, text] of TAGS) {
    const l = document.createElement('label'), c = document.createElement('input');
    l.className = 'opt'; c.type = 'checkbox'; c.name = 'tag'; c.value = v; c.onchange = capture;
    l.append(c, document.createTextNode(text)); grid.append(l);
  }
  tf.append(tl, grid);
  const note = document.createElement('textarea'); note.id = 'note'; note.placeholder = '备注（可选），例如：第 3 秒杯子变形';
  note.oninput = capture;
  form.append(tf, note);
}

function setActive(i) {
  active = i;
  document.querySelectorAll('fieldset[data-key]').forEach((f, n) => f.classList.toggle('active', n === i));
}

function capture() {
  const it = items[cursor], prev = labels[it.id] || {};
  const a = {...prev, tags: [...document.querySelectorAll('input[name=tag]:checked')].map(c => c.value),
             note: $('note').value, saved_at: new Date().toISOString(),
             seconds: (prev.seconds || 0) + Math.round((Date.now() - startedAt) / 1000)};
  for (const q of QUESTIONS) a[q.key] = document.querySelector(`input[name=${q.key}]:checked`)?.value || '';
  labels[it.id] = a; startedAt = Date.now(); persist(); renderList();
  $('saved').textContent = done(it) ? '已保存 ✓' : '草稿已保存';
}

function render() {
  const it = items[cursor], l = labels[it.id] || {};
  $('clip-title').textContent = `${it.id}  (${cursor + 1} / ${items.length})`;
  $('prompt').textContent = it.prompt;
  const v = $('video'); v.src = it.src; v.playbackRate = rate; v.play().catch(() => {});
  for (const q of QUESTIONS) document.querySelectorAll(`input[name=${q.key}]`).forEach(r => { r.checked = r.value === l[q.key]; });
  document.querySelectorAll('input[name=tag]').forEach(c => { c.checked = (l.tags || []).includes(c.value); });
  $('note').value = l.note || '';
  document.querySelectorAll('fieldset').forEach(f => f.classList.remove('missing'));
  setActive(Math.max(0, QUESTIONS.findIndex(q => !l[q.key])));
  $('saved').textContent = done(it) ? '已保存 ✓' : ''; $('status').textContent = '';
  $('back').disabled = cursor === 0;
  startedAt = Date.now(); renderList();
}

function renderList() {
  const n = items.filter(done).length;
  $('progress-text').textContent = `已完成 ${n} / ${items.length}`;
  $('bar').style.width = `${(100 * n / items.length).toFixed(1)}%`;
  $('list').replaceChildren(...items.map((it, i) => {
    const b = document.createElement('button'), s = document.createElement('span');
    b.className = (i === cursor ? 'current ' : '') + (done(it) ? 'done' : '');
    s.className = 's'; s.textContent = done(it) ? '✓' : '';
    b.append(document.createTextNode(it.id), s); b.onclick = () => go(i);
    return b;
  }));
}

function go(i) {
  cursor = Math.max(0, Math.min(items.length - 1, i));
  try { localStorage.setItem(CURSOR, cursor); } catch {}
  render();
}

$('save').onclick = () => {
  capture();
  const it = items[cursor], missing = QUESTIONS.filter(q => !labels[it.id][q.key]);
  if (!rater()) { $('status').textContent = '请先在顶部填写标注者名字。'; $('rater').focus(); return; }
  if (missing.length) {
    $('status').textContent = '还有题没答。';
    document.querySelectorAll('fieldset[data-key]').forEach(f => f.classList.toggle('missing', missing.some(q => q.key === f.dataset.key)));
    return;
  }
  go(cursor + 1);
};
$('back').onclick = () => go(cursor - 1);

const rater = () => $('rater').value.trim();
try { $('rater').value = localStorage.getItem('video-check:rater') || ''; } catch {}
$('rater').oninput = () => { try { localStorage.setItem('video-check:rater', rater()); } catch {} };

const video = $('video');
const step = d => { video.pause(); video.currentTime = Math.max(0, video.currentTime + d / items[cursor].fps); };
video.addEventListener('timeupdate', () => {
  const fps = items[cursor].fps;
  $('time').textContent = `帧 ${Math.floor(video.currentTime * fps) + 1} / ${Math.round((video.duration || 0) * fps)}`;
});
['play', 'pause'].forEach(e => video.addEventListener(e, () => { $('play').textContent = video.paused ? '播放' : '暂停'; }));
$('play').onclick = () => (video.paused ? video.play() : video.pause());
$('prev-frame').onclick = () => step(-1);
$('next-frame').onclick = () => step(1);
$('replay').onclick = () => { video.currentTime = 0; video.play(); };
function setRate(r) {
  rate = r; video.playbackRate = r;
  document.querySelectorAll('.speed button').forEach(b => b.classList.toggle('on', +b.dataset.rate === r));
}
document.querySelectorAll('.speed button').forEach(b => { b.onclick = () => setRate(+b.dataset.rate); });

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && e.target.type === 'text')) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); go(cursor - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(cursor + 1); }
  else if (e.key === ' ') { e.preventDefault(); $('play').click(); }
  else if (e.key === ',') step(-1);
  else if (e.key === '.') step(1);
  else {
    const n = Number(e.key) - 1, q = QUESTIONS[active];
    if (Number.isInteger(n) && n >= 0 && n < q.options.length) {
      document.querySelector(`input[name=${q.key}][value=${q.options[n][0]}]`).click();
    }
  }
});

$('export').onclick = () => {
  const data = {study, rater: rater(), exported_at: new Date().toISOString(), complete: items.every(done),
                questions: QUESTIONS, tags: TAGS,
                labels: items.map(it => ({item: it.id, prompt: it.prompt, ...(labels[it.id] || {})}))};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'}));
  a.download = `${study}_labels_${rater() || 'unnamed'}.json`; a.click();
};

buildForm(); setRate(1);
let saved = 0;
try { saved = +localStorage.getItem(CURSOR) || 0; } catch {}
go(Number.isFinite(saved) ? saved : items.findIndex(it => !done(it)));
