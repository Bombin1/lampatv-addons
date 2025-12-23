(function(){
    if (typeof Lampa === 'undefined') return;

    // Створюємо простий екран з повідомленням
    Lampa.Activity.push({
        url: 'custom_bookmarks_test',
        title: 'Custom Bookmarks Test',
        component: 'list',
        items: [
            { title: '✅ Плагін працює' },
            { title: '📦 Версія Lampa: 3.1.2' },
            { title: '🧪 Готово до розширення' }
        ]
    });
})();
