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
        if (window.Lampa.Cloud && window.Lampa.Cloud.is() && window.Lampa.Account.logged()) {
            window.Lampa.Cloud.set(STORAGE_KEY, folders);
            if (window.Lampa.Cloud.sync) window.Lampa.Cloud.sync();
        }
    }

    // Стилізація наших "псевдо-карток" папок
    if (!$('#custom-folders-css').length) {
        $('body').append('<style id="custom-folders-css"> \
            .card--folder .card__img { background: rgba(0,0,0,0.3) !important; border: 1px dashed rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; height: 100% !important; border-radius: 8px; } \
            .card--folder .card__title { text-align: center; padding: 5px; font-weight: bold; } \
            .card--folder-icon { font-size: 2em; color: #fff; } \
            .card--folder[style*="width: 100px"] { width: 100px !important; } \
            .card--folder .card__view { height: 70px !important; } \
        </style>');
    }

    // Компонент перегляду папки
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
                card.onFocus = function (target) { scroll.update(card.render()); };
                card.onEnter = function () { Lampa.Activity.push({ url: data.url || '', component: 'full', id: data.id, method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb' }); };
                body.append(card.render()); items.push(card);
            });
            scroll.append(body); html.append(scroll.render());
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

    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                
                // Перехоплюємо створення карток
                var originalBuild = comp.build;
                comp.build = function(data) {
                    var folders = getFolders();
                    var customItems = [];

                    // Додаємо кнопку "Створити" як першу картку
                    customItems.push({
                        title: 'Створити',
                        is_folder: true,
                        is_create: true,
                        custom_card: true
                    });

                    // Додаємо папки як картки
                    folders.forEach(function(f, i) {
                        customItems.push({
                            title: f.name + ' (' + (f.list ? f.list.length : 0) + ')',
                            is_folder: true,
                            folder_data: f,
                            folder_idx: i,
                            custom_card: true
                        });
                    });

                    // Об'єднуємо наші папки зі стандартними даними Lampa
                    if (data && data[0] && data[0].items) {
                        data[0].items = customItems.concat(data[0].items);
                    } else {
                        data.unshift({items: customItems, title: 'Папки'});
                    }

                    return originalBuild.call(comp, data);
                };

                // Модифікуємо створення об'єкта картки, щоб вона виглядала як папка
                var originalCard = Lampa.Card;
                comp.render = function() {
                    window.Lampa.Card = function(card_data, params) {
                        if (card_data.custom_card) {
                            params.is_static = true;
                            var card = new originalCard(card_data, params);
                            var originalCardCreate = card.create;
                            
                            card.create = function() {
                                originalCardCreate.call(card);
                                var render = card.render();
                                render.addClass('card--folder').css('width', '100px');
                                render.find('.card__img').html('<div class="card--folder-icon">' + (card_data.is_create ? '+' : '📁') + '</div>');
                            };

                            card.onEnter = function() {
                                if (card_data.is_create) {
                                    Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                        if (name) {
                                            var f = getFolders(); f.push({ name: name, list: [] });
                                            saveFolders(f); Lampa.Activity.replace();
                                        }
                                    });
                                } else {
                                    Lampa.Activity.push({ title: card_data.folder_data.name, component: 'custom_folder_component', items: card_data.folder_data.list || [] });
                                }
                            };

                            if (!card_data.is_create) {
                                card.onHover = function() {
                                    // Довге натискання для видалення (через меню)
                                    $(card.render()).on('contextmenu', function(e) {
                                        e.preventDefault();
                                        Lampa.Select.show({
                                            title: card_data.folder_data.name,
                                            items: [{ title: 'Видалити папку' }],
                                            onSelect: function() {
                                                var f = getFolders(); f.splice(card_data.folder_idx, 1);
                                                saveFolders(f); Lampa.Activity.replace();
                                            }
                                        });
                                    });
                                };
                            }
                            return card;
                        }
                        return new originalCard(card_data, params);
                    };

                    var view = comp.render_default ? comp.render_default() : $('<div></div>');
                    // Повертаємо оригінальний конструктор картки після рендеру
                    setTimeout(function() { window.Lampa.Card = originalCard; }, 0);
                    return view;
                };

                return comp;
            }, true);
        }
    });

    // Меню додавання
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFavMenu = params && params.items && params.items.some(function(i) { return i.id === 'wath' || i.id === 'book' || i.id === 'like'; });
        if (isFavMenu || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;
            if (folders.length > 0 && movie) {
                params.items = params.items.filter(function(i) { return !i.is_custom; });
                folders.forEach(function(f, i) {
                    var exists = f.list.some(function(m) { return m.id == movie.id; });
                    params.items.unshift({ title: f.name, selected: exists, is_custom: true, f_idx: i });
                });
                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        var movieIdx = target.list.findIndex(function(m) { return m.id == movie.id; });
                        if (movieIdx > -1) target.list.splice(movieIdx, 1);
                        else target.list.push(JSON.parse(JSON.stringify(movie)));
                        saveFolders(fUpdate);
                        Lampa.Select.close();
                        setTimeout(function(){ Lampa.Select.show(params); }, 10);
                    } else if (originalOnSelect) { originalOnSelect(item); }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
