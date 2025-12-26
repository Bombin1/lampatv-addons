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

    // --- КОМПОНЕНТ ПЕРЕГЛЯДУ ВМІСТУ ПАПКИ ---
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');

        this.create = function () {
            this.activity.loader(false);
            if (!object.items || object.items.length === 0) {
                html.append('<div class="empty">Папка порожня</div>');
                return;
            }
            object.items.forEach(function (data) {
                var card = new Lampa.Card(data, { card_category: true, is_static: true });
                card.create();
                card.onFocus = function () { scroll.update(card.render()); };
                card.onEnter = function () { 
                    Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' }); 
                };
                body.append(card.render());
                items.push(card);
            });
            scroll.append(body);
            html.append(scroll.render());
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
    Lampa.Component.add('custom_folder_view', CustomFolderComponent);

    // --- КОМПОНЕНТ СПИСКУ ПАПОК (Головний екран плагіна) ---
    function CustomFoldersMain(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');

        this.create = function () {
            this.activity.loader(false);
            var folders = getFolders();

            // Кнопка "Створити"
            var createCard = new Lampa.Card({name: 'Створити папку', vote: '+'}, {is_static: true});
            createCard.create();
            createCard.render().find('.card__title').text('Створити папку');
            createCard.onEnter = function() {
                Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                    if (name) {
                        var f = getFolders(); f.push({ name: name, list: [] });
                        saveFolders(f); Lampa.Activity.replace();
                    }
                });
            };
            body.append(createCard.render());
            items.push(createCard);

            // Список папок
            folders.forEach(function(f, i) {
                var folderCard = new Lampa.Card({name: f.name, vote: '📁'}, {is_static: true});
                folderCard.create();
                folderCard.onEnter = function() {
                    Lampa.Activity.push({ title: f.name, component: 'custom_folder_view', items: f.list });
                };
                folderCard.onLong = function() {
                    Lampa.Select.show({
                        title: f.name,
                        items: [{title: 'Видалити папку', id: 'delete'}],
                        onSelect: function() {
                            var fl = getFolders(); fl.splice(i, 1);
                            saveFolders(fl); Lampa.Activity.replace();
                        }
                    });
                };
                body.append(folderCard.render());
                items.push(folderCard);
            });

            scroll.append(body);
            html.append(scroll.render());
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
    Lampa.Component.add('custom_folders_main', CustomFoldersMain);

    // --- ДОДАВАННЯ В МЕНЮ ---
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var menu_item = $('<div class="menu__item selector" data-action="custom_folders"> \
                <div class="menu__ico">📁</div> \
                <div class="menu__text">Мої папки</div> \
            </div>');

            menu_item.on('hover:enter', function () {
                Lampa.Activity.push({
                    title: 'Мої папки',
                    component: 'custom_folders_main',
                    page: 1
                });
            });

            $('.menu .menu__list').append(menu_item);
        }
    });

    // --- МЕНЮ ДОДАВАННЯ В КАРТЦІ (залишаємо, воно працює) ---
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
