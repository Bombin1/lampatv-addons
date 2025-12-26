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
                toggle: function () { 
                    Lampa.Controller.collectionSet(scroll.render()); 
                    Lampa.Controller.collectionFocus(items[0] ? items[0].render() : null); 
                },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () { return html; };
        this.destroy = function () { items.forEach(function (item) { item.destroy(); }); scroll.destroy(); html.remove(); };
    }
    Lampa.Component.add('custom_folder_view', CustomFolderComponent);

    // Функція створення блоку папок
    function injectFolders(view) {
        if (view.find('.custom-folders-section').length) return;

        var folders = getFolders();
        var section = $('<div class="custom-folders-section" style="width: 100%; margin-bottom: 20px;"> \
            <div class="category__title" style="margin-left: 20px; padding: 20px 0 10px 0;">Мої папки</div> \
            <div class="category-full custom-line" style="display: flex; flex-wrap: wrap; padding: 0 15px;"></div> \
        </div>');
        
        var container = section.find('.custom-line');

        // Плитка "Створити"
        var createBtn = new Lampa.Card({name: 'Створити', vote: '+'}, {is_static: true});
        createBtn.create();
        createBtn.render().css({width: '130px', height: '80px', margin: '5px'});
        createBtn.onEnter = function() {
            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                if (name) {
                    var f = getFolders(); f.push({ name: name, list: [] });
                    saveFolders(f); Lampa.Activity.replace();
                }
            });
        };
        container.append(createBtn.render());

        // Плитки папок
        folders.forEach(function(f, i) {
            var folderCard = new Lampa.Card({name: f.name, vote: '📁'}, {is_static: true});
            folderCard.create();
            folderCard.render().css({width: '130px', height: '80px', margin: '5px'});
            folderCard.onEnter = function() {
                Lampa.Activity.push({ title: f.name, component: 'custom_folder_view', items: f.list });
            };
            folderCard.onLong = function() {
                Lampa.Select.show({
                    title: f.name,
                    items: [{title: 'Видалити'}],
                    onSelect: function() {
                        var fl = getFolders(); fl.splice(i, 1);
                        saveFolders(fl); Lampa.Activity.replace();
                    }
                });
            };
            container.append(folderCard.render());
        });

        var target = view.find('.scroll__content');
        if (target.length) {
            target.prepend(section);
            Lampa.Controller.collectionSet(view);
        }
    }

    // Слухаємо і старт, і рендер, щоб папки не зникали при переході назад
    Lampa.Listener.follow('activity', function (e) {
        if (e.component === 'bookmarks') {
            if (e.type === 'start') {
                setTimeout(function() { injectFolders(e.object.render()); }, 200);
            }
            if (e.type === 'render') {
                injectFolders(e.object.render());
            }
        }
    });

    // Меню додавання в картці
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFav = params && params.items && params.items.some(function(i) { return i.id === 'wath' || i.id === 'book' || i.id === 'like'; });
        if (isFav || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;
            if (folders.length >
