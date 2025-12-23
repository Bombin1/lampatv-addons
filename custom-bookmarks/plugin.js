(function () {
    'use strict';

    function DeepCustomBookmarks() {
        var items = [];
        
        // Завантаження власних категорій
        var load = function() {
            try {
                items = JSON.parse(Lampa.Storage.get('custom_bookmarks_list', '[]'));
            } catch(e) { 
                items = []; 
            }
        };

        var save = function() {
            Lampa.Storage.set('custom_bookmarks_list', JSON.stringify(items));
        };

        load();

        // 1. ПЕРЕХОПЛЕННЯ МЕНЮ ВИБОРУ (Select)
        var originalSelectShow = Lampa.Select.show;

        Lampa.Select.show = function(params) {
            // Перевіряємо, чи це меню додавання в закладки (title зазвичай "Закладки")
            if (params.title === Lampa.Lang.translate('title_book')) {
                
                // Додаємо пункт створення нової категорії
                params.items.push({
                    title: ' + Створити свою категорію',
                    custom_create: true
                });

                // Додаємо існуючі власні категорії в меню
                items.forEach(function(cat, index) {
                    params.items.push({
                        title: cat.name,
                        custom_category: true,
                        custom_index: index
                    });
                });

                // Перехоплюємо вибір (onSelect)
                var originalOnSelect = params.onSelect;
                params.onSelect = function(item) {
                    var movie = Lampa.Activity.active().card || Lampa.Activity.active().data;

                    if (item.custom_create) {
                        // Логіка створення нової категорії
                        Lampa.Input.edit({
                            value: '',
                            title: 'Назва нової категорії'
                        }, function (name) {
                            if (name) {
                                items.push({ name: name, list: [movie] });
                                save();
                                Lampa.Noty.show('Категорію створено та фільм додано');
                            }
                        });
                    } else if (item.custom_category) {
                        // Додавання у вже існуючу власну категорію
                        var cat = items[item.custom_index];
                        if (!cat.list) cat.list = [];
                        
                        if (!cat.list.find(function(m){ return m.id == movie.id })) {
                            cat.list.push(movie);
                            save();
                            Lampa.Noty.show('Додано в ' + cat.name);
                        } else {
                            Lampa.Noty.show('Вже є в цій категорії');
                        }
                    } else {
                        // Якщо обрано стандартну категорію (Дивлюсь, Черга тощо)
                        originalOnSelect(item);
                    }
                };
            }
            
            // Викликаємо оригінальне вікно Select з нашими модифікаціями
            originalSelectShow.call(Lampa.Select, params);
        };

        // 2. ВІДОБРАЖЕННЯ У РОЗДІЛІ «ВИБРАНЕ»
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' && e.component === 'bookmarks') {
                var render = e.object.render();
                load();

                if (items.length > 0) {
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

                                card.on('hover:long', function() {
                                    Lampa.Select.show({
                                        title: 'Дія',
                                        items: [{title: 'Видалити з "' + cat.name + '"', action: 'delete'}],
                                        onSelect: function() {
                                            cat.list = cat.list.filter(function(m) { return m.id !== movie.id });
                                            save();
                                            Lampa.Noty.show('Видалено');
                                            card.remove();
                                        }
                                    });
                                });

                                row.find('.category-items').append(card);
                            });
                            render.append(row);
                        }
                    });
                    Lampa.Controller.enable('content');
                }
            }
        });
    }

    if (window.appready) DeepCustomBookmarks();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') DeepCustomBookmarks(); });
})();
