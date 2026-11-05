'use strict';

const DEMO = [
  {
    url: 'https://www.etsy.com/listing/demo-mom-mug',
    title: "Personalized Mom Mug Custom Name Coffee Cup Mother's Day Gift",
    points:
      "Add her name or short message\nDishwasher safe ceramic\nHeartwarming mom design\nReady gift for Mother's Day or birthday",
  },
  {
    url: 'https://www.etsy.com/listing/demo-teacher-tee',
    title: 'Custom Teacher T Shirt Personalized Name Appreciation Gift',
    points:
      'Print her name or classroom title\nSoft unisex fit\nEnd of year thank you gift\nComfortable everyday wear',
  },
  {
    url: 'https://www.etsy.com/listing/demo-doodle-mom',
    title: 'Goldendoodle Mom Personalized T Shirt Dog Lover Gift',
    points:
      'Narrow dog mom niche design\nCustom name on print\nSoft cotton blend\nBirthday or Christmas gift for doodle moms',
  },
  {
    url: 'https://www.etsy.com/listing/demo-family-canvas',
    title: 'Custom Family Photo Canvas Personalized Wall Art Gift',
    points:
      'Upload your family photo\nGallery wrapped canvas\nLiving room or hallway decor\nAnniversary or housewarming gift',
  },
  {
    url: 'https://www.etsy.com/listing/demo-dad-tumbler',
    title: 'Personalized Dad Tumbler Custom Name Insulated Cup Gift',
    points:
      'Engrave or print name or nickname\nKeeps drinks hot or cold\nFather\'s Day ready\nDurable stainless steel',
  },
];

const LS_MIRROR = 'pod-listing-copy-saves-mirror-v1';
const LS_DRAFT_MIRROR = 'pod-listing-copy-drafts-mirror-v1';

function emptySlots() {
  return Array.from({ length: 5 }, () => ({ url: '', title: '', points: '' }));
}

let slots = emptySlots();
let pack = null;
let saves = [];
let drafts = [];

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 401 && !path.includes('/login')) {
    location.href = '/login';
    throw new Error('未登录');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `请求失败 (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function renderSlots() {
  const root = $('slots');
  root.innerHTML = slots
    .map(
      (s, i) => `
    <details class="slot" ${i < 2 ? 'open' : ''}>
      <summary>Etsy 列表 ${i + 1}</summary>
      <label>链接</label>
      <input type="url" data-i="${i}" data-f="url" value="${esc(s.url)}" placeholder="https://www.etsy.com/listing/..." />
      <label>标题</label>
      <input type="text" data-i="${i}" data-f="title" value="${esc(s.title)}" placeholder="Etsy 商品标题原文" />
      <label>卖点</label>
      <textarea data-i="${i}" data-f="points" placeholder="每行一条&#10;例如：Add her name or short message&#10;Soft cotton blend&#10;Mother's Day gift">${esc(s.points)}</textarea>
    </details>`,
    )
    .join('');
  root.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', () => {
      const i = Number(el.dataset.i);
      const f = el.dataset.f;
      slots[i][f] = el.value;
      updateFilled();
    });
  });
  updateFilled();
}

function updateFilled() {
  const n = slots.filter((s) => s.url.trim() || s.title.trim() || s.points.trim()).length;
  $('filledCount').textContent = `${n}/5`;
}

function copyBtn(text, label) {
  const id = `c_${Math.random().toString(36).slice(2, 9)}`;
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已复制英文';
        setTimeout(() => {
          btn.textContent = label;
        }, 1500);
      } catch {
        btn.textContent = '复制失败';
      }
    });
  }, 0);
  return `<button type="button" class="primary" id="${id}">${esc(label)}</button>`;
}

function renderResult() {
  const card = $('resultCard');
  if (!pack) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  $('titlesOut').innerHTML = pack.titles
    .map(
      (t, i) => `
    <div style="margin-bottom:16px">
      <h3>标题 ${i + 1}${t.note ? ` · ${esc(t.note)}` : ''}</h3>
      <div class="row">${copyBtn(t.en, '一键复制英文')}</div>
      <div class="pre">${esc(t.en)}</div>
      <p class="zh">对照：${esc(t.zh || '')}</p>
    </div>`,
    )
    .join('');
  $('descOut').innerHTML = `
    <div class="row">${copyBtn(pack.descriptionEn, '一键复制五点英文')}</div>
    <div class="pre">${esc(pack.descriptionEn)}</div>
    <p class="zh">中文对照（不复制）：\n${esc(pack.descriptionZh)}</p>
  `;
}

function formatSavedAt(iso) {
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function mirrorLocal() {
  try {
    localStorage.setItem(LS_MIRROR, JSON.stringify(saves));
  } catch {
    /* ignore */
  }
}


function mirrorDraftsLocal() {
  try {
    localStorage.setItem(LS_DRAFT_MIRROR, JSON.stringify(drafts));
  } catch {
    /* ignore */
  }
}

function applyListingsToForm(listings) {
  const next = emptySlots();
  (listings || []).slice(0, 5).forEach((s, i) => {
    next[i] = {
      url: String(s.url || ''),
      title: String(s.title || ''),
      points: String(s.points || ''),
    };
  });
  slots = next;
  pack = null;
  renderSlots();
  renderResult();
  $('genErr').classList.add('hidden');
  $('saveNote').classList.add('hidden');
  $('draftNote').classList.add('hidden');
  $('genStatus').classList.add('hidden');
}

function renderDrafts() {
  $('draftCount').textContent = String(drafts.length);
  const list = $('draftList');
  if (!drafts.length) {
    $('draftHint').classList.remove('hidden');
    list.innerHTML = '';
    return;
  }
  $('draftHint').classList.add('hidden');
  list.innerHTML = drafts
    .map((item) => {
      const preview = (item.listings || [])
        .filter((s) => (s.title || '').trim() || (s.url || '').trim())
        .slice(0, 3)
        .map((s) => esc((s.title || s.url || '').trim()))
        .join(' · ');
      return `
      <details class="slot saved-item">
        <summary>${esc(item.label)} <span class="badge">${esc(formatSavedAt(item.savedAt))}</span> <span class="badge">${esc(String(item.filled || 0))}/5</span></summary>
        <p class="muted" style="margin:8px 0">${preview || '（无标题预览）'}</p>
        <div class="row" style="margin:10px 0">
          <button type="button" class="primary" data-load-draft="${esc(item.id)}">一键回填到表单</button>
          <button type="button" class="danger" data-del-draft="${esc(item.id)}">删除这条草稿</button>
        </div>
      </details>`;
    })
    .join('');
  list.querySelectorAll('[data-load-draft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-load-draft');
      const item = drafts.find((x) => x.id === id);
      if (!item) return;
      applyListingsToForm(item.listings);
      const note = $('draftNote');
      note.className = 'callout ok';
      note.textContent = `已回填草稿「${item.label}」，可继续编辑或点生成。`;
      note.classList.remove('hidden');
      window.scrollTo({ top: $('slots').offsetTop - 40, behavior: 'smooth' });
    });
  });
  list.querySelectorAll('[data-del-draft]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-draft');
      if (!confirm('确定删除这条输入草稿？')) return;
      try {
        await api(`/api/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
        drafts = drafts.filter((x) => x.id !== id);
        mirrorDraftsLocal();
        renderDrafts();
      } catch (e) {
        alert(e.message || '删除失败');
      }
    });
  });
}

