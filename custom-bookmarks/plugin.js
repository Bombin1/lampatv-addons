(function () {
  'use strict';

  const STORAGE_KEY = 'favorite';
  const DEFAULT_TYPE_NAME = 'Мої закладки';

  // ===== Утиліти з захистом =====
  function getFavorite() {
    let fav = Lampa.Storage.get(STORAGE_KEY, {});
    if (typeof fav === 'string') {
      try { fav = JSON.parse(fav); } catch (_) { fav = {}; }
    }
    if (!fav || typeof fav !== 'object') fav = {};
    fav.card = Array.isArray(fav.card) ? fav.card : [];
    fav.customTypes = fav.customTypes || {};
    return fav;
  }

  function saveFavorite(obj) {
    try {
      Lampa.Storage.set(STORAGE_KEY, obj);
      if (Lampa.Favorite && typeof Lampa.Favorite.init === 'function') Lampa.Favorite.init();
    } catch (_) {}
  }

  function ensureDefaultType() {
    const fav = getFavorite();
    if (!fav.customTypes[DEFAULT_TYPE_NAME]) {
      const uid = (Lampa.Utils && typeof Lampa.Utils.uid === 'function') ? Lampa.Utils.uid(8).toLowerCase() : String(Date.now());
      fav.customTypes[DEFAULT_TYPE_NAME] = uid;
      fav[uid] = [];
      saveFavorite(fav);
    }
    return { fav: getFavorite(), uid: getFavorite().customTypes[DEFAULT_TYPE_NAME] };
  }

  function extractCardData(e) {
    const act = Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;
    const data = (act && act.data) || (e && e.data) || (act && act.card) || (act && act.activity && act.activity.data) || {};
    const id = data.id ?? data.ids ?? data.tmdb_id;
    if (!id) return null;

    // мінімально потрібні поля
    return {
      id,
      title: data.title || data.name || '',
      name: data.name || '',
      url: data.url || '',
      poster: data.poster || data.poster_path || '',
      release_date: data.release_date || data.first_air_date || '',
      vote_average: data.vote_average || 0,
      source: data.source || ''
    };
  }

  function isInBucket(fav, uid, id) {
    const bucket = Array.isArray(fav[uid]) ? fav[uid] : [];
    return bucket.indexOf(id) >= 0;
  }

  function addToDefault(card) {
    const { fav, uid } = ensureDefaultType();
    fav[uid] = Array.isArray(fav[uid]) ? fav[uid] : [];
    fav.card = Array.isArray(fav.card) ? fav.card : [];

    if (!isInBucket(fav, uid, card.id)) {
      fav[uid].push(card.id);
      const idx = fav.card.findIndex(c => (c && (c.id ?? c.ids ?? c.tmdb_id)) === card.id);
      if (idx >= 0) fav.card[idx] = Object.assign({}, fav.card[idx], card);
      else fav.card.push(card);
      saveFavorite(fav);
      Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('✅ Додано в «' + DEFAULT_TYPE_NAME + '»');
    } else {
      Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('⚠️ Вже у «' + DEFAULT_TYPE_NAME + '»');
    }
  }

  function removeFromDefault(card) {
    const { fav, uid } = ensureDefaultType();
    fav[uid] = Array.isArray(fav[uid]) ? fav[uid] : [];
    fav.card = Array.isArray(fav.card) ? fav.card : [];

    const i = fav[uid].indexOf(card.id);
    if (i >= 0) {
      fav[uid].splice(i, 1);
      // прибираємо картку, якщо вона не використовується у жодній іншій кастомній категорії
      const stillUsed = Object.keys(fav.customTypes)
        .filter(name => name !== DEFAULT_TYPE_NAME && name !== 'card' && name !== 'any')
        .some(name => {
          const otherUid = fav.customTypes[name];
          const arr = Array.isArray(fav[otherUid]) ? fav[otherUid] : [];
          return arr.indexOf(card.id) >= 0;
        });
      if (!stillUsed) {
        fav.card = fav.card.filter(c => (c && (c.id ?? c.ids ?? c.tmdb_id)) !== card.id);
      }
      saveFavorite(fav);
      Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('🗑️ Видалено з «' + DEFAULT_TYPE_NAME + '»');
    } else {
      Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('ℹ️ Не знайдено у «' + DEFAULT_TYPE_NAME + '»');
    }
  }

  // ===== Інтеграція у картку: одна кнопка, одне натискання =====
  Lampa.Listener.follow('full', function (e) {
    if (!e || e.type !== 'complite') return;

    const act = Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;
    if (!act || !act.activity || typeof act.activity.render !== 'function') return;

    const render = act.activity.render();
    const bookBtn = render.find('.button--book');
    if (!bookBtn.length) return;

    // Вимкнути попередні обробники, додати наш
    bookBtn.off('hover:enter.custom-bookmarks').on('hover:enter.custom-bookmarks', function () {
      try {
        const card = extractCardData(e);
        if (!card || !card.id) {
          Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('⚠️ Не вдалося отримати дані картки');
          return;
        }
        const { fav, uid } = ensureDefaultType();
        const inList = isInBucket(fav, uid, card.id);

        if (inList) removeFromDefault(card);
        else addToDefault(card);
      } catch (_) {
        Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('Помилка обробки закладки');
      }
    });
  });

  // ===== Відображення у «Закладках»: чіп + перехід у дефолтну категорію =====
  function drawDefaultTypeChip() {
    const act = Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;
    if (!act || act.name !== 'bookmarks' || !act.activity || typeof act.activity.render !== 'function') return;

    const container = act.activity.render();
    if (container.find('.custom-type-default').length) return;

    const { fav, uid } = ensureDefaultType();
    const counter = (Array.isArray(fav[uid]) ? fav[uid] : []).length;

    const chip = Lampa.Template.js('register')
      .addClass('custom-type-default');
    chip.find('.register__name').text(DEFAULT_TYPE_NAME);
    chip.find('.register__counter').text(counter);

    chip.on('hover:enter', function () {
      Lampa.Activity.push({
        url: '',
        component: 'favorite',
        title: DEFAULT_TYPE_NAME,
        type: uid,
        page: 1
      });
    });

    // Додати кнопку «створити» не будемо — safe mode тримає одну категорію
    container.find('.register:first').after(chip);
  }

  // Слухати відкриття «Закладок»
  Lampa.Storage.listener && Lampa.Storage.listener.follow && Lampa.Storage.listener.follow('change', function (ev) {
    if (ev.name !== 'activity') return;
    drawDefaultTypeChip();
  });

  // Запуск стилів (мінімально)
  function start() {
    try {
      $('<style>').prop('type', 'text/css').html(
        '.custom-type-default .register__name{font-weight:600}'
      ).appendTo('head');
    } catch (_) {}
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
