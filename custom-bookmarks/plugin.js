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

    // СТИЛІ
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-folders-container { width: 100%; padding: 10px 15px; box-sizing: border-box; } \
            .custom-folders-list { display: flex; flex-wrap: wrap; gap: 10px; } \
            .folder-tile { \
                background-color: rgba(0, 0, 0, 0.3) !important; \
                width: 100px; height: 75px; border-radius: 8px; \
                display: flex; flex-direction: column; justify-content: center; align-items: flex-start; \
                padding: 0 10px; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.05); \
                box-sizing: border-box; \
            } \
            .folder-tile.focus { background-color: #fff !important; border: 1px solid #fff; transform: scale(1.05); z-index: 10; } \
            .folder-tile__name { font-size: 0.85em; font-weight: 500; color: #fff; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__count { font-size: 1.6em; font-weight: 500; color: #fff; } \
            .folder-tile.focus .folder-tile__count { color: #000; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.3); align-items: center; } \
        </style>');
    }

    // Компонент папки (перегляд вмісту)
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        this.create = function () {
            this.activity.loader(false);
            if (object.items && object.items.length) {
                object.items.forEach(function (data) {
                    var card = new Lampa.Card(data, { card_category: true, is_static: true });
                    card.create();
                    card.onFocus = function (target) { scroll.update(card.render()); };
                    card.onEnter = function () { Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' }); };
                    body.append(card.render()); items.push(card);
                });
                scroll.append(body); html.append(scroll.render());
            } else { html.append('<div class="empty">Тут порожньо</div>'); }
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

    // ОСНОВНА ІНТЕГРАЦІЯ
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
                        var container = $('<div class="custom-folders-container"><div class="custom-folders-list"></div></div>');
                        var list = container.find('.custom-folders-list');
                        
                        var createBtn = $('<div class="folder-tile folder-tile--create selector" tabindex="0"><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders(); f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });
                        list.append(createBtn);

                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector" tabindex="0">' +
                                '<div class="folder-tile__name">' + folder.name + '</div>' +
                                '<div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + '</div>' +
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
                            list.append(tile);
                        });

                        scrollContent.prepend(container);

                        // СУВОРИЙ ПЕРЕХОПЛЮВАЧ КОНТРОЛЕРА
                        var originalStart = comp.start;
                        comp.start = function() {
                            // 1. Спочатку реєструємо ВСІ елементи на екрані (наші + стандартні)
                            Lampa.Controller.add('bookmarks', {
                                toggle: function() {
                                    Lampa.Controller.collectionSet(view);
                                    // Шукаємо останній фокус або ставимо на першу кнопку
                                    var target = view.find('.selector.focus')[0] || view.find('.selector').first()[0];
                                    Lampa.Controller.collectionFocus(target);
                                },
                                left: function() { Lampa.Controller.toggle('menu'); },
                                up: function() { Lampa.Controller.toggle('head'); },
                                back: function() { Lampa.Activity.backward(); }
                            });
                            // 2. Активуємо цей контролер
                            Lampa.Controller.toggle('bookmarks');
                        };
                    }
                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню вибору (без змін)
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
