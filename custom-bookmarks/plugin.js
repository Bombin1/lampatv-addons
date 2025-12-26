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

    // --- Компонент вмісту папки ---
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

    // --- Вставка папок у "Вибране" ---
    Lampa.Listener.follow('activity', function (e) {
        if (e.type === 'start' && e.component === 'bookmarks') {
            var view = e.object.render();
            
            // Видаляємо дублікати, якщо вони є
            view.find('.custom-folders-wrap').remove();

            var folders = getFolders();
            var wrap = $('<div class="custom-folders-wrap" style="width: 100%; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"> \
                <div class="category__title" style="margin-left: 20px;">Мої папки</div> \
                <div class="category-full" style="display: flex; flex-wrap: wrap; padding: 0 15px;"></div> \
            </div>');
            
            var container = wrap.find('.category-full');

            // Кнопка "+"
            var addBtn = new Lampa.Card({name: 'Створити', vote: '+'}, {is_static: true});
            addBtn.create();
            addBtn.render().css({width: '120px', height: '80px', margin: '5px'});
            addBtn.onEnter = function() {
                Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                    if (name) {
                        var f = getFolders(); f.push({ name: name, list: [] });
                        saveFolders(f); Lampa.Activity.replace();
                    }
                });
            };
            container.append(addBtn.render());

            // Список папок
            folders.forEach(function(f, i) {
                var card = new Lampa.Card({name: f.name, vote: '📁'}, {is_static: true});
                card.create();
                card.render().css({width: '120px', height: '80px', margin: '5px'});
                card.onEnter = function() {
                    Lampa.Activity.push({ title: f.name, component: 'custom_folder_component', items: f.list });
                };
                card.onLong = function() {
                    Lampa.Select.show({
                        title: f.name,
                        items: [{title: 'Видалити'}],
                        onSelect: function() {
                            var fl = getFolders(); fl.splice(i, 1);
                            saveFolders(fl); Lampa.Activity.replace();
                        }
                    });
                };
                container.append(card.render());
            });

            // Вставляємо на початок
            view.find('.scroll__content').prepend(wrap);
            
            // ПРАВИЛЬНА НАВІГАЦІЯ: оновлюємо контролер після вставки
            setTimeout(function() {
                Lampa.Controller.collectionSet(view);
            }, 200);
        }
    });

    // --- Меню в картці фільму ---
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
