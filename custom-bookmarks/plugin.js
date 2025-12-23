(function () {
  'use strict';

  const STORAGE_KEY = 'favorite';

  // ===== Логування (вкл/викл) =====
  const LOG = true;
  function log() {
    if (LOG) try { console.log('[CustomBookmarks]', ...arguments); } catch (_) {}
  }

  // ===== Утиліти =====
  function getFavorite() {
    let fav = Lampa.Storage.get(STORAGE_KEY, {});
    if (typeof fav === 'string') {
      try { fav = JSON.parse(fav); } catch (e) { log('parse favorite failed', e); fav = {}; }
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
      log('favorite saved', obj);
    } catch (e) {
      log('save favorite failed', e);
      Lampa.Noty && Lampa.Noty.show && Lampa.Noty.show('Помилка збереження закладки');
    }
  }

  function getTypesWithoutSystem(fav) {
    return Object.keys(fav.customTypes || {}).filter(x => x !== 'card' && x !== 'any');
  }

  function createType(name) {
    try {
      const fav = getFavorite();
      if (!name || typeof name !== 'string') { Lampa.Noty.show('⚠️ Порожнє ім’я'); return null; }
      name = name.trim();
      if (!name || name === 'card' || name === 'any') { Lampa.Noty.show('⚠️ Некоректне ім’я'); return null; }
      if (fav.customTypes[name]) { Lampa.Noty.show('⚠️ Категорія вже існує'); return null; }

      const uid = (Lampa.Utils && typeof Lampa.Utils.uid === 'function') ? Lampa.Utils.uid(8).toLowerCase() : String(Date.now());
      fav.customTypes[name] = uid;
      fav[uid] = [];
      saveFavorite(fav);
      log('type created', name, uid);
      return { name, uid, counter: 0 };
    } catch (e) {
      log('createType error', e);
      Lampa.Noty.show('Помилка створення категорії');
      return null;
    }
  }

  function renameType(oldName, newName) {
    try {
      const fav = getFavorite();
      const uid = fav.customTypes[oldName];
      if (!uid) return false;
      newName = (newName || '').trim();
      if (!newName || fav.customTypes[newName] || newName === 'card' || newName === 'any') return false;
      fav.customTypes[newName] = uid;
      delete fav.customTypes[oldName];
      saveFavorite(fav);
      log('type renamed', oldName, '->', newName);
      return true;
    } catch (e) { log('renameType error', e); return false; }
  }

  function removeType(name) {
    try {
      const fav = getFavorite();
      const uid = fav.customTypes[name];
      if (!uid) return false;
      delete fav.customTypes[name];
      delete fav[uid];
      saveFavorite(fav);
      log('type removed', name);
      return true;
    } catch (e) { log('removeType error', e); return false; }
  }

  function toggleCard(typeName, cardData) {
    try {
      const fav = getFavorite();
      const uid = fav.customTypes[typeName];
      if (!uid) { Lampa.Noty.show('⚠️ Категорія не знайдена'); return null; }

      // нормалізуємо cardData
      const id = cardData && (cardData.id ?? cardData.ids ?? cardData.tmdb_id);
      if (!id) { Lampa.Noty.show('⚠️ Некоректні дані картки'); return null; }

      fav[uid] = Array.isArray(fav[uid]) ? fav[uid] : [];
      fav.card = Array.isArray(fav.card) ? fav.card : [];

      const bucket = fav[uid];
      const idx = bucket.indexOf(id);

      if (idx === -1) {
        bucket.push(id);
        // додамо або оновимо card у fav.card (без дублів)
        const existsIdx = fav.card.findIndex(c => (c && (c.id ?? c.ids ?? c.tmdb_id)) === id);
        const minimal = {
          id,
          title: cardData.title || cardData.name || '',
          name: cardData.name || '',
          url: cardData.url || '',
          poster: cardData.poster || cardData.poster_path || '',
          release_date: cardData.release_date || cardData.first_air_date || '',
          vote_average: cardData.vote_average || 0,
          source: cardData.source || ''
        };
        if (existsIdx >= 0) fav.card[existsIdx] = Object.assign({}, fav.card[existsIdx], minimal);
        else fav.card.push(minimal);

        Lampa.Noty.show('✅ Додано в ' + typeName);
      } else {
        bucket.splice(idx, 1);
        fav.card = fav.card.filter(c => (c && (c.id ?? c.ids ?? c.tmdb_id)) !== id);
        Lampa.Noty.show('⚠️ Видалено з ' + typeName);
      }

      saveFavorite(fav);
      log('toggleCard', typeName, id, 'count:', bucket.length);
      return { name: typeName, uid, counter: bucket.length };
    } catch (e) {
      log('toggleCard error', e);
      Lampa.Noty.show('Помилка додавання в закладки');
      return null;
    }
  }

  // ===== Кнопка у картці (підключення до стандартної .button--book) =====
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;

    let act;
    try { act = Lampa.Activity.active(); } catch (_) { act = null; }
    if (!act || !act.activity || typeof act.activity.render !== 'function') { log('no activity render'); return; }

    const render = act.activity.render();
    if (!render || !render.find) { log('render invalid'); return; }

    const bookBtn = render.find('.button--book');
    if (!bookBtn.length) { log('book button not found'); return; }

    bookBtn.off('hover:enter.custom-bookmarks').on('hover:enter.custom-bookmarks', function () {
      try {
        const fav = getFavorite();
        const types = getTypesWithoutSystem(fav);
        const data = act.data || e.data || Lampa.Activity.active()?.card || {};
        if (!data || (!data.id && !data.ids && !data.tmdb_id)) {
          Lampa.Noty.show('⚠️ Немає даних картки');
          log('no card data', data);
          return;
        }

        const items = [{ title: ' + Створити категорію', _create: true }].concat(
          types.map(name => {
            const list = fav[fav.customTypes[name]] || [];
            const id = data.id ?? data.ids ?? data.tmdb_id;
            const checked = list.indexOf(id) >= 0;
            return { title: name, _name: name, checkbox: true, checked };
          })
        );

        Lampa.Select.show({
          title: 'Власні закладки',
          items,
          onSelect: function (choice) {
            try {
              if (choice._create) {
                Lampa.Input.edit({ title: 'Назва категорії', value: '', free: true, nosave: true }, function (newName) {
                  const created = createType(newName);
                  if (created) toggleCard(newName, data);
                });
              } else if (choice._name) {
                toggleCard(choice._name, data);
              }
            } catch (err) { log('onSelect error', err); Lampa.Noty.show('Помилка вибору'); }
          },
          onBack: function () {
            try { Lampa.Controller.toggle('content'); } catch (_) {}
          }
        });
      } catch (err) {
        log('handler error', err);
        Lampa.Noty.show('Помилка відкриття меню закладок');
      }
    });
  });

  // ===== Категорії у меню «Закладки» =====
  function renderCategoryRegister() {
    let act;
    try { act = Lampa.Activity.active(); } catch (_) { act = null; }
    if (!act || act.name !== 'bookmarks' || !act.activity || typeof act.activity.render !== 'function') return;

    const container = act.activity.render();
    const fav = getFavorite();

    // Кнопка створення
    const reg = Lampa.Template.js('register').addClass('new-custom-type');
    reg.find('.register__counter').html('<img src="./img/icons/add.svg"/>');
    container.find('.register:first').before(reg);

    reg.on('hover:enter', function () {
      Lampa.Input.edit({ title: 'Назва категорії', value: '', free: true, nosave: true }, function (newName) {
        const created = createType(newName);
        if (created) drawTypeChip(created, container);
      });
    });

    // Вивести всі категорії
    getTypesWithoutSystem(fav).forEach(function (name) {
      const uid = fav.customTypes[name];
      const counter = (fav[uid] || []).length;
      drawTypeChip({ name, uid, counter }, container);
    });
  }

  function drawTypeChip(info, container) {
    const chip = Lampa.Template.js('register')
      .addClass('custom-type')
      .addClass('custom-type-' + info.uid);
    chip.find('.register__name').text(info.name);
    chip.find('.register__counter').text(info.counter || 0);

    chip.on('hover:long', function () {
      const items = [
        { title: 'Перейменувати', action: 'rename' },
        { title: 'Видалити', action: 'remove' }
      ];
      Lampa.Select.show({
        title: 'Дії',
        items,
        onSelect: function (choice) {
          if (choice.action === 'remove') {
            if (removeType(info.name)) chip.remove();
          } else if (choice.action === 'rename') {
            Lampa.Input.edit({ title: 'Нове ім’я', value: info.name, free: true, nosave: true }, function (newName) {
              if (renameType(info.name, newName)) chip.find('.register__name').text(newName);
            });
          }
        }
      });
    });

    chip.on('hover:enter', function () {
      Lampa.Activity.push({
        url: '',
        component: 'favorite',
        title: info.name,
        type: info.uid,
        page: 1
      });
    });

    container.find('.register:first').after(chip);
  }

  // Слухаємо зміну активності
  Lampa.Storage.listener.follow('change', function (ev) {
    if (ev.name !== 'activity') return;
    let act;
    try { act = Lampa.Activity.active(); } catch (_) { act = null; }
    if (act && act.name === 'bookmarks') {
      if ($('.new-custom-type').length) return;
      renderCategoryRegister();
      try { act.view && typeof act.view.toggle === 'function' && act.view.toggle(); } catch (_) {}
    }
  });

  // Запуск
  function start() {
    try {
      $('<style>').prop('type', 'text/css').html(
        '.card__icon { position: relative; } ' +
        '.icon--star svg { position: absolute; height: 60%; width: 60%; top: 50%; left: 50%; transform: translate(-50%, -50%) }'
      ).appendTo('head');
      log('plugin started');
    } catch (e) { log('start error', e); }
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
