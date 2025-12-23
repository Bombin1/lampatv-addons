(function () {
    'use strict';

    function CustomBookmarks() {
        var items = [];
        
        var load = function() {
            try {
                items = JSON.parse(Lampa.Storage.get('custom_bookmarks_data', '[]'));
            } catch(e) { 
                items = []; 
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_data', JSON.stringify(items));
        };

        load();

        // 1. Компонент перегляду закладок
        Lampa.Component.add('custom_bookmarks', function (object) {
            var comp = this;
            var scroll = new Lampa.Scroll({mask: true, over: true});
            
            this.start = function () {
                var gui = $('<div class="category-full"></div>');
                load();

                if (items.length === 0) {
                    gui.append('<div class="empty" style="text-align:center; padding: 100px; font-size: 1.5em;">Тут порожньо. Додайте фільм через кнопку в картці.</div>');
                } else {
                    items.forEach(function(cat) {
                        if (cat.list && cat.list.length > 0) {
                            var row = $('<div class="category-list"><div class="category-title" style="padding: 20px 40px; font-size: 1.8em; color: #fff;">' + cat.name + '</div><div class="category-items" style="display: flex; flex-wrap: wrap; padding: 0 40px;"></div></div>');
                            cat.list.forEach(function(movie) {
                                var card = Lampa.Template.get('card', movie);
                                card.addClass('selector');
                                card.on('click', function() {
                                    Lampa.Activity.push({
                                        url: movie.url, title: movie.title || movie.name, component: 'full', id: movie.id, method: movie.name ? 'tv' : 'movie', card: movie
                                    });
                                });
                                row.find('.category-items').append(card);
                            });
                            gui.append(row);
                        }
                    });
                }
                
                this.activity.loader(false);
                this.activity.render(scroll.render().append(gui));
            };

            this.pause = function () {};
            this.stop = function () {};
        });

        // 2. Безпечне додавання кнопки в картку
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object.render();
                var container = render.find('.full-start__buttons');
                
                if (container.length && !render.find('.button--custom-bookmarks').length) {
                    var btn = $('<div class="full-start__button selector button--custom-bookmarks"><span>Додати в категорію</span></div>');
                    
                    btn.on('click', function () {
                        var menu = [{ title: ' + Створити категорію', action: 'create' }];
                        items.forEach(function(cat, i) { 
                            menu.push({ title: cat.name, action: 'add', index: i }); 
                        });

                        Lampa.Select.show({
                            title: 'Оберіть категорію',
                            items: menu,
                            onSelect: function (a) {
                                if (a.action === 'create') {
                                    Lampa.Input.edit({ value: '', title: 'Назва категорії' }, function (name) {
                                        if (name) {
                                            items.push({ name: name, list: [e.data] });
                                            save();
                                            Lampa.Noty.show('Створено: ' + name);
                                        }
                                    });
                                } else {
                                    var category = items[a.index];
                                    if (!category.list) category.list = [];
                                    if (!category.list.find(function(m){ return m.id == e.data.id })) {
                                        category.list.push(e.data);
                                        save();
                                        Lampa.Noty.show('Додано в ' + category.name);
                                    }
                                }
                            }
                        });
                    });

                    container.append(btn);
                }
            }
        });

        // 3. Додавання в бічне меню
        var addMenuItem = function() {
            if ($('.menu .menu__list').length && !$('.menu__item--custom-bookmarks').length) {
                var menu_item = $('<li class="menu__item selector menu__item--custom-bookmarks"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white" stroke-width="2"><path d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z"/></svg></div><div class="menu__text">Власні закладки</div></li>');
                menu_item.on('hover:enter', function () {
                    Lampa.Activity.push({ title: 'Власні закладки', component: 'custom_bookmarks', page: 1 });
                });
                $('.menu .menu__list').append(menu_item);
            }
        };

        setInterval(addMenuItem, 2000);
    }

    // Запуск
    if (window.appready) CustomBookmarks();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') CustomBookmarks(); });
})();
