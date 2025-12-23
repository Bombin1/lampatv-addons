(function(){
    Extensions.add({
        name: 'custom_bookmarks',
        author: 'Bombin1',
        version: '1.0',
        description: 'Менеджер закладок',
        run: function(){
            Lampa.Menu.add({
                id: 'custom_bookmarks',
                title: 'Закладки'
            }, function(){
                Lampa.Activity.push({
                    url: 'custom_bookmarks',
                    title: 'Закладки',
                    component: 'list',
                    items: [
                        { title: '📌 Тут будуть ваші закладки' },
                        { title: '✅ Плагін працює' }
                    ]
                });
            });

            console.log('✅ Custom Bookmarks plugin initialized');
        }
    });
})();
