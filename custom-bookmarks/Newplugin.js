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

    // Стилі
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 20px; gap: 8px; width: 100%; } \
            .folder-tile { \
                background: rgba(255, 255, 255, 0.08); \
                width: 85px; height: 50px; \
                border-radius: 6px; \
                display: flex; flex-direction: column; align-items: center; justify-content: center; \
                cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; \
            } \
            .folder-tile.focus { \
                background: #fff !important; color: #000 !important; \
                transform: scale(1.05); border-color: #fff; \
            } \
            .folder-tile__name { font-size: 0.7em; font-weight: 500; text-align: center; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; } \
            .folder-tile__count { font-size: 0.65em; opacity: 0.5; margin-top: 1px; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.2); background: transparent; } \
        </style>');
    }

    // 1. ПАПКИ В ОСНОВНОМУ РОЗДІЛІ ЗАКЛАДОК
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            var originalBookmarks = Lampa.Component.get('bookmarks');
            Lampa.Component.add('bookmarks', function (object) {
                var comp = new originalBookmarks(object);
                var originalRender = comp.render;
                comp.render = function () {
                    var html = originalRender.call(comp);
                    var folders = getFolders();
                    var container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                    if (container.length) {
                        var wrapper = $('<div class="custom-bookmarks-wrapper"></div>');
                        var createBtn = $('<div class="folder-tile folder-tile--create selector"><div class="folder-tile__name">Створити</div><div class="folder-tile__count">+</div></div>');
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
                                // Відкриття папки
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'category_full',
                                    method: 'card',
                                    card: folder.list || [],
                                    page: 1
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
                    return html;
                };
                return comp;
            }, true);
        }
    });

    // 2. АГРЕСИВНЕ ВПРОВАДЖЕННЯ В МЕНЮ (ВИПРАВЛЕНО)
    var injectToSelect = function() {
        var originalSelectShow = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            var isFav = params && params.items && params.items.some(function(i) { 
                return i.id === 'wath' || i.id === 'book' || i.id === 'like' || i.id === 'history'; 
            });

            if (isFav || (params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1))) {
                var folders = getFolders();
                var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

                if (folders.length > 0 && movie) {
                    // Очищуємо старі дублікати роздільника, якщо вони є
                    params.items = params.items.filter(function(i){ return !i.is_custom_mark; });
                    
                    params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true, is_custom_mark: true });
                    folders.forEach(function(f, i) {
                        params.items.push({
                            title: '📁 ' + f.name,
                            is_custom_folder: true,
                            is_custom_mark: true,
                            f_idx: i
                        });
                    });

                    var originalOnSelect = params.onSelect;
                    params.onSelect = function (item) {
                        if (item.is_custom_folder) {
                            var fUpdate = getFolders();
                            var target = fUpdate[item.f_idx];
                            if (!target.list) target.list = [];
                            
                            // Зберігаємо фільм як чистий об'єкт
                            var movieData = JSON.parse(JSON.stringify(movie));
                            
                            if (!target.list.some(function(m) { return m.id == movieData.id; })) {
                                target.list.push(movieData);
                                saveFolders(fUpdate);
                                Lampa.Noty.show('Додано в: ' + target.name);
                            } else {
                                Lampa.Noty.show('Вже є в цій папці');
                            }
                        } else if (originalOnSelect) {
                            originalOnSelect(item);
                        }
                    };
                }
            }
            originalSelectShow.call(Lampa.Select, params);
        };
    };

    // Запускаємо впровадження
    injectToSelect();

})();
