(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    // --- Робота з даними ---
    function getFolders() {
        try {
            var data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveFolders(folders) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
        } catch (e) {}

        try {
            if (window.Lampa.Cloud && window.Lampa.Cloud.is && window.Lampa.Cloud.is() && window.Lampa.Account && window.Lampa.Account.logged && window.Lampa.Account.logged()) {
                window.Lampa.Cloud.set(STORAGE_KEY, folders);
                if (window.Lampa.Cloud.sync) window.Lampa.Cloud.sync();
            }
        } catch (e) {}
    }

    // --- Авто-завантаження з хмари (якщо локально порожньо) ---
    setTimeout(function () {
        try {
            if (getFolders().length === 0 && window.Lampa.Cloud && window.Lampa.Cloud.is && window.Lampa.Cloud.is()) {
                window.Lampa.Cloud.get(STORAGE_KEY, function (data) {
                    if (data && data.length) {
                        try {
                            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                        } catch (e) {}
                    }
                });
            }
        } catch (e) {}
    }, 3000);

    // --- Стилі ---
    if (!document.getElementById('custom-bookmarks-styles')) {
        var style = document.createElement('style');
        style.id = 'custom-bookmarks-styles';
        style.innerHTML = '\
        .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 15px; gap: 8px; width: 100%; } \
        .folder-tile { position: relative; background-color: rgba(0,0,0,0.3)!important; width: 100px; height: 75px; border-radius: 10px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 0 10px; cursor: pointer; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.05);} \
        .folder-tile.focus { background-color: #fff!important; transform: scale(1.05); outline: none;} \
        .folder-tile__name { font-size: 1.2em; font-weight: 500; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; margin-bottom: 8px;} \
        .folder-tile.focus .folder-tile__name { color: #000;} \
        .folder-tile__count_wrap { display: flex; align-items: baseline; gap: 2px;} \
        .folder-tile__count { font-size: 2.1em; font-weight: 500; color: #fff; line-height: 1;} \
        .folder-tile__total { font-size: 0.75em; opacity: 0.4; color: #fff;} \
        .folder-tile.focus .folder-tile__count, .folder-tile.focus .folder-tile__total { color: #000;} \
        .folder-tile--create { border: 1px dashed rgba(255,255,255,0.15); align-items: center; padding: 0;} \
        .folder-tile--create .folder-tile__name { text-align: center; font-size: 1.1em; opacity: 0.7; margin: 0;} \
        .folder-actions { position: absolute; right: 6px; top: 6px; display: flex; gap: 6px; } \
        .folder-action { width: 18px; height: 18px; opacity: 0.7; }';
        document.head.appendChild(style);
    }

    // --- Компонент перегляду папки ---
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var last_focus = null;

        this.create = function () {
            this.activity.loader(false);

            if (object.items && object.items.length) {
                object.items.forEach(function (data) {
                    var card = new Lampa.Card(data, { card_category: true, is_static: true });
                    card.create();

                    card.onFocus = function (target) {
                        last_focus = target;
                        scroll.update(card.render());
                    };

                    card.onEnter = function () {
                        Lampa.Activity.push({
                            url: data.url || '',
                            component: 'full',
                            id: data.id,
                            method: data.name ? 'tv' : 'movie',
                            card: data,
                            source: data.source || 'tmdb'
                        });
                    };

                    body.append(card.render());
                    items.push(card);
                });

                scroll.append(body);
                html.append(scroll.render());
            } else {
                html.append('<div class="empty">Тут порожньо</div>');
            }
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    if (items.length) {
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last_focus || items[0].render());
                    } else {
                        Lampa.Controller.toggle('empty');
                    }
                },
                left: function () { Lampa.Controller.toggle('menu'); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return html; };

        this.destroy = function () {
            items.forEach(function (item) { if (item && item.destroy) item.destroy(); });
            scroll.destroy();
            html.remove();
        };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    // --- Інтеграція з Select (додавання у меню "Вибране") ---
    (function () {
        var originalSelectShow = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            try {
                var isFavMenu = params && params.items && params.items.some(function (i) {
                    return i.id === 'wath' || i.id === 'book' || i.id === 'like';
                });

                if (isFavMenu || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
                    var folders = getFolders();
                    var active = Lampa.Activity.active();
                    var movie = active && (active.card || active.data);

                    if (folders.length > 0 && movie) {
                        params.items = params.items.filter(function (i) { return !i.is_custom; });

                        folders.forEach(function (f, i) {
                            var exists = (f.list || []).some(function (m) { return m.id == movie.id; });
                            params.items.unshift({ title: f.name, selected: exists, is_custom: true, f_idx: i });
                        });

                        var originalOnSelect = params.onSelect;
                        params.onSelect = function (item) {
                            if (item && item.is_custom) {
                                var fUpdate = getFolders();
                                var target = fUpdate[item.f_idx];
                                if (!target) return;
                                var movieIdx = (target.list || []).findIndex(function (m) { return m.id == movie.id; });
                                if (movieIdx > -1) target.list.splice(movieIdx, 1);
                                else {
                                    target.list = target.list || [];
                                    target.list.push(JSON.parse(JSON.stringify(movie)));
                                }
                                saveFolders(fUpdate);
                                Lampa.Select.close();
                                setTimeout(function () { Lampa.Select.show(params); }, 10);
                            } else if (originalOnSelect) {
                                originalOnSelect(item);
                            }
                        };
                    }
                }
            } catch (e) {}
            originalSelectShow.call(Lampa.Select, params);
        };
    })();

    // --- Інтеграція та фікс пульта у компоненті bookmarks ---
    Lampa.Listener.follow('app', function (e) {
        if (e && e.type === 'ready') {
            try {
                var originalBookmarks = Lampa.Component.get('bookmarks');
                if (!originalBookmarks) return;

                Lampa.Component.add('bookmarks', function (object) {
                    var comp = new originalBookmarks(object);
                    var originalRender = comp.render;

                    comp.render = function () {
                        var view = originalRender.call(comp);
                        try {
                            var folders = getFolders();
                            var container = view.find('.category-full, .bookmarks-list, .scroll__content').first();

                            if (container && container.length) {
                                var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');

                                // Кнопка створити
                                var createBtn = $('<div class="folder-tile folder-tile--create selector" data-name="folder" data-index="-1"><div class="folder-tile__name">Створити</div></div>');
                                createBtn.on('hover:enter', function () {
                                    Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                        if (name) {
                                            var f = getFolders();
                                            f.push({ name: name, list: [] });
                                            saveFolders(f);
                                            Lampa.Activity.replace();
                                        }
                                    });
                                });
                                wrapper.append(createBtn);

                                // Плитки папок
                                folders.forEach(function (folder, i) {
                                    var safeName = Lampa.Utils && Lampa.Utils.htmlEncode ? Lampa.Utils.htmlEncode(folder.name) : (folder.name || '');
                                    var count = (folder.list && folder.list.length) ? folder.list.length : 0;

                                    var tile = $(
                                        '<div class="folder-tile selector" data-name="folder" data-index="' + i + '">' +
                                            '<div class="folder-tile__name">' + safeName + '</div>' +
                                            '<div class="folder-tile__count_wrap">' +
                                                '<span class="folder-tile__count">' + count + '</span>' +
                                                '<span class="folder-tile__total">шт.</span>' +
                                            '</div>' +
                                        '</div>'
                                    );

                                    // відкриття папки
                                    tile.on('hover:enter', function () {
                                        Lampa.Activity.push({
                                            component: 'custom_folder_component',
                                            id: 'custom_folder_' + i,
                                            items: folder.list || [],
                                            title: folder.name
                                        });
                                    });

                                    // контекстне меню: відкрити / перейменувати / видалити
                                    tile.on('hover:long', function () {
                                        Lampa.Select.show({
                                            title: folder.name,
                                            items: [
                                                { title: 'Відкрити', id: 'open' },
                                                { title: 'Перейменувати', id: 'rename' },
                                                { title: 'Видалити', id: 'delete' }
                                            ],
                                            onSelect: function (item) {
                                                if (!item) return;
                                                if (item.id === 'open') {
                                                    tile.trigger('hover:enter');
                                                } else if (item.id === 'rename') {
                                                    Lampa.Input.edit({ value: folder.name, title: 'Нова назва' }, function (name) {
                                                        if (name) {
                                                            var f = getFolders();
                                                            if (f[i]) {
                                                                f[i].name = name;
                                                                saveFolders(f);
                                                                Lampa.Activity.replace();
                                                            }
                                                        }
                                                    });
                                                } else if (item.id === 'delete') {
                                                    var f = getFolders();
                                                    f.splice(i, 1);
                                                    saveFolders(f);
                                                    Lampa.Activity.replace();
                                                }
                                            }
                                        });
                                    });

                                    wrapper.append(tile);
                                });

                                // Вставляємо wrapper у контейнер
                                container.prepend(wrapper);

                                // --- Додано: реєстрація контролера для пульта ---
                                try {
                                    Lampa.Controller.add('folders', {
                                        toggle: function () {
                                            Lampa.Controller.collectionSet(wrapper, wrapper.find('.selector'));
                                            var first = wrapper.find('.selector').eq(0);
                                            Lampa.Controller.collectionFocus(first.length ? first : wrapper.find('.selector').eq(0), wrapper);
                                        },
                                        left: function () { Lampa.Navigator.move('left'); },
                                        right: function () { Lampa.Navigator.move('right'); },
                                        up: function () { Lampa.Navigator.move('up'); },
                                        down: function () { Lampa.Navigator.move('down'); },
                                        back: function () { Lampa.Controller.toggle('content'); }
                                    });

                                    // Якщо зараз активна сторінка bookmarks — переключаємося на наш контролер
                                    var active = Lampa.Activity.active();
                                    if (active && active.component === 'bookmarks') {
                                        Lampa.Controller.toggle('folders');
                                    }
                                } catch (e) {
                                    // Controller або Navigator можуть бути відсутні — ігноруємо помилку
                                }
                            }
                        } catch (e) {}
                        return view;
                    };

                    return comp;
                });
            } catch (e) {}
        }
    });

})();
