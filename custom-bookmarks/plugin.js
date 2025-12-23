(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'my_bookmarks_list';

    function getBookmarks() {
        return Lampa.Storage.get(STORAGE_KEY, []);
    }

    function saveBookmarks(list) {
        Lampa.Storage.set(STORAGE_KEY, list);
    }

    function addTestBookmark() {
        let list = getBookmarks();

        list.push({
            title: 'Тестова закладка ' + (list.length + 1),
            time: new Date().toLocaleString()
        });

        saveBookmarks(list);
        Lampa.Noty.show('Закладку додано');
    }

    function showBookmarks() {
        let list = getBookmarks();

        if (!list.length) {
            Lampa.Noty.show('Закладок немає');
            return;
        }

        let text = list
            .map((item, i) => `${i + 1}. ${item.title} (${item.time})`)
            .join('\n');

        Lampa.Noty.show(text);
    }

    function clearBookmarks() {
        saveBookmarks([]);
        Lampa.Noty.show('Закладки очищено');
    }

    // Додаємо компонент у налаштування
    Lampa.SettingsApi.addComponent({
        name: 'my_bookmarks',
        title: 'My Bookmarks'
    });

    // Кнопка: додати
    Lampa.SettingsApi.addParam({
        component: 'my_bookmarks',
        param: {
            name: 'add',
            type: 'button',
            text: 'Додати тестову закладку',
            onSelect: addTestBookmark
        }
    });

    // Кнопка: показати
    Lampa.SettingsApi.addParam({
        component: 'my_bookmarks',
        param: {
            name: 'show',
            type: 'button',
            text: 'Показати закладки',
            onSelect: showBookmarks
        }
    });

    // Кнопка: очистити
    Lampa.SettingsApi.addParam({
        component: 'my_bookmarks',
        param: {
            name: 'clear',
            type: 'button',
            text: 'Очистити закладки',
            onSelect: clearBookmarks
        }
    });

    console.log('[MyBookmarks] plugin loaded');
    Lampa.Noty.show('MyBookmarks: плагін завантажено');

})();
