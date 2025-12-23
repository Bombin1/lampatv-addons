function () {
    'use strict';

    // Ключ для збереження у Storage
    var STORAGE_KEY = 'custom_bookmarks';

    // Отримати список закладок
    function getBookmarks() {
        return Lampa.Storage.get(STORAGE_KEY, '[]');
    }

    // Зберегти список закладок
    function saveBookmarks(list) {
        Lampa.Storage.set(STORAGE_KEY, list);
    }

    // Додати нову закладку
    function addBookmark(title, url) {
        var list = getBookmarks();
        list.push({ title: title, url: url });
        saveBookmarks(list);
    }

    // Видалити закладку
    function removeBookmark(index) {
        var list = getBookmarks();
        list.splice(index, 1);
        saveBookmarks(list);
    }

    // Побудувати екран закладок
    function showBookmarks() {
        var list = getBookmarks();

        Lampa.Activity.push({
            url: 'custom_bookmarks',
            title: 'Закладки',
            component: 'list',
            items: list.map(function(item, i){
                return {
                    title: item.title,
                    subtitle: item.url,
                    // При натисканні відкриваємо діалог видалення
                    onClick: function(){
                        Lampa.Dialog.confirm({
                            title: 'Видалити закладку?',
                            subtitle: item.title,
                            onYes: function(){
                                removeBookmark(i);
                                showBookmarks(); // оновити екран
                            }
                        });
                    }
                };
            })
        });
    }

    // Реєструємо пункт меню
    Lampa.Menu.add({
        id: 'custom_bookmarks',
        title: 'Закладки'
    }, function(){
        showBookmarks();
    });

    // Для тесту: додаємо одну закладку при першому запуску
    if (getBookmarks().length === 0) {
        addBookmark('Приклад закладки', 'https://example.com');
    }

    console.log('✅ Custom Bookmarks plugin loaded');
}
