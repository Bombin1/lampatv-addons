(function () {
    'use strict';

    Lampa.Platform.tv();

    function CustomBookmarks() {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true,
            step: 250
        });
        var items = [];
        var active_list = null;
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');

        this.create = function () {
            var _this = this;
            this.activity.loader(true);

            // Додаємо стилі для відповідності оригінальному інтерфейсу
            var style = `
                <style>
                    .custom-bookmarks__list {
                        display: flex;
                        flex-wrap: wrap;
                        padding: 1.5rem;
                    }
                    .custom-bookmarks__item {
                        width: 20.5rem; /* Ширина як у оригінальних тайлів */
                        height: 10.5rem; /* Висота як у оригінальних тайлів */
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 1.2rem;
                        margin: 0.8rem;
                        padding: 1.5rem;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        transition: background 0.2s, transform 0.2s;
                        cursor: pointer;
                        position: relative;
                        box-sizing: border-box;
                    }
                    .custom-bookmarks__item.focus {
                        background: #fff;
                        color: #000;
                        transform: scale(1.03);
                    }
                    .custom-bookmarks__item-title {
                        font-size: 1.6rem;
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    .custom-bookmarks__item-count {
                        font-size: 2.2rem; /* Великі цифри як в оригіналі */
                        font-weight: bold;
                        margin-top: auto;
                    }
                    .custom-bookmarks__item-count span {
                        font-size: 1.4rem;
                        opacity: 0.5;
                        font-weight: normal;
                    }
                    .custom-bookmarks__item--create {
                        border: 2px dashed rgba(255, 255, 255, 0.2);
                        background: transparent;
                        justify-content: center;
                        align-items: center;
                    }
                    .custom-bookmarks__item--create.focus {
                        border-color: #fff;
                        background: rgba(255, 255, 255, 0.1);
                        color: #fff;
                    }
                </style>
            `;
            $('body').append(style);

            this.render();
            return this.render();
        };

        this.render = function () {
            var _this = this;
            html.empty();
            var list_html = $('<div class="custom-bookmarks__list"></div>');

            // Кнопка Створити
            var create_btn = $(`
                <div class="custom-bookmarks__item custom-bookmarks__item--create selector">
                    <div class="custom-bookmarks__item-title">Створити</div>
                </div>
            `);

            create_btn.on('hover:enter', function () {
                Lampa.Input.edit({
                    value: '',
                    title: 'Назва списку'
                }, function (new_name) {
                    if (new_name) {
                        var id = Lampa.Utils.uid(8);
                        var lists = Lampa.Storage.get('custom_bookmarks_lists', []);
                        lists.push({ id: id, name: new_name, items: [] });
                        Lampa.Storage.set('custom_bookmarks_lists', lists);
                        _this.render();
                    }
                });
            });

            list_html.append(create_btn);

            // Списки
            var lists = Lampa.Storage.get('custom_bookmarks_lists', []);
            lists.forEach(function (list) {
                var item = $(`
                    <div class="custom-bookmarks__item selector">
                        <div class="custom-bookmarks__item-title">${list.name}</div>
                        <div class="custom-bookmarks__item-count">${list.items.length} <span>/ 500</span></div>
                    </div>
                `);

                item.on('hover:enter', function () {
                    active_list = list;
                    _this.showList(list);
                }).on('hover:long', function () {
                    Lampa.Select.show({
                        title: list.name,
                        items: [
                            { title: 'Перейменувати', action: 'rename' },
                            { title: 'Видалити', action: 'delete' }
                        ],
                        onSelect: function (a) {
                            if (a.action == 'rename') {
                                Lampa.Input.edit({ value: list.name, title: 'Нова назва' }, function (nn) {
                                    if (nn) {
                                        list.name = nn;
                                        Lampa.Storage.set('custom_bookmarks_lists', lists);
                                        _this.render();
                                    }
                                });
                            } else if (a.action == 'delete') {
                                var idx = lists.indexOf(list);
                                lists.splice(idx, 1);
                                Lampa.Storage.set('custom_bookmarks_lists', lists);
                                _this.render();
                            }
                        }
                    });
                });

                list_html.append(item);
            });

            html.append(list_html);
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.showList = function (list) {
            var _this = this;
            Lampa.Activity.push({
                url: '',
                title: list.name,
                component: 'category_full',
                page: 1,
                onBack: function () {
                    Lampa.Activity.backward();
                }
            });

            var items_list = list.items.map(function (i) {
                var card = Lampa.Template.get('card', i);
                card.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: i.url,
                        component: 'full',
                        id: i.id,
                        method: i.method,
                        card: i
                    });
                });
                return card;
            });

            Lampa.Component.get('category_full').render().find('.category-full').append(items_list);
        };

        this.start = function () {
            Lampa.Controller.add('custom_bookmarks', {
                toggle: function () {
                    Lampa.Controller.collectionSet(html);
                    Lampa.Controller.collectionFocus(false, html);
                },
                left: function () {
                    Lampa.Controller.focus('menu');
                },
                up: function () {
                    Lampa.Controller.focus('head');
                },
                down: function () {
                    //
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('custom_bookmarks');
        };

        this.pause = function () {};
        this.stop = function () {};
    }

    // Додавання пункту в меню
    function addSettings() {
        var button = $(`<div class="menu__item selector" data-action="custom_bookmarks">
            <div class="menu__item-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM10 17H14V10H17L12 5L7 10H10V17Z" fill="white"/></svg>
            </div>
            <div class="menu__item-title">Мої Списки</div>
        </div>`);

        button.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Мої Списки',
                component: 'custom_bookmarks',
                page: 1
            });
        });

        $('.menu .menu__list').append(button);
    }

    // Додавання кнопки "Додати до списку" у картку фільму
    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite') {
            var btn = $(`<div class="full-start__button selector">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19M5 12H19" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <span>У список</span>
            </div>`);

            btn.on('hover:enter', function () {
                var lists = Lampa.Storage.get('custom_bookmarks_lists', []);
                if (lists.length == 0) {
                    Lampa.Noty.show('Спершу створіть хоча б один список у розділі "Мої Списки"');
                    return;
                }

                Lampa.Select.show({
                    title: 'Додати до списку',
                    items: lists.map(function (l) {
                        return { title: l.name, list: l };
                    }),
                    onSelect: function (a) {
                        var exists = a.list.items.find(function (i) { return i.id == e.data.movie.id; });
                        if (!exists) {
                            a.list.items.push(e.data.movie);
                            Lampa.Storage.set('custom_bookmarks_lists', lists);
                            Lampa.Noty.show('Додано до списку: ' + a.list.name);
                        } else {
                            Lampa.Noty.show('Вже є у цьому списку');
                        }
                    }
                });
            });

            e.object.render().find('.full-start__buttons').append(btn);
        }
    });

    Lampa.Component.add('custom_bookmarks', CustomBookmarks);

    if (window.appready) addSettings();
    else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type == 'ready') addSettings();
        });
    }

})();
