(function () {
    'use strict';

    function CustomFoldersExtension() {
        var folders = [];
        
        var load = function() {
            try {
                folders = JSON.parse(Lampa.Storage.get('custom_bookmarks_folders', '[]'));
            } catch(e) { folders = []; }
        };

        var save = function() {
            try {
                Lampa.Storage.set('custom_bookmarks_folders', JSON.stringify(folders));
            } catch(e) {
                Lampa.Noty.show('Помилка збереження: ' + e.message);
            }
        };

        load();

        // 1. СТИЛІ ДЛЯ ТАЙЛІВ (ПЛИТОК)
        if (!$('#custom-folders-styles').length) {
            $('body').append('<style id="custom-folders-styles"> \
                .bookmarks-folders-wrapper { display: flex; flex-wrap: wrap; padding: 20px 20px 10px; gap: 15px; width: 100%; } \
                .bookmarks-folder-tile { \
                    background: rgba(255, 255, 255, 0.07); \
                    width: 180px; height: 100px; \
                    border-radius: 12px; \
                    display: flex; \
                    flex-direction: column; \
                    align-items: center; \
                    justify-content: center; \
                    cursor: pointer; \
                    border: 2px solid transparent; \
                    transition: all 0.2s ease; \
                    position: relative; \
                    overflow: hidden; \
                } \
                .bookmarks-folder-tile.focus { \
                    background: #fff !important; \
                    color: #000 !important; \
                    transform: scale(1.05); \
                    border-color: #fff; \
                } \
                .bookmarks-folder-tile__title { \
                    font-size: 1.1em; \
                    font-weight: 500; \
                    text-align: center; \
                    padding: 0 10px; \
                    z-index: 2; \
                } \
                .bookmarks-folder-tile__count { \
                    font-size: 1.3em; \
                    opacity: 0.5; \
                    margin-top: 5px; \
                    z-index: 2; \
                } \
                .bookmarks-folder-tile--create { \
                    border: 2px dashed rgba(255, 255, 255, 0.2); \
                    background: transparent; \
                } \
                .bookmarks-folder-tile--create .bookmarks-folder-tile__count { \
                    opacity: 1; font-size: 1.8em; \
                } \
            </style>');
        }

        // Функція створення візуального тайлу
        var createTile = function(folder, index, isCreate) {
            var tile = $('<div class="bookmarks-folder-tile selector' + (isCreate ? ' bookmarks-folder-tile--create' : '') + '"> \
                <div class="bookmarks-folder-tile__title">' + (isCreate ? 'Створити' : folder.name) + '</div> \
                <div class="bookmarks-folder-tile__count">' + (isCreate ? '+' : (folder.list ? folder.list.length : 0)) + '</div> \
            </div>');

            if (isCreate) {
                tile.on('click', function() {
                    Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name) {
                        if (name) {
                            folders.push({name: name, list: []});
                            save();
                            Lampa.Activity.replace(); // Повне оновлення для правильної побудови сітки
                        }
                    });
                });
            } else {
                tile.on('click', function() {
                    Lampa.Activity.push({
                        title: folder.name,
                        component: 'category_full',
                        card: folder.list || [],
                        page: 1
                    });
                });

                tile.on('hover:long', function() {
                    Lampa.Select.show({
                        title: folder.name,
                        items: [{title: 'Видалити папку', action: 'delete'}],
                        onSelect: function() {
                            folders.splice(index, 1);
                            save();
                            Lampa.Activity.replace();
                        }
                    });
                });
            }
            return tile;
        };

        // 2. ІНТЕГРАЦІЯ В BOOKMARKS
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                var originalBookmarks = Lampa.Component.get('bookmarks');
                
                Lampa.Component.add('bookmarks', function (object) {
                    var comp = new originalBookmarks(object);
                    var originalRender = comp.render;

                    comp.render = function () {
                        var html = originalRender.call(comp);
                        load();

                        var container = html.find('.category-full, .bookmarks-list, .scroll__content').first();
                        
                        if (container.length) {
                            var wrapper = $('<div class="bookmarks-folders-wrapper"></div>');
                            
                            // Плитка "Створити"
                            wrapper.append(createTile(null, null, true));

                            // Існуючі папки
                            folders.forEach(function(folder, index) {
                                wrapper.append(createTile(folder, index, false));
                            });

                            container.prepend(wrapper);
                        }
                        return html;
                    };
                    return comp;
                }, true);
            }
        });

        // 3. МЕНЮ ВИБОРУ В КАРТЦІ (БЕЗ ЗМІН)
        var originalSelect = Lampa.Select.show;
        Lampa.Select.show = function(params) {
            if (params.title === Lampa.Lang.translate('title_book')) {
                load();
                folders.forEach(function(f, i) {
                    params.items.push({ title: f.name, is_custom: true, f_idx: i });
                });
                params.items.push({ title: ' + Створити папку', is_new: true });

                var originalOnSelect = params.onSelect;
                params.onSelect = function(item) {
                    var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;
                    if (item.is_new) {
                        Lampa.Input.edit({value: '', title: 'Назва папки'}, function(name){
                            if(name) { folders.push({name: name, list: [movie]}); save(); Lampa.Noty.show('Створено'); }
                        });
                    } else if (item.is_custom) {
                        var folder = folders[item.f_idx];
                        if (!folder.list) folder.list = [];
                        folder.list.push(movie); 
                        save(); 
                        Lampa.Noty.show('Додано в ' + folder.name); 
                    } else originalOnSelect(item);
                };
            }
            originalSelect.call(Lampa.Select, params);
        };
    }

    CustomFoldersExtension();
})();
