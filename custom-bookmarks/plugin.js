(function () {
    'use strict';

    function CustomBookmarksInFavorites() {
        var items = [];
        
        var load = function() {
            try {
                items = JSON.parse(Lampa.Storage.get('custom_bookmarks_items', '[]'));
            } catch(e) { 
                items = []; 
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_items', JSON.stringify(items));
        };

        load();

        // 1. Кнопка в картці фільму для вибору категорії
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object.render();
                var container = render.find('.full-start__buttons');
                
                if (container.length && !render.find('.button--custom-bookmarks').length) {
                    var btn = $('<div class="full-start__button selector button--custom-bookmarks"><span>Додати в категорію</span></div>');
                    
                    btn.on('click', function () {
                        var menu = [{ title: ' + Нова категорія', action: 'create' }];
                        items.forEach(function(cat, i) { 
                            menu.push({ title: cat.name, action: 'add', index: i }); 
                        });

                        Lampa.Select.show({
                            title: 'Оберіть категорію',
                            items: menu,
                            onSelect: function (a) {
                                if (a.action === 'create') {
                                    Lampa.Input.edit({ value: '', title: 'Назва' }, function (name) {
                                        if (name) {
                                            items.push({ name: name, list: [e.data] });
                                            save();
                                            Lampa.Noty.show('Створено та додано');
                                        }
                                    });
                                } else {
                                    var category = items[a.index];
                                    if (!category.list) category.list = [];
                                    if (!category.list.find(function(m){ return m.id == e.data.id })) {
                                        category.list.push(e.data);
                                        save();
                                        Lampa.Noty.show('Додано в ' + category.name);
                                    }
                                }
                            }
                        });
                    });
                    container.append(btn);
                }
            }
        });

        // 2. Інтеграція у стандартне меню "Вибране" (bookmarks)
        Lampa.Listener.follow('activity', function (e) {
            // Перевіряємо, чи відкрився компонент закладок
            if (e.type === 'start' && e.component === 'bookmarks') {
                var render = e.object.render();
                load(); // Оновлюємо дані

                if (items.length > 0) {
                    // Додаємо наші категорії в кінець стандартного списку закладок
                    items.forEach(function(cat) {
                        if (cat.list && cat.list.length > 0) {
                            var row = $('<div class="category-list"><div class="category-title" style="padding: 20px 40px; font-size: 1.5em; color: #fff; font-weight: bold;">' + cat.name + '</div><div class="category-items" style="display: flex; flex-wrap: wrap; padding: 0 40px;"></div></div>');
                            
                            cat.list.forEach(function(movie) {
                                var card = Lampa.Template.get('card', movie);
                                card.addClass('selector');
                                
                                card.on('click', function() {
                                    Lampa.Activity.push({
                                        url: movie.url, title: movie.title || movie.name, component: 'full', id: movie.id, method: movie.name ? 'tv' : 'movie', card: movie
                                    });
                                });

                                // Довге натискання для видалення
                                card.on('hover:long', function() {
                                    Lampa.Select.show({
                                        title: 'Дія',
                                        items: [{title: 'Видалити з категорії', action: 'delete'}],
                                        onSelect: function() {
                                            cat.list = cat.list.filter(function(m) { return m.id !== movie.id });
                                            save();
                                            Lampa.Noty.show('Видалено');
                                            card.remove(); // Видаляємо візуально
                                        }
                                    });
                                });

                                row.find('.category-items').append(card);
                            });
                            
                            // Вставляємо наш рядок у контейнер стандартних закладок
                            render.append(row);
                        }
                    });
                    
                    // Оновлюємо контролер, щоб пульт бачив нові елементи
                    Lampa.Controller.enable('content');
                }
            }
        });
    }

    if (window.appready) CustomBookmarksInFavorites();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') CustomBookmarksInFavorites(); });
})();
