(function () {
    'use strict';

    function CustomBookmarks() {
        var items = [];

        function load() {
            try {
                items = Lampa.Storage.get('custom_bookmarks_data', []);
                if (typeof items === 'string') items = JSON.parse(items);
            } catch (e) {
                items = [];
            }
        }

        function save() {
            Lampa.Storage.set('custom_bookmarks_data', items);
        }

        load();

        // Реєстрація компонента
        Lampa.Component.add('custom_bookmarks', function () {
            var comp = this;
            var scroll = new Lampa.Scroll({ mask: true, over: true });

            this.create = function () {
                var gui = $('<div class="category-full"></div>');
                load();

                if (!items.length) {
                    gui.append('<div class="empty" style="text-align:center; padding: 100px; font-size: 1.5em;">Закладки порожні</div>');
                } else {
                    var row = $('<div class="category-list"><div class="category-title" style="padding:20px 40px;font-size:1.8em;color:#fff;font-weight:bold;">Мої закладки</div><div class="category-items" style="display:flex;flex-wrap:wrap;padding:0 40px;"></div></div>');
                    items.forEach(function (movie) {
                        var card = Lampa.Template.get('card', movie);
                        card.addClass('selector');
                        card.on('click', function () {
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

            this.render = function () {
                return this.create();
            };

            this.pause = function () {};
            this.stop = function () {};
            this.destroy = function () {
                scroll.destroy();
            };
        });

        // Кнопка у картці фільма
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite' && e.data) {
                var render = e.object.render();
                var container = render.find('.full-start__buttons');

                if (container.length && !render.find('.button--custom-bookmarks').length) {
                    var btn = $('<div class="full-start__button selector button--custom-bookmarks"><span>Додати в закладки</span></div>');

                    btn.on('click', function () {
                        load();
                        if (!items.find(function (m) { return m.id == e.data.id; })) {
                            items.push(e.data);
                            save();
                            Lampa.Noty.show('✅ Додано в закладки');
                        } else {
                            Lampa.Noty.show('⚠️ Вже є у закладках');
                        }
                    });

                    container.append(btn);
                }
            }
        });

        // Пункт у меню зліва
        function addMenuItem() {
            if ($('.menu .menu__list').length && !$('.menu__item--custom-bookmarks').length) {
                var menu_item = $('<li class="menu__item selector menu__item--custom-bookmarks"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="white" stroke-width="2"><path d="M19 21L12 16L5 21V5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21Z"/></svg></div><div class="menu__text">Власні закладки</div></li>');
                menu_item.on('hover:enter', function () {
                    Lampa.Activity.push({ title: 'Власні закладки', component: 'custom_bookmarks', page: 1 });
                });
                $('.menu .menu__list').append(menu_item);
            }
        }

        addMenuItem();
    }

    if (window.appready) CustomBookmarks();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') CustomBookmarks(); });
})();
