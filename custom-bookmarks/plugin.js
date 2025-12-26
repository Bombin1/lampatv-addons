(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    function getFolders() {
        try {
            var data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveFolders(folders) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
        if (window.Lampa.Cloud && window.Lampa.Cloud.is() && window.Lampa.Account.logged()) {
            window.Lampa.Cloud.set(STORAGE_KEY, folders);
            if (window.Lampa.Cloud.sync) window.Lampa.Cloud.sync();
        }
    }

    // СТИЛІ: Фіксуємо проблему накладання через display: block
    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .bookmarks-folders-row { display: block; width: 100%; padding: 10px 15px; position: relative; clear: both; box-sizing: border-box; } \
            .folders-list-inner { display: flex; flex-wrap: wrap; gap: 10px; } \
            .folder-tile { \
                background-color: rgba(0, 0, 0, 0.3) !important; \
                width: 100px; height: 70px; border-radius: 8px; \
                display: flex; flex-direction: column; justify-content: center; align-items: center; \
                cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.1); \
                box-sizing: border-box; \
            } \
            .folder-tile.focus { background-color: #fff !important; border: 1px solid #fff; transform: scale(1.05); z-index: 10; } \
            .folder-tile__name { font-size: 0.8em; color: #fff; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 90%; } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__icon { font-size: 1.4em; margin-bottom: 2px; } \
            /* Забороняємо стандартному списку накладатись */ \
            .category-full, .bookmarks-list { position: relative !important; top: 0 !important; margin-top: 10px; } \
        </style>');
    }

    // Компонент перегляду папки
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        this.create = function () {
            this.activity.loader(false);
            (object.items || []).forEach(function (data) {
                var card = new Lampa.Card(data, { card_category: true, is_static: true });
                card.create();
                card.onFocus = function (target) { scroll.update(card.render()); };
                card.onEnter = function () { Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' }); };
                body.append(card.render()); items.push(card);
            });
            scroll.append(body); html.append(scroll.render());
        };
        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render()); Lampa.Controller.collectionFocus(items[0] ? items[0].render() : null); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.render = function () { return html; };
        this.destroy = function () { items.forEach(function (item) { item.destroy(); }); scroll.destroy(); html.remove(); };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var view = originalRender.call(comp);
                    var folders = getFolders();
                    
                    // Шукаємо правильний контейнер всередині скролу
                    var body = view.find('.category-full, .bookmarks-list, .scroll__content').first();
                    
                    if (body.length) {
                        var row = $('<div class="bookmarks-folders-row"><div class="folders-list-inner"></div></div>');
                        var list = row.find('.folders-list-inner');

                        // Функція створення кнопки
                        var createTile = function(title, icon, action, longAction) {
                            var tile = $('<div class="folder-tile selector" tabindex="0"><div class="folder-tile__icon">'+icon+'</div><div class="folder-tile__name">'+title+'</div></div>');
                            // Використовуємо універсальний обробник для ТБ
                            tile.on('click', action);
                            if (longAction) tile.on('hover:long', longAction);
                            return tile;
                        };

                        // Кнопка Створити
                        list.append(createTile('Створити', '+', function() {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders(); f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        }));

                        // Папки
                        folders.forEach(function(f, i) {
                            list.append(createTile(f.name + ' ('+f.list.length+')', '📁', function() {
                                Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
                            }, function() {
                                Lampa.Select.show({
                                    title: f.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: function() {
                                        var fList = getFolders(); fList.splice(i, 1);
                                        saveFolders(fList); Lampa.Activity.replace();
                                    }
                                });
                            }));
                        });

                        body.prepend(row);
                    }

                    // Оновлюємо контролер
                    var originalStart = comp.start;
                    comp.start = function() {
                        originalStart.call(comp);
                        // Повторна реєстрація селекторів для пульта
                        Lampa.Controller.collectionSet(view);
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню вибору (додавання)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFavMenu = params && params.items && params.items.some(function(i) { return i.id === 'wath' || i.id === 'book' || i.id === 'like'; });
        if (isFavMenu || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;
            if (folders.length > 0 && movie) {
                params.items = params.items.filter(function(i) { return !i.is_custom; });
                folders.forEach(function(f, i) {
                    var exists = f.list.some(function(m) { return m.id == movie.id; });
                    params.items.unshift({ title: f.name, selected: exists, is_custom: true, f_idx: i });
                });
                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        var movieIdx = target.list.findIndex(function(m) { return m.id == movie.id; });
                        if (movieIdx > -1) target.list.splice(movieIdx, 1);
                        else target.list.push(JSON.parse(JSON.stringify(movie)));
                        saveFolders(fUpdate);
                        Lampa.Select.close();
                        setTimeout(function(){ Lampa.Select.show(params); }, 10);
                    } else if (originalOnSelect) { originalOnSelect(item); }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
