(function () {
    'use strict';

    function CustomBookmarks() {
        // 1. Створюємо масив для власних категорій у сховищі, якщо його немає
        if (!Lampa.Storage.get('custom_bookmarks_list')) {
            Lampa.Storage.set('custom_bookmarks_list', []);
        }

        // 2. Функція для додавання фільму в категорію
        this.addToFile = function (categoryName, movieData) {
            let bookmarks = Lampa.Storage.get('custom_bookmarks_data', {});
            if (!bookmarks[categoryName]) bookmarks[categoryName] = [];
            
            // Перевірка на дублікати
            if (!bookmarks[categoryName].find(m => m.id === movieData.id)) {
                bookmarks[categoryName].push(movieData);
                Lampa.Storage.set('custom_bookmarks_data', bookmarks);
                Lampa.Noty.show('Додано в ' + categoryName);
            }
        };

        // 3. Додаємо пункт у меню картки фільму
        Lampa.Listener.follow('full', (e) => {
            if (e.type === 'complite') {
                let btn = $('<div class="full-start__button button--book-custom"><span>Свої закладки</span></div>');
                
                btn.on('click', () => {
                    this.openCategorySelector(e.data);
                });

                e.object.render().find('.full-start__buttons').append(btn);
            }
        });
    }

    // Реєстрація плагіна
    if (window.appready) {
        new CustomBookmarks();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') new CustomBookmarks();
        });
    }
})();
