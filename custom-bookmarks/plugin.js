(function () {
    'use strict';

    function CustomBookmarks() {
        var items = [];
        
        // Завантаження даних зі сховища
        var load = function() {
            var storage = Lampa.Storage.get('custom_bookmarks_data', '[]');
            try {
                items = JSON.parse(storage);
            } catch(e) {
                items = [];
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_data', JSON.stringify(items));
        };

        load();

        // 1. Додавання кнопки в картку фільму
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $('<div class="full-start__button selector button--custom-book"><span>Власні категорії</span></div>');
                
                btn.on('click', function () {
                    var menu = [
                        { title: ' + Створити категорію', action: 'create' }
                    ];

                    items.forEach(function(cat, index) {
                        menu.push({ title: cat.name, action: 'add', index: index });
                    });

                    Lampa.Select.show({
                        title: 'Куди додати?',
                        items: menu,
                        onSelect: function (a) {
                            if (a.action === 'create') {
                                Lampa.Input.edit({
                                    value: '',
                                    title: 'Назва нової категорії'
                                }, function (name) {
                                    if (name) {
                                        items.push({ name: name, list: [e.data] });
                                        save();
                                        Lampa.Noty.show('Створено та додано: ' + name);
                                    }
                                });
                            } else if (a.action === 'add') {
                                var category = items[a.index];
                                if (!category.list.find(function(m){ return m.id == e.data.id })) {
                                    category.list.push(e.data);
                                    save();
                                    Lampa.Noty.show('Додано в ' + category.name);
                                } else {
                                    Lampa.Noty.show('Вже є в цій категорії');
                                }
                            }
                        }
                    });
                });

                e.object.render().find('.full-start__buttons').append(btn);
            }
        });

        // 2. Логіка відображення закладок у меню
        Lampa.Component.add('custom_bookmarks', function (object) {
            var comp = this;
            var scroll = new Lampa.Scroll({mask: true, over: true});
            var files = new Lampa.Files(object);
            
            this.create = function () {
                var gui = $('<div class="category-full"></div>');
                
                if (items.length === 0) {
                    gui.append('<div class="empty" style="text-align:center; padding: 100px; font-size: 1.2em;">Тут поки порожньо...</div>');
                } else {
                    items.forEach(function(cat) {
                        if (cat.list.length > 0) {
                            var row = $('<div class="category-list"><div class="category-title" style="padding: 20px 40px; font-size: 1.8em; font-weight: bold; color: #fff;">' + cat.name + '</div><div class="category-items" style="display: flex; flex-wrap: wrap; padding: 0 40px;"></div></div>');
                            
                            cat.list.forEach(function(movie) {
                                var card = Lampa.Template.get('card', movie);
                                card.addClass('selector');
                                card.on('click', function() {
                                    Lampa.Activity.push({
                                        url: movie.url,
                                        title: movie.title || movie.name,
                                        component: 'full',
                                        id: movie.id,
                                        method: movie.name ? 'tv' : 'movie',
                                        card: movie
                                    });
                                });
                                row.find('.category-items').append(card);
                            });
                            gui.append(row);
                        }
                    });
                }
                
                scroll.append(gui);
                return scroll.render();
            };

            this.render = function () { return this.create(); };
        });

        // 3. Додавання в бічне меню (таймер для надійності)
        this.addMenuItem = function() {
            if ($('.menu .menu__list').length && !$('.menu__item--custom-bookmarks').length) {
                var menu_item = $('<li class="menu__item selector menu__item--custom-bookmarks"><div class="menu__ico"><svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" fill="white"/></svg></div><div class="menu__text">Власні закладки</div></li>');
                menu_item.on('hover:enter', function () {
                    Lampa.Activity.push({ title: 'Власні закладки', component: 'custom_bookmarks', page: 1 });
                });
                $('.menu .menu__list').append(menu_item);
            }
        };

        var timer = setInterval(this.addMenuItem.bind(this), 1000);
    }

    if (window.appready) new CustomBookmarks();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') new CustomBookmarks(); });
})();
