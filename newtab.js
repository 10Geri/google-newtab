'use strict';

/* ------------------------------------------------------------------ *
 * Óra
 * ------------------------------------------------------------------ */
(function clock() {
    const t = document.getElementById('clock');
    const d = document.getElementById('date');
    const tick = function () {
        const now = new Date();
        t.textContent = now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        d.textContent = now.toLocaleDateString('hu-HU', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    };
    tick();
    setInterval(tick, 10000);
})();

/* ------------------------------------------------------------------ *
 * Google keresési javaslatok
 * A lekérés csak gépelésre indul; betöltéskor semmi nem kap fókuszt,
 * így a kurzor a böngésző címsávjában marad.
 * ------------------------------------------------------------------ */
(function suggest() {
    const MAX_ITEMS = 10;
    const DEBOUNCE_MS = 120;
    const ENDPOINT = 'https://suggestqueries.google.com/complete/search';

    const wrap = document.getElementById('search');
    const form = document.getElementById('form');
    const input = document.getElementById('q');
    const list = document.getElementById('suggest');

    const ICON = 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 '
        + '3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 '
        + '5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z';

    let items = [];
    let sel = -1;
    let typed = '';
    let timer = null;
    let controller = null;

    function close() {
        list.hidden = true;
        list.textContent = '';
        wrap.classList.remove('open');
        input.setAttribute('aria-expanded', 'false');
        items = [];
        sel = -1;
    }

    function highlight() {
        const kids = list.children;
        for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('on', i === sel);
        input.value = sel >= 0 ? items[sel] : typed;
    }

    function render(words) {
        items = words.slice(0, MAX_ITEMS);
        if (!items.length) { close(); return; }
        list.textContent = '';
        items.forEach(function (word, i) {
            const li = document.createElement('li');
            li.setAttribute('role', 'option');
            li.dataset.index = String(i);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'icon');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', ICON);
            svg.appendChild(path);

            const span = document.createElement('span');
            span.textContent = word;

            li.appendChild(svg);
            li.appendChild(span);
            list.appendChild(li);
        });
        sel = -1;
        list.hidden = false;
        wrap.classList.add('open');
        input.setAttribute('aria-expanded', 'true');
    }

    function load(query) {
        if (controller) controller.abort();
        controller = new AbortController();
        const url = ENDPOINT
            + '?client=firefox'
            + '&hl=' + encodeURIComponent((navigator.language || 'hu').slice(0, 2))
            + '&q=' + encodeURIComponent(query);
        fetch(url, { signal: controller.signal })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (input.value.trim() !== query) return;   // időközben továbbgépelt
                render(Array.isArray(data) && Array.isArray(data[1]) ? data[1] : []);
            })
            .catch(function () { /* megszakítás vagy hálózati hiba: marad a mező */ });
    }

    input.addEventListener('input', function () {
        typed = input.value;
        const query = typed.trim();
        clearTimeout(timer);
        if (!query) { close(); return; }
        timer = setTimeout(function () { load(query); }, DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(); input.blur(); return; }
        if (list.hidden || !items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            sel = sel + 1 >= items.length ? -1 : sel + 1;
            highlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            sel = sel - 1 < -1 ? items.length - 1 : sel - 1;
            highlight();
        }
    });

    list.addEventListener('mousedown', function (e) {
        const li = e.target.closest('li');
        if (!li) return;
        e.preventDefault();
        input.value = items[Number(li.dataset.index)];
        form.submit();
    });

    document.addEventListener('mousedown', function (e) {
        if (!wrap.contains(e.target)) close();
    });

    form.addEventListener('submit', function () { close(); });
})();

/* ------------------------------------------------------------------ *
 * Kereső és kép helycseréje
 * Fókuszkor a kereső a kép fölé kerül, fókuszvesztéskor (kikattintás
 * vagy Esc) vissza. Az átrendezést FLIP-animáció simítja el: a régi
 * helyről csúsznak az elemek az újra.
 * ------------------------------------------------------------------ */
(function swap() {
    const DURATION_MS = 1000;
    const EASING = 'cubic-bezier(.2, .8, .2, 1)';

    const main = document.querySelector('main');
    const wrap = document.getElementById('search');
    const moving = [wrap, document.querySelector('.banner'), document.querySelector('.links')];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function setSwapped(on) {
        if (main.classList.contains('swapped') === on) return;

        // A félbeszakadt animáció aktuális (látható) helyéről indulunk tovább.
        const first = moving.map(function (el) { return el.getBoundingClientRect().top; });
        moving.forEach(function (el) {
            el.getAnimations().forEach(function (a) { a.cancel(); });
        });

        main.classList.toggle('swapped', on);
        if (reduced.matches) return;

        moving.forEach(function (el, i) {
            const dy = first[i] - el.getBoundingClientRect().top;
            if (!dy) return;
            el.animate(
                [{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }],
                { duration: DURATION_MS, easing: EASING }
            );
        });
    }

    wrap.addEventListener('focusin', function () { setSwapped(true); });
    wrap.addEventListener('focusout', function (e) {
        if (!wrap.contains(e.relatedTarget)) setSwapped(false);
    });
})();

/* ------------------------------------------------------------------ *
 * Google-alkalmazások menü (9 pötty)
 * Kattintásra nyílik/zárul; kikattintás vagy Esc bezárja.
 * ------------------------------------------------------------------ */
(function apps() {
    const wrap = document.getElementById('apps');
    const btn = document.getElementById('apps-btn');
    const panel = document.getElementById('apps-panel');

    function setOpen(on) {
        panel.hidden = !on;
        btn.setAttribute('aria-expanded', String(on));
    }

    btn.addEventListener('click', function () { setOpen(panel.hidden); });

    document.addEventListener('mousedown', function (e) {
        if (!wrap.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });
})();

/* ------------------------------------------------------------------ *
 * Tab mindig a keresőmezőbe visz
 * Az oldalon belül a Tab nem lép tovább, hanem a mezőbe ugrik. Ha a
 * fókusz kívülről (pl. a címsávból Tabbal) billentyűzettel érkezik
 * bármely más elemre, azt is a mezőre irányítjuk. Egérkattintás nem
 * :focus-visible, így a linkekre kattintás érintetlen marad.
 * ------------------------------------------------------------------ */
(function tabToSearch() {
    const input = document.getElementById('q');

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        input.focus();
    });

    document.addEventListener('focusin', function (e) {
        if (e.target !== input && e.target.matches(':focus-visible')) input.focus();
    });
})();