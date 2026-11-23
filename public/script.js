'use strict';

/* ===== Допоміжні ===== */
const $ = (sel) => document.querySelector(sel);
const fmtPrice = (n) => '$' + Number(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const placeholder = (label) => 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="#cfd9ee"/><stop offset="1" stop-color="#e9eef8"/></linearGradient></defs>
     <rect width="320" height="200" fill="url(#g)"/>
     <text x="160" y="105" font-size="60" text-anchor="middle">🚗</text>
     <text x="160" y="150" font-size="16" text-anchor="middle" fill="#5b6785" font-family="Arial">${String(label).replace(/[<&>"']/g, '')}</text>
   </svg>`
);

/* ===== Клієнт API ===== */
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch {
    const e = new Error(location.protocol === 'file:'
      ? 'Сторінку відкрито як файл. Запустіть сервер (npm start) і відкрийте http://localhost:3000'
      : 'Немає зв’язку з сервером.');
    e.network = true;
    throw e;
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Помилка сервера (${res.status})`);
    e.status = res.status;
    e.fields = data?.error?.fields || {};
    throw e;
  }
  return data;
}

const CarsAPI = {
  list:   (q, sort) => api(`/cars?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}`),
  create: (car)     => api('/cars', { method: 'POST', body: JSON.stringify(car) }),
  remove: (id)      => api(`/cars/${id}`, { method: 'DELETE' }),
  stats:  ()        => api('/stats'),
  reset:  ()        => api('/reset', { method: 'POST' })
};

/* ===== Елементи ===== */
const grid = $('#grid');
const emptyMsg = $('#empty');
const statusBox = $('#status');
const form = $('#carForm');
const formError = $('#formError');
const searchInput = $('#search');
const sortSelect = $('#sort');

/* ===== Статус завантаження / помилка ===== */
function setStatus(text, isError = false, withRetry = false) {
  statusBox.className = 'status' + (isError ? ' status--error' : '') + (text ? '' : ' hidden');
  statusBox.innerHTML = text
    ? `<span>${esc(text)}</span>${withRetry ? '<button class="btn btn--ghost" id="retryBtn" type="button">Спробувати ще</button>' : ''}`
    : '';
  const retry = $('#retryBtn');
  if (retry) retry.addEventListener('click', refresh);
}

/* ===== Відображення ===== */
function renderCars(items) {
  grid.innerHTML = items.map((c) => `
    <article class="car" data-id="${c.id}">
      <div class="car__img">
        <img src="${esc(c.image || placeholder(c.brand + ' ' + c.model))}"
             alt="${esc(c.brand + ' ' + c.model)}" loading="lazy"
             onerror="this.onerror=null;this.src='${placeholder(c.brand + ' ' + c.model).replace(/'/g, '%27')}'">
        <span class="car__badge">${esc(c.year)}</span>
      </div>
      <div class="car__body">
        <h3 class="car__title">${esc(c.brand)} ${esc(c.model)}</h3>
        <div class="car__price">${fmtPrice(c.price)}</div>
        <div class="car__tags">
          ${c.mileage != null ? `<span class="tag">${esc(c.mileage)} тис. км</span>` : ''}
          <span class="tag">${esc(c.fuel)}</span>
          <span class="tag">${esc(c.gearbox)}</span>
        </div>
        <p class="car__desc">${c.desc ? esc(c.desc) : ''}</p>
        <button class="car__del" data-del="${c.id}" type="button">🗑 Видалити</button>
      </div>
    </article>
  `).join('');
  emptyMsg.classList.toggle('hidden', items.length > 0);
}

function renderStats(s) {
  $('#stats').innerHTML = `
    <div class="stat"><b>${s.total}</b><span>авто в наявності</span></div>
    <div class="stat"><b>${s.total ? fmtPrice(s.avgPrice) : '—'}</b><span>середня ціна</span></div>
    <div class="stat"><b>${s.total ? fmtPrice(s.minPrice) : '—'}</b><span>найдешевше</span></div>
    <div class="stat"><b>${s.total ? fmtPrice(s.totalValue) : '—'}</b><span>загальна вартість</span></div>
  `;
}

/* ===== Завантаження даних із API ===== */
let requestCounter = 0;

async function refresh() {
  const myRequest = ++requestCounter; // щоб старі відповіді не перезаписали нові
  setStatus('Завантаження…');
  try {
    const [list, stats] = await Promise.all([
      CarsAPI.list(searchInput.value.trim(), sortSelect.value),
      CarsAPI.stats()
    ]);
    if (myRequest !== requestCounter) return;
    renderCars(list.items);
    renderStats(stats);
    setStatus('');
  } catch (err) {
    if (myRequest !== requestCounter) return;
    setStatus(err.message, true, true);
  }
}

/* ===== Додавання ===== */
let uploadedImage = '';

$('#imageFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  uploadedImage = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { setFormError('Оберіть файл-зображення.'); e.target.value = ''; return; }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      uploadedImage = canvas.toDataURL('image/jpeg', 0.75);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function setFormError(msg) { formError.textContent = msg; }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormError('');
  form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

  const data = new FormData(form);
  const payload = {
    brand: data.get('brand'),
    model: data.get('model'),
    year: data.get('year'),
    price: data.get('price'),
    mileage: data.get('mileage'),
    fuel: data.get('fuel'),
    gearbox: data.get('gearbox'),
    image: uploadedImage || data.get('imageUrl'),
    desc: data.get('desc')
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const car = await CarsAPI.create(payload); // сервер сам валідує дані
    form.reset();
    uploadedImage = '';
    searchInput.value = '';
    sortSelect.value = 'new';
    await refresh();
    toast(`Додано: ${car.brand} ${car.model}`);
  } catch (err) {
    setFormError(err.message);
    Object.keys(err.fields || {}).forEach((f) => {
      const input = form.elements[f] || $('#' + f);
      if (input) input.classList.add('invalid');
    });
    const first = Object.keys(err.fields || {})[0];
    if (first && form.elements[first]) form.elements[first].focus();
  } finally {
    submitBtn.disabled = false;
  }
});

/* ===== Видалення ===== */
grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;

  const id = Number(btn.dataset.del);
  const title = btn.closest('.car').querySelector('.car__title').textContent;
  if (!confirm(`Видалити ${title}?`)) return;

  btn.disabled = true;
  try {
    await CarsAPI.remove(id);
    const card = btn.closest('.car');
    card.classList.add('removing');
    await new Promise((r) => setTimeout(r, 230));
    await refresh();
    toast(`Видалено: ${title}`);
  } catch (err) {
    btn.disabled = false;
    toast(err.status === 404 ? 'Це авто вже видалено.' : err.message);
    if (err.status === 404) refresh();
  }
});

/* ===== Пошук, сортування, скидання ===== */
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 250); // debounce — менше запитів
});
sortSelect.addEventListener('change', refresh);

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Повернути початковий список авто? Ваші зміни буде втрачено.')) return;
  try {
    await CarsAPI.reset();
    searchInput.value = '';
    sortSelect.value = 'new';
    await refresh();
    toast('Список скинуто');
  } catch (err) {
    toast(err.message);
  }
});

/* ===== Повідомлення ===== */
let toastTimer;
function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/* ===== Старт ===== */
$('#yr').textContent = new Date().getFullYear();
refresh();
