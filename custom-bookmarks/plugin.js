function () {
    'use strict';

    var STORAGE_KEY = 'custom_bookmarks';

    function getBookmarks() {
        return Lampa.Storage.get(STORAGE_KEY, []);
    }

    function saveBookmarks(list) {
        Lampa.Storage.set(STORAGE_KEY, list);
    }

    function addBookmark(item) {
        var list = getBookmarks();
        list.push({ title: item.title, url: item.url });
        saveBookmarks(list);
        Lampa.Toast.show('✅ Додано в закладки');
    }

    function removeBookmark(index) {
        var list = getBookmarks();
        list.splice(index, 1);
        saveBookmarks(list);
    }

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
                    onClick: function(){
                        Lampa.Dialog.confirm({
                            title: 'Видалити закладку?',
                            subtitle: item.title,
                            onYes: function(){
                                removeBookmark(i);
                                showBookmarks();
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

    // Додаємо кнопку у картку тільки якщо API існує
    if (Lampa.Template && typeof Lampa.Template.add === 'function') {
        Lampa.Template.add('card', function(card, data){
            var btn = $('<div class="card__bookmark">⭐</div>');
            btn.css({
                position: 'absolute',
                top: '5px',
                right: '5px',
                cursor: 'pointer',
                'font-size': '20px'
            });
            btn.on('click', function(e){
                e.stopPropagation();
                addBookmark(data);
            });
            card.find('.card__view').append(btn);
        });
    } else {
        console.log('ℹ️ Template.add недоступний у цій версії Lampa');
    }

    console.log('✅ Custom Bookmarks plugin initialized');
}
