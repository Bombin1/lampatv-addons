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
    fav.card = fav.card || [];
    fav.customTypes = fav.customTypes || {};
    return fav;
  }

  function saveFavorite(obj) {
    Lampa.Storage.set(STORAGE_KEY, obj);
    Lampa.Favorite.init();
  }

  function getTypesWithoutSystem(fav) {
    return Object.keys(fav.customTypes || {}).filter(x => x !== 'card' && x !== 'any');
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
    if (!uid) return null;
    const bucket = fav[uid] || [];
    fav[uid] = bucket;

    const idx = bucket.indexOf(cardData.id);
    if (idx === -1) {
      bucket.push(cardData.id);
      fav.card.push(cardData);
      Lampa.Noty.show('✅ Додано в ' + typeName);
    } else {
      bucket.splice(idx, 1);
      fav.card = fav.card.filter(c => c.id !== cardData.id);
      Lampa.Noty.show('⚠️ Видалено з ' + typeName);
    }
    saveFavorite(fav);
    return { name: typeName, uid, counter: bucket.length };
  }

  // ===== Кнопка у картці =====
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;
    const act = Lampa.Activity.active();
    if (!act) return;

    const bookBtn = $('.button--book', act.activity.render());
    if (!bookBtn.length) return;

    bookBtn.off('hover:enter.custom-bookmarks').on('hover:enter.custom-bookmarks', function () {
      const fav = getFavorite();
      const types = getTypesWithoutSystem(fav);
      const data = act.data;

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
    if (!act || act.name !== 'bookmarks') return;

    const fav = getFavorite();

    // Кнопка створення
    const reg = Lampa.Template.js('register').addClass('new-custom-type');
    reg.find('.register__counter').html('<img src="./img/icons/add.svg"/>');
    $('.register:first').before(reg);

    reg.on('hover:enter', function () {
      Lampa.Input.edit({ title: 'Назва категорії', value: '', free: true, nosave: true }, function (newName) {
        const created = createType(newName);
        if (created) drawTypeChip(created);
      });
    });

    // Вивести всі категорії
    getTypesWithoutSystem(fav).forEach(function (name) {
      const uid = fav.customTypes[name];
      const counter = (fav[uid] || []).length;
      drawTypeChip({ name, uid, counter });
    });
  }

  function drawTypeChip(info) {
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
            removeType(info.name);
            chip.remove();
          } else if (choice.action === 'rename') {
            Lampa.Input.edit({ title: 'Нове ім’я', value: info.name, free: true, nosave: true }, function (newName) {
              if (renameType(info.name, newName)) {
                chip.find('.register__name').text(newName);
              }
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

    $('.register:first', Lampa.Activity.active().activity.render()).after(chip);
  }

  // Слухаємо зміну активності
  Lampa.Storage.listener.follow('change', function (ev) {
    if (ev.name !== 'activity') return;
    const act = Lampa.Activity.active();
    if (act && act.name === 'bookmarks') {
      if ($('.new-custom-type').length) return;
      renderCategoryRegister();
      act.view.toggle();
    }
  });

  // Запуск
  function start() {
    $('<style>').prop('type', 'text/css').html(
      '.card__icon { position: relative; } ' +
      '.icon--star svg { position: absolute; height: 60%; width: 60%; top: 50%; left: 50%; transform: translate(-50%, -50%) }'
    ).appendTo('head');
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
