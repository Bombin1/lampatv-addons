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

    // Оновлені стилі (вигляд як стокові папки)
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append('<style id="custom-bookmarks-styles"> \
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 12px 15px; gap: 12px; width: 100%; } \
            .folder-tile { \
                position: relative; \
                background: rgba(255, 255, 255, 0.07); \
                width: 150px; height: 85px; \
                border-radius: 10px; \
                display: flex; flex-direction: column; align-items: center; justify-content: center; \
                cursor: pointer; transition: all 0.2s ease; \
                border: 1px solid rgba(255, 255, 255, 0.05); \
            } \
            .folder-tile.focus { \
                background: #fff !important; color: #000 !important; \
                transform: scale(1.05); box-shadow: 0 10px 20px rgba(0,0,0,0.4); \
            } \
            .folder-tile__name { font-size: 0.9em; font-weight: 500; text-align: center; padding: 0 8px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; width: 100%; } \
            .folder-tile__count { font-size: 0.7em; opacity: 0.5; margin-top: 4px; } \
            .folder-tile--create { border: 2px dashed rgba(255, 255, 255, 0.15); background: transparent; } \
        </style>');
    }

    // ПЕРЕХОПЛЕННЯ КОМПОНЕНТА CATEGORY_FULL (це те, що ми робили не так)
    var originalCategoryFull = Lampa.Component.get('category_full');
    Lampa.Component.add('category_full', function (object) {
        var comp = new originalCategoryFull(object);
        
        // Якщо це наша папка, ми підміняємо метод завантаження даних
        if (object.is_custom_folder) {
            comp.render = function () {
                // Викликаємо оригінальний рендер, але з нашими даними
                comp.build(object.items);
                return comp.content();
            };
        }
        return comp;
    }, true);

    // 1. ІНТЕГРАЦІЯ В ЗАКЛАДКИ
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
                                // ПРАВИЛЬНИЙ ЗАПУСК: Передаємо прапорець і список через items
                                Lampa.Activity.push({
                                    title: folder.name,
                                    component: 'category_full',
                                    is_custom_folder: true,
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

    // 2. ДОДАВАННЯ В ПАПКИ (НОРМАЛІЗАЦІЯ)
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
                        
                        var cleanCard = {
                            id: movie.id,
                            title: movie.title || movie.name,
                            original_title: movie.original_title || movie.original_name,
                            release_date: movie.release_date || movie.first_air_date,
                            poster_path: movie.poster_path || movie.poster,
                            img: movie.img || movie.poster_path || movie.poster,
                            type: movie.type || (movie.name ? 'tv' : 'movie'),
                            vote_average: movie.vote_average
                        };
                        
                        if (!target.list.some(function(m) { return m.id == cleanCard.id; })) {
                            target.list.push(cleanCard);
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
