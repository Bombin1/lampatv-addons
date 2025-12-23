(function () {
    'use strict';

    if (!window.Lampa) return;

    const STORAGE_KEY = 'custom_folders_v1';

    function load() {
        return Lampa.Storage.get(STORAGE_KEY, {});
    }

    function save(data) {
        Lampa.Storage.set(STORAGE_KEY, data);
    }

    function getFolders() {
        return load();
    }

    function createFolder(name) {
        const data = load();
        if (!data[name]) data[name] = [];
        save(data);
    }

    function addToFolder(folder, card) {
        const data = load();
        if (!data[folder]) data[folder] = [];

        if (!data[folder].find(i => i.id === card.id)) {
            data[folder].push(card);
            save(data);
        }
    }

    /* ===== ГОЛОВНЕ МЕНЮ (Мої) ===== */

    Lampa.Listener.follow('menu', function (event) {
        if (event.type !== 'build') return;
        if (event.name !== 'my') return;

        const data = getFolders();

        event.items.push({
            title: '+ Створити папку',
            type: 'action',
            action: function () {
                Lampa.Input.show({
                    title: 'Назва папки',
                    value: '',
                    onSubmit: function (value) {
                        if (!value) return;
                        createFolder(value);
                        Lampa.Activity.replace();
                    }
                });
            }
        });

        Object.keys(data).forEach(folder => {
            event.items.push({
                title: folder,
                counter: data[folder].length + ' / 500',
                type: 'folder',
                onSelect: function () {
                    Lampa.Activity.push({
                        title: folder,
                        component: 'custom_folder',
                        data: {
                            title: folder,
                            items: data[folder]
                        }
                    });
                }
            });
        });
    });

    /* ===== ВІДОБРАЖЕННЯ ПАПКИ ===== */

    Lampa.Component.add('custom_folder', {
        template: function () {
            return '<div class="items"></div>';
        },
        onCreate: function () {
            const items = this.data.items || [];
            Lampa.Template.get('items').render(items, this.el.find('.items'));
        }
    });

    /* ===== КНОПКА В КАРТЦІ ФІЛЬМУ ===== */

    Lampa.Listener.follow('full', function (event) {
        if (event.type !== 'build') return;

        event.buttons.unshift({
            title: 'В папку',
            svg: '<svg viewBox="0 0 24 24"><path d="M10 4H2v16h20V6H12l-2-2z"/></svg>',
            action: function () {
                const folders = Object.keys(getFolders());

                if (!folders.length) {
                    Lampa.Noty.show('Спочатку створи папку');
                    return;
                }

                Lampa.Select.show({
                    title: 'Вибери папку',
                    items: folders.map(name => ({
                        title: name,
                        folder: name
                    })),
                    onSelect: function (a) {
                        addToFolder(a.folder, event.data);
                        Lampa.Noty.show('Додано в "' + a.folder + '"');
                    }
                });
            }
        });
    });

})();
