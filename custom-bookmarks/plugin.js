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
        if (window.Lampa.Cloud && window.Lampa.Account && window.Lampa.Account.logged()) {
            window.Lampa.Cloud.set(STORAGE_KEY, folders);
        }
    }

    // Стилі: 100px, 30% прозорість фокусу
    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .folders-list-wrapper { width: 100%; padding: 15px 0; margin-bottom: 10px; display: block; clear: both; } \
            .folders-list-wrapper__items { display: flex; flex-wrap: wrap; padding: 0 15px; gap: 10px; } \
            .folder-tile-item { \
                width: 100px; height: 65px; \
                background-color: rgba(255, 255, 255, 0.05) !important; \
                border-radius: 8px; border: 2px solid transparent; \
                display: flex; flex-direction: column; justify-content: center; align-items: center; \
                cursor: pointer; box-sizing: border-box; \
            } \
            .folder-tile-item.focus { \
                background-color: rgba(255, 255, 255, 0.3) !important; \
                border-color: #fff; transform: scale(1.05); \
            } \
            .folder-tile-item__name { font-size: 11px; color: #fff; text-align: center; margin-top: 3px; overflow: hidden; white-space: nowrap; width: 90%; } \
            .folder-tile-item__icon { font-size: 16px; } \
        </style>');
    }

    // Компонент перегляду вмісту папки
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
                    
                    // ГАРАНТІЯ ОДНОРАЗОВОСТІ: додаємо лише якщо ще немає на сторінці
                    if (view.find('.folders-list-wrapper').length) return view;

                    var folders = getFolders();
                    var container = view.find('.scroll__content');

                    if (container.length) {
                        var wrapper = $('<div class="folders-list-wrapper"><div class="folders-list-wrapper__items"></div></div>');
                        var list = wrapper.find('.folders-list-wrapper__items');

                        var addTile = function(title, icon, action, long) {
                            var tile = $('<div class="folder-tile-item selector" tabindex="0"><div class="folder-tile-item__icon">'+icon+'</div><div class="folder-tile-item__name">'+title+'</div></div>');
                            tile.on('hover:enter', action);
                            if (long) tile.on('hover:long', long);
                            list.append(tile);
                        };

                        addTile('Створити', '+', function() {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders(); f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });

                        folders.forEach(function(f, i) {
                            addTile(f.name, '📁', function() {
                                Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
                            }, function() {
                                Lampa.Select.show({
                                    title: f.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: function() {
                                        var fl = getFolders(); fl.splice(i, 1);
                                        saveFolders(fl); Lampa.Activity.replace();
                                    }
                                });
                            });
                        });

                        container.prepend(wrapper);
                    }

                    // БЕЗПЕЧНА НАВІГАЦІЯ
                    var originalStart = comp.start;
                    comp.start = function() {
                        // Оновлюємо список елементів для пульта
                        Lampa.Controller.collectionSet(view);
                        // Запускаємо стандартний старт Lampa
                        originalStart.call(comp);
                        
                        // Якщо ми на початку сторінки - фокусуємось на папках
                        var first = view.find('.folder-tile-item').first()[0];
                        if (first) Lampa.Controller.collectionFocus(first);
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню вибору (додавання в папки)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFav = params && params.items && params.items.some(function(i) { return i.id === 'wath' || i.id === 'book' || i.id === 'like'; });
        if (isFav || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;
            if (folders.length > 0 && movie) {
                params.items = params.items.filter(function(i) { return !i.is_custom; });
                folders.forEach(function(f, i) {
                    var exists = (f.list || []).some(function(m) { return m.id == movie.id; });
                    params.items.unshift({ title: f.name, selected: exists, is_custom: true, f_idx: i });
                });
                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpd = getFolders();
                        var target = fUpd[item.f_idx];
                        var mIdx = target.list.findIndex(function(m) { return m.id == movie.id; });
                        if (mIdx > -1) target.list.splice(mIdx, 1);
                        else target.list.push(JSON.parse(JSON.stringify(movie)));
                        saveFolders(fUpd);
                        Lampa.Select.close();
                        setTimeout(function(){ Lampa.Select.show(params); }, 10);
                    } else if (originalOnSelect) { originalOnSelect(item); }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
