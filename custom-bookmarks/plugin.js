(function () {
    'use strict';

    function CustomBookmarks() {
        var items = [];
        
        // Завантаження даних
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

        // Функція виклику меню додавання
        var openAddMenu = function(movieData) {
            var menu = [
                { title: ' + Створити нову категорію', action: 'create' }
            ];

            items.forEach(function(cat, index) {
                menu.push({ title: cat.name, action: 'add', index: index });
            });

            Lampa.Select.show({
                title: 'Додати до категорії',
                items: menu,
                onSelect: function (a) {
                    if (a.action === 'create') {
                        Lampa.Input.edit({
                            value: '',
                            title: 'Назва категорії'
                        }, function (name) {
                            if (name) {
                                items.push({ name: name, list: [movieData] });
                                save();
                                Lampa.Noty.show('Категорію "' + name + '" створено');
                            }
                        });
                    } else if (a.action === 'add') {
                        var category = items[a.index];
                        if (!category.list.find(function(m){ return m.id == movieData.id })) {
                            category.list.push(movieData);
                            save();
                            Lampa.Noty.show('Додано в ' + category.name);
                        } else {
                            Lampa.Noty.show('Вже є в цій категорії');
                        }
                    }
                },
                onBack: function(){
                    Lampa.Controller.toggle('full_start'); // Повертаємо фокус на картку
                }
            });
        };

        // Метод додавання кнопки в інтерфейс
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var container = e.object.render().find('.full-start__buttons');
                
                // Створюємо кнопку за стандартом Lampa
                var btn = $('<div class="full-start__button selector button--custom-bookmarks"><span>Додати в категорію</span></div>');
                
                btn.on('click', function () {
                    openAddMenu(e.data);
                });

                // Додаємо кнопку на початок списку або після головних кнопок
                container.append(btn);
                
                // Оновлюємо контролер, щоб пульт "бачив" нову кнопку
                Lampa.Controller.add('full_start', {
                    toggle: function () {
                        Lampa.Controller.collectionSet(e.object.render());
                        Lampa.Controller.collectionFocus(btn[0], e.object.render());
                    }
                });
            }
        });

        // Компонент перегляду закладок
        Lampa.Component.add('custom_bookmarks', function (object) {
            var comp = this;
            var scroll = new Lampa.Scroll({mask: true, over: true});
            
            this.create = function () {
                var gui = $('<div class="category-full"></div>');
                load(); // Оновлюємо дані перед рендером

                if (items.length === 0) {
                    gui.append('<div class="empty" style="text-align:center; padding: 100px;">Створіть свою першу категорію в картці фільму</div>');
                } else {
                    items.forEach(function(cat) {
                        if (cat.list.length > 0) {
                            var row = $('<div class="category-list"><div class="category-title" style="padding: 20px 40px; font-size: 1.8em; color: #fff;">' + cat.name + '</div><div class="category-items" style="display: flex; flex-wrap: wrap; padding: 0 40px;"></div></div>');
                            
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

        // Додавання в меню
        this.addMenuItem = function() {
            if ($('.menu .menu__list').length && !$('.menu__item--custom-bookmarks').length) {
                var menu_item = $('<li class="menu__item selector menu__item--custom-bookmarks"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white" stroke-width="2"><path d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z" fill="none"/></svg></div><div class="menu__text">Власні закладки</div></li>');
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
