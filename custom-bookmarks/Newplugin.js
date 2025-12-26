(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    // 1. РОБОТА З ДАНИМИ
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
        }
    }

    // 2. СТИЛІ (Плитки + Копія системного квадратика)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 15px; gap: 8px; width: 100%; } \
            .folder-tile { \
                position: relative; \
                background-color: rgb(19, 22, 22) !important; \
                width: 118px; height: 66px; \
                border-radius: 8px; \
                display: flex; flex-direction: column; align-items: center; justify-content: center; \
                cursor: pointer; transition: all 0.2s ease; \
                border: 1px solid rgba(255, 255, 255, 0.05); \
            } \
            .folder-tile.focus { background-color: #fff !important; color: #000 !important; transform: scale(1.05); } \
            .folder-tile__name { font-size: 0.8em; font-weight: 500; text-align: center; padding: 0 5px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; color: #fff; } \
            .folder-tile.focus .folder-tile__name { color: #000; } \
            .folder-tile__count { font-size: 0.65em; opacity: 0.6; margin-top: 3px; color: #fff; } \
            .folder-tile.focus .folder-tile__count { color: #000; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.2); } \
            \
            /* Стиль рядка в меню */ \
            .custom-render-row { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 2.8em; padding: 0 4px; } \
            .custom-render-row span { font-size: 1.1em; color: #fff; } \
            .focus .custom-render-row span { color: #000; } \
            \
            /* Системний квадратик Lampa на CSS */ \
            .lampa-style-check { \
                width: 1.3em; height: 1.3em; \
                border: 2px solid rgba(255,255,255,0.2); \
                border-radius: 4px; \
                position: relative; \
                flex-shrink: 0; \
                margin-left: 15px; \
                transition: all 0.1s ease; \
            } \
            /* Коли вибрано (як "Закладки") */ \
            .lampa-style-check--active { \
                border-color: #fff; \
                background: rgba(255,255,255,0.05); \
            } \
            .lampa-style-check--active:after { \
                content: ""; \
                position: absolute; \
                left: 0.35em; top: 0.1em; \
                width: 0.4em; height: 0.75em; \
                border: solid #fff; \
                border-width: 0 2.5px 2.5px 0; \
                transform: rotate(45deg); \
            } \
            /* Стан фокусу */ \
            .focus .lampa-style-check { border-color: rgba(0,0,0,0.3); } \
            .focus .lampa-style-check--active { border-color: #000; } \
            .focus .lampa-style-check--active:after { border-color: #000; } \
        </style>');
    }

    // 3. КОМПОНЕНТ ПЕРЕГЛЯДУ ПАПКИ
    function CustomFolderComponent(object) {
        var scroll = new Lampa.Scroll({mask: true, over: true});
        var items = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var last_focus;

        this.create = function () {
            this.activity.loader(false);
            if (object.items && object.items.length) {
                object.items.forEach(function (data) {
                    var card = new Lampa.Card(data, { card_category: true, is_static: true });
                    card.create();
                    card.onFocus = function (target) { last_focus = target; scroll.update(card.render()); };
                    card.onEnter = function () {
                        Lampa.Activity.push({
                            url: data.url || '', component: 'full', id: data.id,
                            method: data.name ? 'tv' : 'movie', card: data, source: data.source || 'tmdb'
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
                    } else { Lampa.Controller.toggle('empty'); }
                },
                left: function () { Lampa.Controller.toggle('menu'); },
                up: function () { Lampa.Controller.toggle('head'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {}; this.stop = function () {};
        this.render = function () { return html; };
        this.destroy = function () {
            items.forEach(function (item) { item.destroy(); });
            scroll.destroy(); html.remove();
        };
    }
    Lampa.Component.add('custom_folder_component', CustomFolderComponent);

    // 4. МЕНЮ ВИБОРУ
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFavMenu = params && params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });

        if (isFavMenu || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
            if (!params.items.some(function(i) { return i.is_custom_item; })) {
                var folders = getFolders();
                var active = Lampa.Activity.active();
                var movie = active.card || active.data;

                if (folders.length > 0 && movie) {
                    var customItems = [];
                    
                    folders.forEach(function(f, i) {
                        var exists = f.list.some(function(m) { return m.id == movie.id; });
                        var checkClass = exists ? 'lampa-style-check lampa-style-check--active' : 'lampa-style-check';
                        var textOpacity = exists ? '1' : '0.6';
                        
                        customItems.push({ 
                            title: f.name,
                            html: '<div class="custom-render-row" style="opacity: '+textOpacity+'"> \
                                     <span>'+f.name+'</span> \
                                     <div class="'+checkClass+'"></div> \
                                   </div>',
                            is_custom_item: true, 
                            f_idx: i
                        });
                    });

                    params.items = customItems.concat(params.items);

                    var originalOnSelect = params.onSelect;
                    params.onSelect = function (item) {
                        if (item.is_custom_item) {
                            var fUpdate = getFolders();
                            var target = fUpdate[item.f_idx];
                            var movieIdx = -1;
                            for(var j=0; j < target.list.length; j++) {
                                if(target.list[j].id == movie.id) { movieIdx = j; break; }
                            }

                            if (movieIdx > -1) {
                                target.list.splice(movieIdx, 1);
                            } else {
                                target.list.push(JSON.parse(JSON.stringify(movie)));
                            }
                            
                            saveFolders(fUpdate);
                            Lampa.Select.close();
                            
                            setTimeout(function(){
                                Lampa.Select.show(params);
                            }, 10);
                        } else if (originalOnSelect) {
                            originalOnSelect(item);
                        }
                    };
                }
            }
        }
        originalSelectShow.call(Lampa.Select, params);
    };

    // 5. ІНТЕГРАЦІЯ
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
                                    saveFolders(f); Lampa.Activity.replace();
                                }
                            });
                        });
                        wrapper.append(createBtn);
                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector"><div class="folder-tile__name">' + folder.name + '</div><div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + ' шт.</div></div>');
                            tile.on('click', function() {
                                Lampa.Activity.push({ title: folder.name, component: 'custom_folder_component', items: folder.list || [] });
                            });
                            tile.on('hover:long', function() {
                                Lampa.Select.show({
                                    title: folder.name,
                                    items: [{ title: 'Видалити папку' }],
                                    onSelect: function() {
                                        var f = getFolders(); f.splice(i, 1);
                                        saveFolders(f); Lampa.Activity.replace();
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
})();
