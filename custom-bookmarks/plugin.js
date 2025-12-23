(function(){
    if (typeof Lampa === 'undefined') return;

    // Просто повідомлення у консолі
    console.log('✅ Custom Bookmarks plugin loaded');

    // Створюємо простий екран
    Lampa.Activity.push({
        url: 'custom_bookmarks_test',
        title: 'Custom Bookmarks Test',
        component: 'list',
        items: [
            { title: 'Плагін завантажився' },
            { title: 'Версія Lampa: 3.1.2' }
        ]
    });
})();
