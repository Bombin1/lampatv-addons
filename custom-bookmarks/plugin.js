(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    // --- 1. РОБОТА З ДАНИМИ ---
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

    // --- 2. СТИЛІ (ШИРИНА 100px, ПРОЗОРІСТЬ 30%) ---
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 15px; gap: 10px; width: 100%; box-sizing: border-box; } \
            .folder-tile { \
                position: relative; \
                background-color: rgba(0, 0, 0, 0.3) !important; \
                width: 100px; height: 75px; border-radius: 10px; \
                display: flex; flex-direction: column; justify-content: center; align-items: flex-start; \
                padding: 0 10px; cursor: pointer; transition: all 0.2s ease; \
                border: 1px solid rgba(255, 255, 255, 0.05); \
                box-sizing: border-box; \
            } \
            .folder-tile.focus { background-color: #fff !important; transform: scale(1.05); outline: none; border: 1px solid #fff; z-index: 10; } \
            .folder-tile__name { font-size: 0.9em; font-weight: 500; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; margin-bottom: 4px; pointer-events: none; } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__count_wrap { display: flex; align-items: baseline; gap: 2px; pointer-events: none; } \
            .folder-tile__count { font-size: 1.6em; font-weight: 500; color: #fff; line-height: 1; } \
            .folder-tile__total { font-size: 0.7em; opacity: 0.4; color: #fff; } \
            .folder-tile.focus .folder-tile__count, .folder-tile.focus .folder-tile__total { color: #000; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.2); align-items: center; padding: 0; } \
            .folder-tile--create .folder-tile__name { text-align: center; font-size: 0.85em; opacity: 0.7; margin: 0; } \
        </style>');
    }

    // --- 3. КОМПОНЕНТ ВМІСТУ ПАПКИ ---
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var last_focus;

        this.create = function () {
            this.activity.loader(false);
            if (object.items && object.items.length) {
                object.items.forEach(function (data) {
                    var card = new Lampa.Card(data, { card_category: true, is_static: true });
                    card.create();
                    card.onFocus = function (target) { last_focus = target; scroll.update(card.render()); };
                    card.onEnter = function () {
                        Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' });
                    };
                    body.append(card.render()); items.push(card);
                });
                scroll.append(body); html.append(scroll.render());
            } else { html.append('<div class="empty">Тут порожньо</div>'); }
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    if (items.length) { Lampa.Controller.collectionSet(scroll.render()); Lampa.Controller.collectionFocus(last_focus || items[0].render()); }
                    else { Lampa.Controller.toggle('empty'); }
                },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };
        this.pause = function () {}; this.stop = function () {}; this.render = function () { return html; };
        this.destroy = function () { items.forEach(function (item) { item.destroy(); }); scroll.destroy(); html.remove(); };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    // --- 4. ГОЛОВНА ЛОГІКА ТА ВИПРАВЛЕНА НАВІГАЦІЯ ---
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var view = originalRender.call(comp);
                    var folders = getFolders();
                    var scrollContent = view.find('.scroll__content').first();
                    
                    if (scrollContent.length) {
                        var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                        
                        // Кнопка Створити
                        var createBtn = $('<div class="folder-tile folder-tile--create selector" tabindex="0"><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function () {
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

                        // Папки
                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector" tabindex="0">' +
                                '<div class="folder-tile__name">' + folder.name + '</div>' +
                                '<div class="folder-tile__count_wrap">' +
                                    '<span class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + '</span>' +
                                    '<span class="folder-tile__total">/ 500</span>' +
                                '</div></div>');
                            
                            tile.on('click', function() {
                                Lampa.Activity.push({ title: folder.name, component: 'custom_folder_component', items: folder.list || [] });
                            });

                            tile.on('hover:long', function() {
                                Lampa.Select.show({
                                    title: folder.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: function() {
                                        var f = getFolders(); f.splice(i, 1);
                                        saveFolders(f); Lampa.Activity.replace();
                                    }
                                });
                            });
                            wrapper.append(tile);
                        });

                        scrollContent.prepend(wrapper);

                        // ФІКС НАВІГАЦІЇ:
                        // Використовуємо стандартний старт, але після нього перераховуємо колекцію елементів
                        var originalStart = comp.start;
                        comp.start = function() {
                            originalStart.call(comp);
                            
                            // Даємо 50мс на те, щоб Lampa ініціалізувала свій контролер, 
                            // а потім примусово додаємо наші папки в його область видимості
                            setTimeout(function() {
                                Lampa.Controller.collectionSet(view);
                            }, 50);
                        };
                    }
                    return view;
                };
                return comp;
            }, true);
        }
    });

    // --- 5. МЕНЮ ВИБОРУ ПРИ ДОДАВАННІ ---
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
