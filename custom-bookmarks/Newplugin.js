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

    // Додаємо стилі (залишаємо твої улюблені стокові)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 12px 15px; gap: 12px; width: 100%; } \
            .folder-tile { position: relative; background: rgba(255, 255, 255, 0.07); width: 150px; height: 85px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.05); } \
            .folder-tile.focus { background: #fff !important; color: #000 !important; transform: scale(1.05); } \
            .folder-tile__name { font-size: 0.9em; font-weight: 500; text-align: center; padding: 0 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; } \
            .folder-tile__count { font-size: 0.7em; opacity: 0.5; margin-top: 4px; } \
            .folder-tile--create { border: 2px dashed rgba(255, 255, 255, 0.15); background: transparent; } \
        </style>');
    }

    // 1. ПЕРЕХОПЛЕННЯ КОМПОНЕНТА (НОВИЙ ПІДХІД)
    // Ми не чіпаємо render, ми підміняємо саму функцію ініціалізації
    var originalCategoryFull = Lampa.Component.get('category_full');
    Lampa.Component.add('category_full', function (object) {
        var comp = new originalCategoryFull(object);
        
        if (object.is_custom_folder) {
            // Переписуємо метод завантаження даних
            comp.onBuild = function () {
                // Замість звернення до length об'єкта, якого немає в а-ля API, 
                // ми примусово згодовуємо йому масив
                var data = {
                    results: object.items || [],
                    page: 1,
                    total_pages: 1
                };
                
                // Викликаємо внутрішній метод побудови списку
                setTimeout(function() {
                    comp.build(data);
                }, 10);
            };
            
            // Забороняємо компоненту малювати "Тут порожньо" завчасно
            comp.empty = function() {};
        }
        return comp;
    }, true);

    // 2. ІНТЕГРАЦІЯ В ЗАКЛАДКИ
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
                                    component: 'category_full',
                                    is_custom_folder: true,
                                    items: folder.list || [],
                                    url: '', // Порожній URL, щоб не було запитів до мережі
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

    // 3. ДОДАВАННЯ (ЗБЕРЕЖЕННЯ "ЧИСТИХ" ДАНИХ)
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        var isFav = params && params.items && params.items.some(function(i) { 
            return i.id === 'wath' || i.id === 'book' || i.id === 'like'; 
        });

        if (isFav || (params.title && params.title.indexOf('Вибране') !== -1)) {
            var folders = getFolders();
            var active = Lampa.Activity.active();
            var movie = active.card || active.data;

            if (folders.length > 0 && movie) {
                params.items.push({ title: '--- МОЇ ПАПКИ ---', separator: true });
                folders.forEach(function(f, i) {
                    params.items.push({ title: '📁 ' + f.name, is_custom: true, f_idx: i });
                });

                var originalOnSelect = params.onSelect;
                params.onSelect = function (item) {
                    if (item.is_custom) {
                        var fUpdate = getFolders();
                        var target = fUpdate[item.f_idx];
                        
                        // ПОВНА копія об'єкта, щоб Lampa мала всі поля для рендеру
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
})();
