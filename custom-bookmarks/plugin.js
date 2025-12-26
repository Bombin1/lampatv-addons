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
        }
    }

    // СТИЛІ: 100px ширина, 30% прозорість
    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .custom-folders-row { position: relative; padding: 10px 0; background: rgba(0,0,0,0.1); width: 100%; display: block; } \
            .custom-folders-scroll { display: flex; flex-direction: row; padding: 0 15px; gap: 10px; overflow: hidden; } \
            .folder-tile { \
                flex: 0 0 100px; \
                width: 100px; height: 65px; \
                background-color: rgba(255, 255, 255, 0.05) !important; \
                border-radius: 8px; border: 2px solid transparent; \
                display: flex; flex-direction: column; justify-content: center; align-items: center; \
                cursor: pointer; box-sizing: border-box; transition: all 0.2s; \
            } \
            .folder-tile.focus { \
                border-color: #fff; \
                background-color: rgba(255, 255, 255, 0.3) !important; \
                transform: scale(1.05); \
            } \
            .folder-tile__name { font-size: 12px; color: #fff; text-align: center; margin-top: 4px; overflow: hidden; white-space: nowrap; width: 90%; } \
            .folder-tile__icon { font-size: 18px; } \
            /* Фікс для того, щоб фільми не ховалися під папки */ \
            .category-full, .bookmarks-list { margin-top: 10px !important; position: relative !important; } \
        </style>');
    }

    // Компонент вмісту папки
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
            Lampa.Controller.add('custom_folder_items', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render()); Lampa.Controller.collectionFocus(items[0] ? items[0].render() : null); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('custom_folder_items');
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
                    var foldersRow = $('<div class="custom-folders-row"><div class="custom-folders-scroll"></div></div>');
                    var list = foldersRow.find('.custom-folders-scroll');

                    // Кнопка Створити
                    var createBtn = $('<div class="folder-tile selector" tabindex="0"><div class="folder-tile__icon">+</div><div class="folder-tile__name">Створити</div></div>');
                    createBtn.on('hover:enter', function() {
                        Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                            if (name) {
                                var f = getFolders(); f.push({ name: name, list: [] });
                                saveFolders(f); Lampa.Activity.replace();
                            }
                        });
                    });
                    list.append(createBtn);

                    // Папки
                    folders.forEach(function(f, i) {
                        var tile = $('<div class="folder-tile selector" tabindex="0"><div class="folder-tile__icon">📁</div><div class="folder-tile__name">'+f.name+'</div></div>');
                        tile.on('hover:enter', function() {
                            Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
                        });
                        tile.on('hover:long', function() {
                            Lampa.Select.show({
                                title: f.name,
                                items: [{ title: 'Видалити папку' }],
                                onSelect: function() {
                                    var fList = getFolders(); fList.splice(i, 1);
                                    saveFolders(fList); Lampa.Activity.replace();
                                }
                            });
                        });
                        list.append(tile);
                    });

                    // Вставляємо строку папок перед основним контентом
                    view.find('.scroll__content, .category-full').first().before(foldersRow);

                    // --- ФІКС НАВІГАЦІЇ ---
                    var originalStart = comp.start;
                    comp.start = function() {
                        // Реєструємо наш контролер
                        Lampa.Controller.add('bookmarks_with_folders', {
                            toggle: function() {
                                Lampa.Controller.collectionSet(view);
                                // При старті завжди фокусуємось на папках (перший селектор у view)
                                Lampa.Controller.collectionFocus(view.find('.folder-tile').first()[0]);
                            },
                            up: function() { Lampa.Controller.toggle('head'); },
                            left: function() { Lampa.Controller.toggle('menu'); },
                            down: function() {
                                // ШУКАЄМО ФІЛЬМИ: Переходимо в стандартний контролер Lampa
                                var contentSelectors = view.find('.category-full .selector, .bookmarks-list .selector');
                                if (contentSelectors.length) {
                                    // Якщо фільми є, віддаємо керування стандартній логіці
                                    originalStart.call(comp); 
                                }
                            },
                            back: function() { Lampa.Activity.backward(); }
                        });
                        Lampa.Controller.toggle('bookmarks_with_folders');
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню вибору при додаванні (без змін)
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