async function loadDrafts() {
  const data = await api('/api/drafts');
  drafts = data.items || [];
  mirrorDraftsLocal();
  renderDrafts();
}

async function doSaveDraft() {
  const note = $('draftNote');
  const filled = slots.filter((s) => s.url.trim() || s.title.trim() || s.points.trim());
  if (!filled.length) {
    note.className = 'callout warn';
    note.textContent = '请至少填写 1 组链接、标题或卖点后再保存草稿。';
    note.classList.remove('hidden');
    return;
  }
  const firstTitle = slots.map((s) => s.title.trim()).find(Boolean) || '';
  const label = firstTitle || `输入草稿 ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
  try {
    const data = await api('/api/drafts', {
      method: 'POST',
      body: JSON.stringify({ label, listings: slots }),
    });
    drafts = [data.item, ...drafts.filter((x) => x.id !== data.item.id)];
    mirrorDraftsLocal();
    renderDrafts();
    note.className = 'callout ok';
    note.textContent = data.persistent
      ? '输入草稿已保存到服务器，下次登录可在「输入草稿库」一键回填。'
      : '输入草稿已保存（当前为内存模式，进程重启后可能丢失）。';
    note.classList.remove('hidden');
  } catch (e) {
    note.className = 'callout err';
    note.textContent = e.message || '保存草稿失败';
    note.classList.remove('hidden');
  }
}


function renderSaves() {
  $('savedCount').textContent = String(saves.length);
  const list = $('savedList');
  if (!saves.length) {
    $('savedHint').classList.remove('hidden');
    list.innerHTML = '';
    return;
  }
  $('savedHint').classList.add('hidden');
  list.innerHTML = saves
    .map((item) => {
      const titlesHtml = (item.titles || [])
        .map(
          (t, i) => `
        <details>
          <summary>标题 ${i + 1}</summary>
          <div class="row">${copyBtn(t.en, '一键复制英文')}</div>
          <div class="pre">${esc(t.en)}</div>
          <p class="zh">对照：${esc(t.zh || '')}</p>
        </details>`,
        )
        .join('');
      return `
      <details class="slot saved-item">
        <summary>${esc(item.label)} <span class="badge">${esc(formatSavedAt(item.savedAt))}</span></summary>
        <div class="row" style="margin:10px 0">
          <button type="button" class="danger" data-del="${esc(item.id)}">删除这条</button>
        </div>
        ${titlesHtml}
        <details open>
          <summary>五点描述</summary>
          <div class="row">${copyBtn(item.descriptionEn, '一键复制五点英文')}</div>
          <div class="pre">${esc(item.descriptionEn)}</div>
          <p class="zh">中文对照：\n${esc(item.descriptionZh || '')}</p>
        </details>
      </details>`;
    })
    .join('');
  list.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del');
      if (!confirm('确定删除这条保存？')) return;
      try {
        await api(`/api/saves/${encodeURIComponent(id)}`, { method: 'DELETE' });
        saves = saves.filter((x) => x.id !== id);
        mirrorLocal();
        renderSaves();
      } catch (e) {
        alert(e.message || '删除失败');
      }
    });
  });
}

async function loadMe() {
  const me = await api('/api/me');
  $('userBadge').textContent = me.username || '已登录';
  $('persistBadge').textContent = me.persistent ? '服务端持久保存' : '内存保存（重启会丢）';
}

async function loadSaves() {
  const data = await api('/api/saves');
  saves = data.items || [];
  mirrorLocal();
  renderSaves();
}

async function doGenerate() {
  const err = $('genErr');
  const status = $('genStatus');
  err.classList.add('hidden');
  status.classList.remove('hidden');
  status.className = 'callout';
  status.textContent = '正在调用模型生成…';
  $('generateBtn').disabled = true;
  $('fabGenerate').disabled = true;
  try {
    const data = await api('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ listings: slots }),
    });
    pack = data.pack;
    $('saveNote').classList.add('hidden');
    status.classList.add('hidden');
    renderResult();
    window.scrollTo({ top: $('resultCard').offsetTop - 20, behavior: 'smooth' });
  } catch (e) {
    status.classList.add('hidden');
    err.textContent = e.message || '生成失败';
    err.classList.remove('hidden');
  } finally {
    $('generateBtn').disabled = false;
    $('fabGenerate').disabled = false;
  }
}

async function doSave() {
  const note = $('saveNote');
  if (!pack) {
    note.className = 'callout warn';
    note.textContent = '请先生成，再保存。';
    note.classList.remove('hidden');
    return;
  }
  const sourceTitles = slots.map((s) => s.title.trim()).filter(Boolean);
  const label = pack.titles[0]?.en || sourceTitles[0] || '未命名文案';
  try {
    const data = await api('/api/saves', {
      method: 'POST',
      body: JSON.stringify({
        label,
        sourceTitles,
        titles: pack.titles,
        descriptionEn: pack.descriptionEn,
        descriptionZh: pack.descriptionZh,
        bulletsEn: pack.bulletsEn,
        bulletsZh: pack.bulletsZh,
      }),
    });
    saves = [data.item, ...saves.filter((x) => x.id !== data.item.id)];
    mirrorLocal();
    renderSaves();
    note.className = 'callout ok';
    note.textContent = data.persistent
      ? '已保存到服务器，可在下方「已保存」回看。'
      : '已保存（当前为内存模式，进程重启后可能丢失）。';
    note.classList.remove('hidden');
  } catch (e) {
    note.className = 'callout err';
    note.textContent = e.message || '保存失败';
    note.classList.remove('hidden');
  }
}

function loadDemo() {
  slots = DEMO.map((s) => ({ ...s }));
  renderSlots();
  pack = null;
  renderResult();
  $('genErr').classList.add('hidden');
  $('saveNote').classList.add('hidden');
  $('draftNote').classList.add('hidden');
}

function clearAll() {
  slots = emptySlots();
  pack = null;
  renderSlots();
  renderResult();
  $('genErr').classList.add('hidden');
  $('saveNote').classList.add('hidden');
  $('draftNote').classList.add('hidden');
  $('genStatus').classList.add('hidden');
}

$('generateBtn').addEventListener('click', doGenerate);
$('fabGenerate').addEventListener('click', doGenerate);
$('saveDraftBtn').addEventListener('click', doSaveDraft);
$('fabSaveDraft').addEventListener('click', doSaveDraft);
$('saveBtn').addEventListener('click', doSave);
$('fabSave').addEventListener('click', doSave);
$('demoBtn').addEventListener('click', loadDemo);
$('clearBtn').addEventListener('click', clearAll);
$('logoutBtn').addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST', body: '{}' });
  } catch {
    /* ignore */
  }
  location.href = '/login';
});

(async function init() {
  try {
    await loadMe();
    renderSlots();
    await loadDrafts();
    await loadSaves();
  } catch (e) {
    console.error(e);
  }
})();
