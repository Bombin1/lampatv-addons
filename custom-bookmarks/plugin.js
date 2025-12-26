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

    // Стилі: використовуємо відносну позицію, щоб папки штовхали контент вниз
    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .bookmarks-custom-wrapper { position: relative; display: block; width: 100%; padding: 15px; box-sizing: border-box; z-index: 10; } \
            .folders-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; } \
            .folder-tile { \
                background-color: rgba(0, 0, 0, 0.3) !important; \
                width: 100px; height: 70px; border-radius: 8px; \
                display: flex; flex-direction: column; justify-content: center; align-items: center; \
                cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.1); \
                transition: transform 0.2s; \
            } \
            .folder-tile.focus { background-color: #fff !important; transform: scale(1.05); border-color: #fff; } \
            .folder-tile__name { font-size: 0.8em; color: #fff; text-align: center; padding: 0 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__icon { font-size: 1.5em; margin-bottom: 2px; } \
            /* Корекція стандартного списку Lampa, щоб він не залізав під папки */ \
            .category-full, .bookmarks-list { position: relative !important; top: 0 !important; } \
        </style>');
    }

    // Компонент папки
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
                    
                    // Знаходимо контейнер прокрутки
                    var scroll = view.find('.scroll__content');
                    if (scroll.length) {
                        var wrapper = $('<div class="bookmarks-custom-wrapper"><div class="folders-grid"></div></div>');
                        var grid = wrapper.find('.folders-grid');

                        // Кнопка Створити
                        var createBtn = $('<div class="folder-tile selector" tabindex="0"><div class="folder-tile__icon">+</div><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function() {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders(); f.push({ name: name, list: [] });
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });
                        grid.append(createBtn);

                        // Папки
                        folders.forEach(function(f, i) {
                            var tile = $('<div class="folder-tile selector" tabindex="0"><div class="folder-tile__icon">📁</div><div class="folder-tile__name">'+f.name+' ('+f.list.length+')</div></div>');
                            tile.on('click', function() {
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
                            grid.append(tile);
                        });

                        // Додаємо папки НА ПОЧАТОК списку
                        scroll.prepend(wrapper);
                    }

                    // Оновлюємо навігацію після рендеру
                    var originalStart = comp.start;
                    comp.start = function() {
                        originalStart.call(comp);
                        // Змушуємо контролер побачити і наші папки, і стандартні фільми як єдине ціле
                        Lampa.Controller.collectionSet(view);
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню додавання в папку
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
