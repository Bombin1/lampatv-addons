(function () {
    'use strict';

    function CustomBookmarksPlugin() {
        var items = [];
        
        // Завантаження даних
        var load = function() {
            try {
                items = JSON.parse(Lampa.Storage.get('custom_bookmarks_folders', '[]'));
            } catch(e) { 
                items = []; 
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_folders', JSON.stringify(items));
        };

        load();

        // 1. Додавання кнопки в картку фільму (як у прикладі)
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object.render();
                var container = render.find('.full-start__buttons');
                
                if (container.length && !render.find('.button--custom-bookmarks').length) {
                    var btn = $('<div class="full-start__button selector button--custom-bookmarks"><svg height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg" style="fill: currentColor; margin-right: 10px; vertical-align: middle;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg><span>Папки</span></div>');
                    
                    btn.on('click', function () {
                        var menu = [{ title: ' + Створити папку', action: 'create' }];
                        items.forEach(function(cat, i) { 
                            menu.push({ title: cat.name, action: 'add', index: i }); 
                        });

                        Lampa.Select.show({
                            title: 'Додати в папку',
                            items: menu,
                            onSelect: function (a) {
                                if (a.action === 'create') {
                                    Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                        if (name) {
                                            items.push({ name: name, list: [e.data] });
                                            save();
                                            Lampa.Noty.show('Папку створено');
                                        }
                                    });
                                } else {
                                    var category = items[a.index];
                                    if (!category.list) category.list = [];
                                    if (!category.list.find(function(m){ return m.id == e.data.id })) {
                                        category.list.push(e.data);
                                        save();
                                        Lampa.Noty.show('Додано в ' + category.name);
                                    } else {
                                        Lampa.Noty.show('Вже є в цій папці');
                                    }
                                }
                            }
                        });
                    });
                    container.append(btn);
                }
            }
        });

        // 2. Створення окремого компонента для відображення (як у my_bookmarks)
        Lampa.Component.add('my_folders', function (object) {
            var comp = this;
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var last_index = 0;

            this.create = function () {
                var gui = $('<div class="bookmarks-folders"></div>');
                load();

                if (items.length === 0) {
                    gui.append('<div class="empty" style="text-align:center; padding: 100px;">Папки порожні. Створіть їх у картці фільму.</div>');
                } else {
                    // Створення вкладок (tabs) якщо папок багато
                    items.forEach(function(cat, index) {
                        var row = $('<div class="category-list"><div class="category-title" style="padding: 20px 40px; font-size: 1.8em; color: #fff;">' + cat.name + '</div><div class="category-items" style="display: flex; flex-wrap: wrap; padding: 0 40px;"></div></div>');
                        
                        cat.list.forEach(function(movie) {
                            var card = Lampa.Template.get('card', movie);
                            card.addClass('selector');
                            card.on('click', function() {
                                Lampa.Activity.push({
                                    url: movie.url, title: movie.title || movie.name, component: 'full', id: movie.id, method: movie.name ? 'tv' : 'movie', card: movie
                                });
                            });
                            // Додаємо контекстне меню для видалення
                            card.on('hover:long', function() {
                                Lampa.Select.show({
                                    title: 'Керування',
                                    items: [{title: 'Видалити з папки', action: 'delete'}],
                                    onSelect: function() {
                                        cat.list = cat.list.filter(function(m) { return m.id !== movie.id });
                                        save();
                                        Lampa.Activity.replace(); // Оновити екран
                                    }
                                });
                            });
                            row.find('.category-items').append(card);
                        });
                        gui.append(row);
                    });
                }
                return scroll.render().append(gui);
            };

            this.start = function () {
                Lampa.Controller.add('content', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(comp.render());
                        Lampa.Controller.collectionFocus(false, comp.render());
                    }
                });
                Lampa.Controller.toggle('content');
            };

            this.render = function () { return this.create(); };
            this.pause = function () {};
            this.stop = function () {};
        });

        // 3. Інтеграція в головне меню
        var addMenu = function() {
            if ($('.menu .menu__list').length && !$('.menu__item--my-folders').length) {
                var menu_item = $('<li class="menu__item selector menu__item--my-folders"><div class="menu__ico"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-4H6V10h12v2z"/></svg></div><div class="menu__text">Мої папки</div></li>');
                menu_item.on('hover:enter', function () {
                    Lampa.Activity.push({ title: 'Мої папки', component: 'my_folders', page: 1 });
                });
                $('.menu .menu__list').append(menu_item);
            }
        };

        setInterval(addMenu, 2000);
    }

    if (window.appready) CustomBookmarksPlugin();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') CustomBookmarksPlugin(); });
})();
