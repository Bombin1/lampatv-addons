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
    }

    // СТИЛІ (Розмір зменшено на 1/3)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 12px 15px; gap: 8px; width: 100%; } \
            .folder-tile { \
                position: relative; \
                background: rgba(255, 255, 255, 0.07); \
                width: 100px; height: 56px; \
                border-radius: 8px; \
                display: flex; flex-direction: column; align-items: center; justify-content: center; \
                cursor: pointer; transition: all 0.2s ease; \
                border: 1px solid rgba(255, 255, 255, 0.05); \
            } \
            .folder-tile.focus { \
                background: #fff !important; color: #000 !important; \
                transform: scale(1.05); \
            } \
            .folder-tile__name { font-size: 0.75em; font-weight: 500; text-align: center; padding: 0 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; } \
            .folder-tile__count { font-size: 0.6em; opacity: 0.5; margin-top: 2px; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.15); background: transparent; } \
        </style>');
    }

    // 1. КОМПОНЕНТ РЕНДЕРУ
    Lampa.Component.add('custom_folder_component', function (object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var last_focus;

        this.create = function () {
            var self = this;
            this.activity.loader(false);

            if (object.items && object.items.length) {
                object.items.forEach(function (data) {
                    var card = new Lampa.Card(data, {
                        card_category: true,
                        is_static: true
                    });
                    
                    card.create();
                    
                    card.onFocus = function (target) {
                        last_focus = target;
                        scroll.update(card.render());
                    };
                    
                    card.onEnter = function () {
                        Lampa.Activity.push({
                            url: data.url || '',
                            component: 'full',
                            id: data.id,
                            method: data.name ? 'tv' : 'movie',
                            card: data,
                            source: data.source || 'tmdb'
                        });
                    };
                    
                    body.append(card.render());
                    items.push(card);
                });
                
                scroll.append(body);
                html.append(scroll.render());
            } else {
                html.append('<div class="empty">Тут порожньо</div>');
            }
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    if (items.length) {
                        Lampa.Controller.collectionSet(scroll.render());
                        Lampa.Controller.collectionFocus(last_focus || items[0].render());
                    } else {
                        Lampa.Controller.toggle('empty');
                    }
                },
                left: function () { Lampa.Controller.toggle('menu'); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () { return html; };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () {
            items.forEach(function (item) { item.destroy(); });
            scroll.destroy();
            items = [];
            html.remove();
        };
    });

    // 2. ІНТЕГРАЦІЯ В ЗАКЛАДКИ
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;

                comp.render = function () {
                    var view = originalRender.call(comp);
                    var folders = getFolders();
                    var container = view.find('.category-full, .bookmarks-list, .scroll__content').first();
                    
                    if (container.length) {
                        var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                        
                        var createBtn = $('<div class="folder-tile folder-tile--create selector"><div class="folder-tile__name">Створити</div></div>');
                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f);
                                    Lampa.Activity.replace();
                                }
                            });
                        });
                        wrapper.append(createBtn);

                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector"><div class="folder-tile__name">' + folder.name + '</div><div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + ' шт.</div></div>');
                            tile.on('click', function() {
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'custom_folder_component',
                                    items: folder.list || []
                                });
                            });
                            tile.on('hover:long', function() {
                                Lampa.Select.show({
                                    title: folder.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: function() {
                                        var f = getFolders();
                                        f.splice(i, 1);
                                        saveFolders(f);
                                        Lampa.Activity.replace();
                                    }
                                });
                            });
                            wrapper.append(tile);
                        });
                        container.prepend(wrapper);
                    }
                    return view;
                };
                return comp;
            }, true);
        }
    });

    // 3. ДОДАВАННЯ (БЕЗ ПОВІДОМЛЕНЬ ТА ЕМОДЗІ)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFav = params && params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });

        if (isFav || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;

            if (folders.length > 0 && movie) {
                params.items.push({ title: 'ПАПКИ', separator: true });
                folders.forEach(function(f, i) {
                    params.items.push({ title: f.name, is_custom: true, f_idx: i }); // Емодзі прибрано
                });

                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        
                        var movieToSave = Object.assign({}, movie);
                        
                        if (!target.list.some(function(m) { return m.id == movieToSave.id; })) {
                            target.list.push(movieToSave);
                            saveFolders(fUpdate);
                            // Повідомлення Noty видалено
                        }
                    } else if (originalOnSelect) {
                        originalOnSelect(item);
                    }
                };
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };
})();
