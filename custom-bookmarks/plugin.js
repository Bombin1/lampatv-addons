(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'my_bookmarks_plugin';

    function getBookmarks() {
        return Lampa.Storage.get(STORAGE_KEY, []);
    }

    function saveBookmarks(list) {
        Lampa.Storage.set(STORAGE_KEY, list);
    }

    function addBookmark(card) {
        let list = getBookmarks();

        if (list.find(i => i.id === card.id)) return;

        list.push({
            id: card.id,
            title: card.title || card.name,
            poster: card.poster || '',
            type: card.type || 'movie'
        });

        saveBookmarks(list);
        Lampa.Noty.show('Додано в закладки');
    }

    function openBookmarks() {
        let list = getBookmarks();

        if (!list.length) {
            Lampa.Noty.show('Закладок немає');
            return;
        }

        let items = list.map(item => {
            return {
                title: item.title,
                poster: item.poster,
                onSelect: () => {
                    Lampa.Activity.push({
                        component: 'full',
                        id: item.id,
                        type: item.type
                    });
                }
            };
        });

        Lampa.Activity.push({
            title: 'Мої закладки',
            component: 'list',
            items: items
        });
    }

    // Кнопка в меню картки
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'open') {
            e.object.activity.render().find('.full__buttons').append(
                $('<div class="full__button selector">В закладки</div>')
                    .on('click', function () {
                        addBookmark(e.object.card);
                    })
            );
        }
    });

    // Пункт у головному меню
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            Lampa.Menu.add({
                title: 'Мої закладки',
                onSelect: openBookmarks
            });
        }
    });

})();
