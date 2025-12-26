(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    // 1. РОБОТА З ДАНИМИ
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

    // 2. ОНОВЛЕНІ СТИЛІ (ПІД РОЗМІР СИСТЕМНИХ ТАЙЛІВ)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 20px 15px; gap: 15px; width: 100%; } \
            .folder-tile { \
                position: relative; \
                background-color: rgba(255, 255, 255, 0.05) !important; \
                width: 200px; height: 120px; \
                border-radius: 15px; \
                display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; \
                padding: 15px; \
                cursor: pointer; transition: all 0.2s ease; \
                border: none; \
            } \
            .folder-tile.focus { \
                background-color: #fff !important; \
                transform: scale(1.05); \
            } \
            .folder-tile__name { \
                font-size: 1.2em; font-weight: 400; color: #fff; \
                white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; \
            } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__count_wrap { display: flex; align-items: baseline; gap: 5px; } \
            .folder-tile__count { font-size: 2.2em; font-weight: 500; color: #fff; line-height: 1; } \
            .folder-tile__total { font-size: 1em; opacity: 0.4; color: #fff; } \
            .folder-tile.focus .folder-tile__count, .folder-tile.focus .folder-tile__total { color: #000; } \
            .folder-tile--create { \
                border: 2px dashed rgba(255, 255, 255, 0.2); \
                background-color: transparent !important; \
                align-items: center; justify-content: center; \
            } \
            .folder-tile--create .folder-tile__name { text-align: center; opacity: 0.6; } \
        </style>');
    }

    // 3. КОМПОНЕНТ ПЕРЕГЛЯДУ ПАПКИ
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
                        Lampa.Activity.push({
                            url: data.url || '', component: 'full', id: data.id,
                            method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb'
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
                    } else { Lampa.Controller.toggle('empty'); }
                },
                left: function () { Lampa.Controller.toggle('menu'); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {}; this.stop = function () {};
        this.render = function () { return html; };
        this.destroy = function () {
            items.forEach(function (item) { item.destroy(); });
            scroll.destroy(); html.remove();
        };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    // 4. МЕНЮ ВИБОРУ
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFavMenu = params && params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });

        if (isFavMenu || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;

            if (folders.length > 0 && movie) {
                params.items = params.items.filter(function(i) { return !i.is_custom; });
                var customItems = [];
                folders.forEach(function(f, i) {
                    var exists = f.list.some(function(m) { return m.id == movie.id; });
                    customItems.push({
                        title: f.name,
                        selected: exists,
                        is_custom: true,
                        f_idx: i
                    });
                });
                params.items = customItems.concat(params.items);

                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        var movieIdx = -1;
                        for(var j=0; j < target.list.length; j++) {
                            if(target.list[j].id == movie.id) { movieIdx = j; break; }
                        }
                        if (movieIdx > -1) target.list.splice(movieIdx, 1);
                        else target.list.push(JSON.parse(JSON.stringify(movie)));
                        
                        saveFolders(fUpdate);
                        Lampa.Select.close();
                        setTimeout(function(){ Lampa.Select.show(params); }, 10);
                    } else if (originalOnSelect) {
                        originalOnSelect(item);
                    }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };

    // 5. ІНТЕГРАЦІЯ (З ОНОВЛЕНОЮ ВЕРСТКОЮ ТАЙЛА)
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;
                comp.render = function () {
                    var view = originalRender.call(comp);
                    var folders = getFolders();
                    var container = view.find('.category-full, .bookmarks-list, .scroll__content').first();
                    if (container.length) {
                        var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                        
                        // Кнопка Створити
                        var createBtn = $('<div class="folder-tile folder-tile--create selector"><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });
                        wrapper.append(createBtn);

                        // Папки
                        folders.forEach(function(folder, i) {
                            var count = folder.list ? folder.list.length : 0;
                            // Верстка під системний стиль: Ім'я зверху, лічильник знизу
                            var tile = $('<div class="folder-tile selector">' +
                                '<div class="folder-tile__name">' + folder.name + '</div>' +
                                '<div class="folder-tile__count_wrap">' +
                                    '<span class="folder-tile__count">' + count + '</span>' +
                                    '<span class="folder-tile__total">/ 500</span>' +
                                '</div>' +
                            '</div>');

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
                        container.prepend(wrapper);
                    }
                    return view;
                };
                return comp;
            }, true);
        }
    });
})();
