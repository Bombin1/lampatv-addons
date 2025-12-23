(function () {
    'use strict';

    if (!window.Lampa) return;

    var STORAGE_KEY = 'custom_bookmarks_folders';

    // 1. Функції роботи з даними
    function getFolders() {
        try {
            var data = window.localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    function saveFolders(folders) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    }

    // 2. Стилі (мінімалістичні та стабільні)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 20px; gap: 8px; width: 100%; } \
            .folder-tile { background: rgba(255, 255, 255, 0.08); width: 90px; height: 55px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border: 1px solid transparent; } \
            .folder-tile.focus { background: #fff !important; color: #000 !important; transform: scale(1.05); } \
            .folder-tile__name { font-size: 0.7em; font-weight: 500; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; padding: 0 4px; } \
            .folder-tile__count { font-size: 0.6em; opacity: 0.5; } \
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.3); } \
        </style>');
    }

    // 3. Відображення в розділі "Вибране" (Бокова панель)
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
                        
                        // Кнопка створення
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

                        // Список папок
                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector"><div class="folder-tile__name">' + folder.name + '</div><div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + ' шт.</div></div>');
                            
                            tile.on('click', function() {
                                // ✅ ТВОЯ ВИПРАВЛЕНА ЛОГІКА: використовуємо items
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'category_full',
                                    type: 'folder',
                                    items: folder.list || [],
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

    // 4. Додавання в папки з картки фільму (Перехоплення Select)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        // Перевірка, чи це меню закладок (за ID або назвою)
        var isFav = params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });
        var isTitle = params.title && (params.title.indexOf('Вибране') !== -1 || params.title.indexOf('Избранное') !== -1);

        if (isFav || isTitle) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;

            if (folders.length > 0 && movie) {
                // Додаємо пункти папок
                params.items.push({ title: '--- ПАПКИ ---', separator: true });
                folders.forEach(function(f, i) {
                    params.items.push({ title: '📁 ' + f.name, is_custom: true, f_idx: i });
                });

                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        
                        // ✅ Зберігаємо ПОВНУ картку фільму
                        var movieToSave = Object.assign({}, movie);
                        
                        if (!target.list.some(function(m) { return m.id == movieToSave.id; })) {
                            target.list.push(movieToSave);
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

})();
