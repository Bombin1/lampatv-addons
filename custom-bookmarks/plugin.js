(function () {
  'use strict';

  const STORAGE_KEY = 'favorite';

  // ===== Утиліти =====
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
    Lampa.Storage.set(STORAGE_KEY, obj);
    if (Lampa.Favorite && typeof Lampa.Favorite.init === 'function') Lampa.Favorite.init();
  }

  function createType(name) {
    const fav = getFavorite();
    if (!name || name === 'card' || name === 'any') {
      Lampa.Noty.show('⚠️ Некоректне ім’я');
      return null;
    }
    if (fav.customTypes[name]) {
      Lampa.Noty.show('⚠️ Категорія вже існує');
      return null;
    }
    const uid = Lampa.Utils.uid(8).toLowerCase();
    fav.customTypes[name] = uid;
    fav[uid] = [];
    saveFavorite(fav);
    return { name, uid, counter: 0 };
  }

  function renameType(oldName, newName) {
    const fav = getFavorite();
    const uid = fav.customTypes[oldName];
    if (!uid) return false;
    if (fav.customTypes[newName]) return false;
    fav.customTypes[newName] = uid;
    delete fav.customTypes[oldName];
    saveFavorite(fav);
    return true;
  }

  function removeType(name) {
    const fav = getFavorite();
    const uid = fav.customTypes[name];
    if (!uid) return false;
    delete fav.customTypes[name];
    delete fav[uid];
    saveFavorite(fav);
    return true;
  }

  function toggleCard(typeName, cardData) {
    const fav = getFavorite();
    const uid = fav.customTypes[typeName];
    if (!uid) { Lampa.Noty.show('⚠️ Категорія не знайдена'); return null; }

    const id = cardData && (cardData.id ?? cardData.tmdb_id);
    if (!id) { Lampa.Noty.show('⚠️ Некоректні дані картки'); return null; }

    fav[uid] = Array.isArray(fav[uid]) ? fav[uid] : [];
    fav.card = Array.isArray(fav.card) ? fav.card : [];

    const bucket = fav[uid];
    const idx = bucket.indexOf(id);

    if (idx === -1) {
      bucket.push(id);
      const existsIdx = fav.card.findIndex(c => (c && (c.id ?? c.tmdb_id)) === id);
      if (existsIdx >= 0) fav.card[existsIdx] = cardData;
      else fav.card.push(cardData);
      saveFavorite(fav);
      Lampa.Noty.show('✅ Додано в ' + typeName);
    } else {
      bucket.splice(idx, 1);
      fav.card = fav.card.filter(c => (c && (c.id ?? c.tmdb_id)) !== id);
      saveFavorite(fav);
      Lampa.Noty.show('⚠️ Видалено з ' + typeName);
    }
    return { name: typeName, uid, counter: bucket.length };
  }

  // ===== Кнопка у картці =====
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;
    const act = Lampa.Activity.active();
    if (!act || !act.activity || typeof act.activity.render !== 'function') return;

    const render = act.activity.render();
    const bookBtn = render.find('.button--book');
    if (!bookBtn.length) return;

    bookBtn.off('hover:enter.custom-bookmarks').on('hover:enter.custom-bookmarks', function () {
      const fav = getFavorite();
      const types = Object.keys(fav.customTypes || {}).filter(x => x !== 'card' && x !== 'any');
      const data = act.card || act.data || e.data || {};

      if (!data || !data.id) {
        Lampa.Noty.show('⚠️ Не вдалося отримати дані картки');
        console.log('Card data debug:', data);
        return;
      }

      const items = [{ title: ' + Створити категорію', _create: true }].concat(
        types.map(name => {
          const list = fav[fav.customTypes[name]] || [];
          const checked = list.indexOf(data.id) >= 0;
          return { title: name, _name: name, checkbox: true, checked };
        })
      );

      Lampa.Select.show({
        title: 'Власні закладки',
        items,
        onSelect: function (choice) {
          if (choice._create) {
            Lampa.Input.edit({ title: 'Назва категорії', value: '', free: true, nosave: true }, function (newName) {
              const created = createType(newName);
              if (created) toggleCard(newName, data);
            });
          } else if (choice._name) {
            toggleCard(choice._name, data);
          }
        },
        onBack: function () {
          Lampa.Controller.toggle('content');
        }
      });
    });
  });

  // ===== Категорії у меню «Закладки» =====
  function renderCategoryRegister() {
    const act = Lampa.Activity.active();
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
    Object.keys(fav.customTypes || {}).filter(x => x !== 'card' && x !== 'any').forEach(function (name) {
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

  Lampa.Storage.listener && Lampa.Storage.listener.follow && Lampa.Storage.listener.follow('change', function (ev
