(function(){
    if (typeof Lampa === 'undefined') return;

    Lampa.Menu.add({
        id: 'custom_bookmarks',
        title: 'Закладки'
    }, function(){
        Lampa.Activity.push({
            url: 'custom_bookmarks',
            title: 'Закладки',
            component: 'list',
            items: [
                { title: '✅ Плагін працює' },
                { title: '📌 Меню додано' }
            ]
        });
    });

    console.log('✅ Custom Bookmarks plugin initialized');
})();
