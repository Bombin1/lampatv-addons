(function () {
    'use strict';

    function CustomBookmarks() {
        var items = [];
        
        // Завантаження даних
        var storage = Lampa.Storage.get('custom_bookmarks_data', '[]');
        try {
            items = JSON.parse(storage);
        } catch(e) {
            items = [];
        }

        // Функція для створення пункту меню
        this.addMenuItem = function() {
            if ($('.menu .menu__list').length) {
                // Перевірка, чи ми вже не додали цей пункт
                if ($('.menu__item--custom-bookmarks').length) return;

                var menu_item = $('<li class="menu__item selector menu__item--custom-bookmarks"><div class="menu__ico"><svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-8-2h2v-4h4v-2h-4V7h-2v4H7v2h4z" fill="white"/></svg></div><div class="menu__text">Власні закладки</div></li>');
                
                menu_item.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Власні закладки',
                        component: 'custom_bookmarks',
                        page: 1
                    });
                });

                $('.menu .menu__list').append(menu_item);
            }
        };

        // Реєстрація компонента для відображення вмісту
        Lampa.Component.add('custom_bookmarks', function (object) {
            var comp = this;
            this.create = function () {
                var gui = $('<div class="category-full"></div>');
                if (items.length === 0) {
                    gui.append('<div class="empty" style="text-align:center; padding: 40px;">У вас ще немає власних категорій</div>');
                } else {
                    items.forEach(function(cat) {
                        gui.append('<div class="category-title" style="padding: 20px; font-size: 1.5em; color: #fff;">' + cat.name + ' (' + cat.list.length + ')</div>');
                    });
                }
                return gui;
            };
            this.render = function () { return this.create(); };
        });

        // Додаємо кнопку в картку фільму (вона з'явиться внизу під головними кнопками)
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var btn = $('<div class="full-start__button selector button--custom-book"><span>Власні категорії</span></div>');
                btn.on('click', function () {
                    Lampa.Noty.show('Ви натиснули на власні категорії!');
                    // Тут буде логіка вибору категорій (додамо пізніше, спочатку перевіримо меню)
                });
                e.object.render().find('.full-start__buttons').append(btn);
            }
        });

        // Постійна перевірка наявності меню (якщо додаток завантажився повільно)
        var timer = setInterval(this.addMenuItem, 1000);
        this.addMenuItem();
    }

    // Запуск
    if (window.appready) {
        new CustomBookmarks();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') new CustomBookmarks();
        });
    }
})();
