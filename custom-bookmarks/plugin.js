(function () {
  'use strict';

  // Ключ у Storage: 'favorite' з customTypes (як у my_bookmarks)
  const STORAGE_KEY = 'favorite';

  // ===== Дані і утиліти =====
  function getFavorite() {
    const fav = Lampa.Storage.get(STORAGE_KEY, {}) || {};
    fav.card = fav.card || [];           // список усіх карток (об’єкти, які Lampa кешує)
    fav.customTypes = fav.customTypes || {};  // map { name -> uid }
    return fav;
  }

  function saveFavorite(obj) {
    Lampa.Storage.set(STORAGE_KEY, obj);
    Lampa.Favorite.init();
  }

  function getTypeList(name) {
    const fav = getFavorite();
    const uid = fav.customTypes[name];
    if (!uid) return [];
    return fav[uid] || [];
  }

  function hasTypeId(fav, typeIdCandidate) {
    const types = fav.customTypes;
    for (const k in types) {
      if (Object.prototype.hasOwnProperty.call(types, k) && types[k] === typeIdCandidate) return true;
    }
    return false;
  }

  function getTypesWithoutSystem(fav) {
    return Object.keys(fav.customTypes || {}).filter(x => x !== 'card');
  }

  function createType(name) {
    const fav = getFavorite();
    if (fav.customTypes[name]) {
      const err = new Error('custom.fav.name-used');
      err.code = 'exception';
      throw err;
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
    if (!uid) {
      const err = new Error('custom.fav.not-defined');
      err.code = 'exception';
      throw err;
    }
    if (fav.customTypes[newName]) {
      const err = new Error('custom.fav.name-used');
      err.code = 'exception';
      throw err;
    }
    fav.customTypes[newName] = uid;
    delete fav.customTypes[oldName];
    saveFavorite(fav);
    return true;
  }

  function removeType(name) {
    const fav = getFavorite();
    const uid = fav.customTypes[name];
    if (!uid) {
      const err = new Error('custom.fav.not-defined');
      err.code = 'exception';
      throw err;
    }
    delete fav.customTypes[name];
    delete fav[uid];
    saveFavorite(fav);
    return true;
  }

  function toggleCard(typeName, cardData) {
    const fav = getFavorite();
    const uid = fav.customTypes[typeName];
    if (!uid) {
      const err = new Error('custom.fav.not-defined');
      err.code = 'exception';
      throw err;
    }
    const bucket = fav[uid] || [];
    fav[uid] = bucket;

    const master = fav.customTypes.card || fav.card; // “системний” список карток
    const idxInBucket = bucket.indexOf(cardData.id);

    if (idxInBucket === -1) {
      // додати
      // прибрати дубль із master за потреби, додати cardData та id у bucket
      const filtered = (fav.customTypes.card ? fav.customTypes.card : master).filter(x => x.id !== cardData.id);
      Lampa.Arrays.insert(filtered, 0, cardData);
      Lampa.Arrays.insert(bucket, 0, cardData.id);
      // синхронізуємо fav.card
      fav.card = filtered;
      // нотифікація (не обов’язково)
      Lampa.Favorite.listener.send('add', { card: cardData, where: typeName, typeId: uid });
    } else {
      // видалити
      Lampa.Arrays.remove(bucket, cardData.id);
      // якщо картка ніде не використовується — заберемо з fav.card
      const stillUsed = Object.keys(fav.customTypes)
        .filter(k => k !== 'card' && k !== 'any')
        .some(k => (fav[fav.customTypes[k]] || []).indexOf(cardData.id) >= 0);
      if (!stillUsed) {
        fav.card = fav.card.filter(x => x.id !== cardData.id);
        Lampa.Favorite.listener.send('remove', { card: cardData, method: 'card', where: typeName, typeId: uid });
      } else {
        Lampa.Favorite.listener.send('remove', { card: cardData, method: 'id', where: typeName, typeId: uid });
      }
    }

    saveFavorite(fav);
    return { name: typeName, uid, counter: bucket.length };
  }

  // ===== Інтеграція в UI =====

  // Локалізація (мінімум)
  Lampa.Lang.add({
    rename: { en: 'Rename', uk: 'Змінити ім’я', ru: 'Изменить имя' },
    invalid_name: { en: 'Invalid name', uk: 'Некоректне ім’я', ru: 'Некорректное имя' }
  });

  // Стилі для іконки у картці (зірка)
  const starSvg = '<svg width="24" height="23" viewBox="0 0 24 23" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.6162 7.10981L15.8464 7.55198L16.3381 7.63428L22.2841 8.62965C22.8678 8.72736 23.0999 9.44167 22.6851 9.86381L18.4598 14.1641L18.1104 14.5196L18.184 15.0127L19.0748 20.9752C19.1622 21.5606 18.5546 22.002 18.025 21.738L12.6295 19.0483L12.1833 18.8259L11.7372 19.0483L6.34171 21.738C5.81206 22.002 5.20443 21.5606 5.29187 20.9752L6.18264 15.0127L6.25629 14.5196L5.9069 14.1641L1.68155 9.86381C1.26677 9.44167 1.49886 8.72736 2.08255 8.62965L8.02855 7.63428L8.52022 7.55198L8.75043 7.10981L11.5345 1.76241C11.8078 1.23748 12.5589 1.23748 12.8322 1.76241L15.6162 7.10981Z" stroke="currentColor" stroke-width="2.2"></path></svg>';
  Lampa.Template.add('custom-fav-icon-svg', starSvg);
  Lampa.Template.add('custom-fav-icon', '<div class="card__icon icon--star">' + starSvg + '</div>');

  // Рисуємо зірку у картці, якщо елемент у будь-якій кастомній категорії
  function refreshBookmarkIcon() {
    const activity = Lampa.Activity.active();
    if (!activity || activity.name !== 'full') return;
    const data = activity.data;
    const cards = (getFavorite().card || []).map(c => c.id);
    const iconHost = $('.card__icons-inner', activity.activity.render());
    const icon = $('.icon--star', iconHost);
    const exists = cards.indexOf(data.id) >= 0;

    if (exists) {
      if (!icon.length) iconHost.append(Lampa.Template.get('custom-fav-icon'));
      else icon.removeClass('hidden');
    } else {
      if (icon.length) icon.addClass('hidden');
    }
  }

  // При відкритті full: слухаємо подію і прив’язуємося до стандартної кнопки “книжка”
  Lampa.Listener.follow('full', function (e) {
    if (e.type !== 'complite') return;
    const act = Lampa.Activity.active();
    refreshBookmarkIcon();

    const bookBtn = $('.button--book', act.activity.render());
    if (!bookBtn.length) return;

    bookBtn.off('hover:enter.custom-bookmarks').on('hover:enter.custom-bookmarks', function () {
      const fav = getFavorite();
      const types = getTypesWithoutSystem(fav);
      const data = act.data;

      // селектбокс: створити нову або додати/зняти у наявній
      const items = [{ title: ' + Створити категорію', _create: true }].concat(
        types.map(name => {
          const list = getTypeList(name);
          const checked = list.indexOf(data.id) >= 0;
          return { title: name, _name: name, checkbox: true, checked };
        })
      );

      Lampa.Select.show({
        title: 'Власні закладки',
        items,
        onSelect: function (choice) {
          if (choice._create) {
            Lampa.Input.edit({ title: Lampa.Lang.translate('filter_set_name'), value: '', free: true, nosave: true }, function (newName) {
              if (!newName || newName === 'card') {
                Lampa.Noty.show(Lampa.Lang.translate('invalid_name'));
                return;
              }
              try {
                const created = createType(newName);
                Lampa.Noty.show('Категорію створено');
                // одразу додамо поточну картку в нову категорію
                toggleCard(newName, data);
              } catch (err) {
                Lampa.Noty.show('Помилка: ' + (err.code || err.message));
              }
            });
          } else if (choice._name) {
            const res = toggleCard(choice._name, data);
            Lampa.Noty.show(res ? 'Оновлено' : 'Помилка');
            refreshBookmarkIcon();
          }
        },
        onBack: function () {
          Lampa.Controller.toggle('content');
        }
      });
    });
  });

  // Додаємо “панель категорій” у екрані Закладки (bookmarks)
  function renderCategoryRegister() {
    const active = Lampa.Activity.active();
    if (!active || active.name !== 'bookmarks') return;

    // Кнопка “Створити категорію”
    const reg = Lampa.Template.js('register').addClass('new-custom-type');
    reg.find('.register__counter').html('<img src="./img/icons/add.svg"/>');
    $('.register:first').before(reg);

    // Обробник створення
    reg.on('hover:enter', function () {
      Lampa.Input.edit({ title: Lampa.Lang.translate('filter_set_name'), value: '', free: true, nosave: true }, function (newName) {
        if (!newName || newName === 'card') {
          Lampa.Controller.toggle('content');
          Lampa.Noty.show(Lampa.Lang.translate('invalid_name'));
          return;
        }
        try {
          const created = createType(newName);
          drawTypeChip(created);
        } finally {
          Lampa.Controller.toggle('content');
        }
      });
    });

    // Вивести всі категорії (чіпи з лічильниками)
    const fav = getFavorite();
    getTypesWithoutSystem(fav).reverse().forEach(function (name) {
      const uid = fav.customTypes[name];
      const counter = (fav[uid] || []).length;
      drawTypeChip({ name, uid, counter });
    });
  }

  // Намалювати один чіп категорії з меню (перейменувати/видалити)
  function drawTypeChip(info) {
    const chip = Lampa.Template.js('register')
      .addClass('custom-type')
      .addClass('custom-type-' + info.uid);
    chip.find('.register__name').text(info.name).addClass('custom-type-' + info.uid);
    chip.find('.register__counter').text(info.counter || 0).addClass('custom-type-' + info.uid);

    const activityRender = Lampa.Activity.active().activity.render();

    chip.on('hover:long', function () {
      const items = [
        { title: Lampa.Lang.translate('rename'), action: 'rename' },
        { title: Lampa.Lang.translate('settings_remove'), action: 'remove' }
      ];
      const back = Lampa.Controller.last();

      Lampa.Select.show({
        title: Lampa.Lang.translate('title_action'),
        items,
        onBack: function () {
          Lampa.Controller.toggle(back);
          Lampa.Controller.toggle('content');
        },
        onSelect: function (choice) {
          switch (choice.action) {
            case 'remove':
              try {
                removeType(info.name);
                chip.remove();
                Lampa.Controller.toggle(back);
                Lampa.Controller.toggle('content');
              } finally {
                break;
              }
            case 'rename':
              Lampa.Input.edit({ title: Lampa.Lang.translate('filter_set_name'), value: info.name, free: true, nosave: true }, function (newName) {
                if (!newName || newName === 'card' || newName === info.name) {
                  Lampa.Controller.toggle('content');
                  Lampa.Noty.show(Lampa.Lang.translate('invalid_name'));
                  return;
                }
                try {
                  renameType(info.name, newName);
                  chip.find('.register__name').text(newName);
                  info.name = newName;
                } finally {
                  Lampa.Controller.toggle(back);
                  Lampa.Controller.scroll(activityRender).update(chip, activityRender);
                }
              });
              break;
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

    $('.register:first', activityRender).after(chip);
    return chip;
  }

  // Рендеримо “лінії” категорій у bookmarks (секції типу Movies/TV)
  function renderLines() {
    const act = Lampa.Activity.active();
    const view = act && act.view && act.view.render && act.view.render();
    if (!act || act.name !== 'bookmarks' || !view) return;

    const fav = getFavorite();
    const types = getTypesWithoutSystem(fav).reverse();
    const mediaKinds = ['movies', 'tv'];

    types.forEach(function (name) {
      const uid = fav.customTypes[name];
      const ids = fav[uid] || [];
      const cards = fav.card.filter(c => ids.indexOf(c.id) !== -1);
      const limited = Lampa.Arrays.clone(cards.slice(0, 14));
      let insertIndex = 0;

      mediaKinds.forEach(function (kind) {
        const filtered = Lampa.Utils.filterCardsByType(cards, kind);
        if (filtered.length) {
          Lampa.Arrays.insert(limited, insertIndex, {
            results: filtered,
            media: kind,
            params: {},
            cardClass: function CustomBookmarksFolder() {
              // форми-конструктори для “папок” можна опустити для простоти
              return Lampa.Template.get('card', { title: name, results: filtered });
            }
          });
          insertIndex++;
        }
      });

      const section = limited.slice(0, 14);
      section.forEach(x => (x.init = false));
      if (section.length) {
        act.view.render().append({ title: name, results: section, type: uid });
      }
    });
  }

  // Слухаємо зміну активності — коли відкривають Закладки, рендеримо панель і лінії
  Lampa.Storage.listener.follow('change', function (ev) {
    if (ev.name !== 'activity') return;
    const act = Lampa.Activity.active();
    if (act && act.name === 'bookmarks') {
      if ($('.new-custom-type').length) return;
      renderCategoryRegister();
      renderLines();
      act.view.toggle();
    }
  });

  // Запуск
  function start() {
    // Вставляємо стилі для іконки зірки
    $('<style>').prop('type', 'text/css').html(
      '.card__icon { position: relative; } ' +
      '.icon--star svg { position: absolute; height: 60%; width: 60%; top: 50%; left: 50%; transform: translate(-50%, -50%) }'
    ).appendTo('head');
  }

  if (window.appready) start();
  else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
})();
