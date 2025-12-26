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

    if (!$('#custom-folders-styles').length) {
        $('body').append('<style id="custom-folders-styles"> \
            .f-item { width: 100px; height: 60px; background: rgba(255,255,255,0.05) !important; border-radius: 8px; border: 2px solid transparent; display: inline-flex; flex-direction: column; justify-content: center; align-items: center; margin: 5px; vertical-align: top; cursor: pointer; } \
            .f-item.focus { background: rgba(255,255,255,0.3) !important; border-color: #fff; transform: scale(1.05); } \
            .f-item__name { font-size: 10px; color: #fff; text-align: center; margin-top: 2px; } \
            .f-item__icon { font-size: 14px; } \
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

    // Функція вставки папок
    function injectFolders(view) {
        if (view.find('.f-item').length) return; // Вже є

        // Шукаємо будь-який контейнер, де можуть бути картки
        var container = view.find('.category-full, .items-line, .scroll__content').first();
        if (!container.length) return;

        var folders = getFolders();
        
        var createBtn = $('<div class="f-item selector" tabindex="0"><div class="f-item__icon">+</div><div class="f-item__name">Створити</div></div>');
        createBtn.on('hover:enter', function() {
            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                if (name) {
                    var f = getFolders(); f.push({ name: name, list: [] });
                    saveFolders(f); Lampa.Activity.replace();
                }
            });
        });
        container.prepend(createBtn);

        folders.forEach(function(f, i) {
            var tile = $('<div class="f-item selector" tabindex="0"><div class="f-item__icon">📁</div><div class="f-item__name">'+f.name+'</div></div>');
            tile.on('hover:enter', function() {
                Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
            });
            tile.on('hover:long', function() {
                Lampa.Select.show({
                    title: f.name,
                    items: [{ title: 'Видалити' }],
                    onSelect: function() {
                        var fl = getFolders(); fl.splice(i, 1);
                        saveFolders(fl); Lampa.Activity.replace();
                    }
                });
            });
            container.prepend(tile);
        });

        Lampa.Controller.collectionSet(view);
    }

    // ПЕРЕХОПЛЕННЯ КОМПОНЕНТА
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var view = originalRender.call(comp);
                    
                    // Використовуємо спостерігач, щоб "спіймати" момент появи контейнера
                    var observer = new MutationObserver(function() {
                        injectFolders(view);
                    });
                    
                    observer.observe(view[0], { childList: true, subtree: true });
                    
                    // Спробуємо також миттєво
                    setTimeout(function() { injectFolders(view); }, 100);

                    var originalStart = comp.start;
                    comp.start = function() {
                        originalStart.call(comp);
                        Lampa.Controller.collectionSet(view);
                        // Фокус на першу папку
                        var first = view.find('.f-item').first()[0];
                        if (first) Lampa.Controller.collectionFocus(first);
                    };

                    return view;
                };
                return comp;
            }, true);
        }
    });

    // Меню в картці фільму
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
