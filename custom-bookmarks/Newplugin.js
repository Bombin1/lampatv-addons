(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'custom_bookmarks_folders';

    // Надійне отримання даних
    function getFolders() {
        try {
            var data = Lampa.Storage.get(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) { 
            return []; 
        }
    }

    // Надійне збереження даних
    function saveFolders(folders) {
        Lampa.Storage.set(STORAGE_KEY, JSON.stringify(folders));
    }

    // Додаємо стилі один раз
    if (!$('#custom-bookmarks-styles').length) {
        $('body').append(`<style id="custom-bookmarks-styles">
            .custom-bookmarks-wrapper { display: flex; flex-wrap: wrap; padding: 10px 20px; gap: 8px; width: 100%; }
            .folder-tile { 
                background: rgba(255, 255, 255, 0.08); 
                width: 90px; height: 55px; 
                border-radius: 6px; 
                display: flex; flex-direction: column; align-items: center; justify-content: center; 
                cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease;
            }
            .folder-tile.focus { 
                background: #fff !important; color: #000 !important; 
                transform: scale(1.05); border-color: #fff; 
            }
            .folder-tile__name { font-size: 0.75em; font-weight: 500; text-align: center; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
            .folder-tile__count { font-size: 0.7em; opacity: 0.5; margin-top: 1px; }
            .folder-tile--create { border: 1px dashed rgba(255, 255, 255, 0.2); background: transparent; }
        </style>`);
    }

    // 1. РОБОТА З ЕКРАНОМ "ВИБРАНЕ"
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

                        // Кнопка Створити
                        var createBtn = $('<div class="folder-tile folder-tile--create selector"><div class="folder-tile__name">Створити</div><div class="folder-tile__count">+</div></div>');
                        
                        createBtn.on('click', function () {
                            Lampa.Input.edit({ value: '', title: 'Назва папки' }, function (name) {
                                if (name) {
                                    var f = getFolders();
                                    f.push({ name: name, list: [] });
                                    saveFolders(f);
                                    // Повне перемалювання сторінки
                                    Lampa.Activity.replace();
                                }
                            });
                        });
                        wrapper.append(createBtn);

                        // Список папок
                        folders.forEach(function(folder, i) {
                            var tile = $('<div class="folder-tile selector"><div class="folder-tile__name">' + folder.name + '</div><div class="folder-tile__count">' + (folder.list ? folder.list.length : 0) + ' шт.</div></div>');
                            
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
                                    items: [{ title: 'Видалити папку', action: 'delete' }],
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

    // 2. РОБОТА З МЕНЮ "ВИБРАНЕ" У КАРТЦІ ФІЛЬМУ
    var originalSelectShow = Lampa.Select.show;
    Lampa.Select.show = function (params) {
        // Перевірка, чи це меню закладок
        var isFav = params.title === Lampa.Lang.translate('title_book') || 
                    (params.items && params.items.some(function(i){ return i.id === 'wath' || i.id === 'book'; }));

        if (isFav) {
            var folders = getFolders();
            var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

            if (folders.length > 0) {
                // Додаємо папки до списку
                folders.forEach(function(f, i) {
                    params.items.push({
                        title: '📁 ' + f.name,
                        custom_id: i
                    });
                });
            }

            var originalOnSelect = params.onSelect;
            params.onSelect = function (item) {
                if (typeof item.custom_id !== 'undefined') {
                    var fUpdate = getFolders();
                    var target = fUpdate[item.custom_id];
                    if (!target.list) target.list = [];
                    
                    if (!target.list.find(function(m){ return m.id == movie.id; })) {
                        target.list.push(movie);
                        saveFolders(fUpdate);
                        Lampa.Noty.show('Додано в: ' + target.name);
                    } else {
                        Lampa.Noty.show('Вже є в цій папці');
                    }
                } else {
                    originalOnSelect(item);
                }
            };
        }
        originalSelectShow.call(Lampa.Select, params);
    };

})();
