(function () {
    'use strict';

    Lampa.Platform.tv();

    if (Lampa.Manifest.app_digital >= 300) {
        /**
         * Клас для роботи з папкою закладок
         */
        function BookmarksFolder(data, params = {}) {
            this.data = data;
            this.params = params;
            this.card = this.data.length ? this.data[0] : {};

            this.render = function () {
                this.folder = Lampa.Template.js('bookmarks_folder');
                this.folder.querySelector('.bookmarks-folder__title').innerText =
                    Lampa.Lang.translate('bookmarks_folder') + params.media;

                this.folder.querySelector('.bookmarks-folder__num').innerText = this.data.length;

                this.folder.addEventListener('hover:focus', () => {
                    if (this.onFocus) this.onFocus(this.folder, this.card);
                });

                this.folder.addEventListener('hover:touch', () => {
                    if (this.onTouch) this.onTouch(this.folder, this.card);
                });

                this.folder.addEventListener('hover:hover', () => {
                    if (this.onHover) this.onHover(this.folder, this.card);
                });

                this.folder.addEventListener('hover:enter', () => {
                    Lampa.Activity.push({
                        url: '',
                        title: params.title + ' - ' + Lampa.Lang.translate('bookmarks_folder' + params.media),
                        component: 'bookmarks',
                        type: params.category,
                        filter: params.media,
                        page: 1
                    });
                });
            };

            this.image = function (src, index) {
                let img = document.createElement('img');
                img.classList.add('card__img', 'i-' + index);
                img.onload = () => this.folder.classList.add('card--loaded');
                img.onerror = () => { img.src = './img/img_broken.svg'; };
                this.folder.querySelector('.bookmarks-folder__body').append(img);
                img.src = src;
            };

            this.visible = function () {
                let visible = this.data.filter(c => c.poster_path).slice(0, 3);
                visible.forEach((card, i) => {
                    this.image(Lampa.Api.poster(card.poster_path), i);
                });
                if (visible.length === 0) this.image('./img/img_load.svg');
                if (this.onVisible) this.onVisible(this.folder, data);
            };

            this.destroy = function () {
                this.folder.remove();
            };

            this.render();
        }

        /**
         * Клас для роботи з типами закладок
         */
        function BookmarksManager() {
            let cache = [];

            this.getFavorite = function () {
                let fav = Lampa.Storage.get('bookmarks', {});
                fav.card = fav.card || [];
                fav.customTypes = fav.customTypes || {};
                cache = this.getCards(fav);
                return fav;
            };

            this.getTypesWithoutSystem = function (fav) {
                return Object.keys(fav.customTypes || {}).filter(t => t !== 'card');
            };

            this.getCards = function (fav) {
                fav = fav || this.getFavorite();
                cache = this.getTypesWithoutSystem(fav).reduce((acc, type) => {
                    let uid = fav.customTypes[type];
                    if (fav.hasOwnProperty(uid)) acc = acc.concat(fav[uid]);
                    return acc;
                }, []);
                return cache;
            };

            this.createType = function (name) {
                let fav = this.getFavorite();
                if (fav.customTypes[name]) throw new Error('custom.fav.name-used');
                let uid = Lampa.Utils.uid(8).toLowerCase();
                fav.customTypes[name] = uid;
                fav[uid] = [];
                Lampa.Storage.set('bookmarks', fav);
                Lampa.Favorite.init();
                return { name, uid, counter: 0 };
            };

            this.renameType = function (oldName, newName) {
                let fav = this.getFavorite();
                let uid = fav.customTypes[oldName];
                if (!uid) throw new Error('custom.fav.not-defined');
                if (fav.customTypes[newName]) throw new Error('custom.fav.name-used');
                fav.customTypes[newName] = uid;
                delete fav.customTypes[oldName];
                Lampa.Storage.set('bookmarks', fav);
                Lampa.Favorite.init();
                return true;
            };

            this.removeType = function (name) {
                let fav = this.getFavorite();
                let uid = fav.customTypes[name];
                if (!uid) throw new Error('custom.fav.not-defined');
                delete fav.customTypes[name];
                delete fav[uid];
                Lampa.Storage.set('bookmarks', fav);
                Lampa.Favorite.init();
                return true;
            };

            this.getTypeList = function (name) {
                let fav = this.getFavorite();
                let uid = fav.customTypes[name];
                if (!uid) throw new Error('custom.fav.not-defined');
                return fav[uid] || [];
            };

            this.toggleCard = function (name, card) {
                let fav = this.getFavorite();
                let uid = fav.customTypes[name];
                if (!uid) throw new Error('custom.fav.not-defined');
                let list = fav[uid] || [];
                fav[uid] = list;

                if (list.indexOf(card.id) === -1) {
                    Lampa.Arrays.insert(list, 0, card.id);
                } else {
                    Lampa.Arrays.remove(list, card.id);
                }

                Lampa.Storage.set('bookmarks', fav);
                Lampa.Favorite.init();
                return { name, uid, counter: list.length };
            };
        }

        let manager = new BookmarksManager();

        // Реєстрація кнопок, меню та інтеграція у Lampa
        // ...
    }
})();
