(() => {
    'use strict';
    if (window.freshRSSPodcastPlayerLoaded) return;
    window.freshRSSPodcastPlayerLoaded = true;

    const speeds = [0.8, 1, 1.3, 1.5, 1.8, 2];
    const initialized = new WeakMap();
    const states = new Set();
    const memory = new Map();
    // Different FreshRSS installations can share a host, so include the path too.
    const prefix = `freshrss-podcast:v1:${location.pathname}:`;
    let storageAvailable = true;

    function read(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw !== null) return JSON.parse(raw);
        } catch (_) { /* Disabled storage and corrupt records must not break playback. */ }
        return memory.get(key) ?? null;
    }

    function write(key, value) {
        memory.set(key, value);
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (_) {
            storageAvailable = false;
            return false;
        }
    }

    function timestamp(seconds) {
        const total = Math.floor(seconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor(total / 60) % 60;
        const remainder = String(total % 60).padStart(2, '0');
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
    }

    function init(player) {
        if (initialized.has(player)) {
            states.add(initialized.get(player));
            return;
        }
        const audio = player.querySelector('audio');
        const controls = player.querySelector('.podcast-controls');
        if (!audio || !controls) return;

        // Only rendered article views that execute JavaScript get
        // the heading and enhanced controls.
        if (!player.querySelector('.podcast-heading')) {
            const heading = document.createElement('p');
            heading.className = 'podcast-heading';
            heading.textContent = 'Listen to this episode';
            player.insertBefore(heading, audio);
        }

        // Static markup only: no article content is interpolated.
        if (!controls.querySelector('[data-podcast-action]')) {
            controls.innerHTML = `
                <button type="button" data-podcast-action="back" disabled>
                    −15s
                </button>
                <button type="button" data-podcast-action="forward" disabled>
                    +30s
                </button>
                <button type="button" data-podcast-action="resume" disabled>
                    Resume
                </button>
                <button type="button" data-podcast-action="restart" disabled>
                    Start over
                </button>
                <label>
                    Speed
                    <select data-podcast-speed disabled>
                        <option value="0.8">0.8×</option>
                        <option value="1" selected>1×</option>
                        <option value="1.3">1.3×</option>
                        <option value="1.5">1.5×</option>
                        <option value="1.8">1.8×</option>
                        <option value="2">2×</option>
                    </select>
                </label>
                <span class="podcast-status" role="status"></span>
            `;
        }

        const button = (action) => controls.querySelector(`[data-podcast-action="${action}"]`);
        const resume = button('resume');
        const restart = button('restart');
        const back = button('back');
        const forward = button('forward');
        const select = controls.querySelector('[data-podcast-speed]');
        const status = controls.querySelector('.podcast-status');
        const progressKey = prefix + player.dataset.podcastPlayer;
        const speedKey = prefix + 'speed:' + player.dataset.podcastScope;
        const saved = read(progressKey);
        let position = saved && Number.isFinite(saved.position) && saved.position >= 0 ? saved.position : 0;
        let completed = Boolean(saved && saved.completed === true);
        let restorePending = position >= 1 && !completed;
        let touched = false;
        let lastSave = 0;
        let rate = read(speedKey);
        if (!speeds.includes(rate)) rate = 1;

        const say = (message) => {
            if (status.textContent !== message) status.textContent = message;
        };
        function update() {
            const ready = audio.readyState >= 1;
            back.disabled = forward.disabled = !ready;
            resume.disabled = position < 1 || completed;
            restart.disabled = false;
        }

        function seek(seconds) {
            if (audio.readyState < 1) return false;
            let target = Math.max(0, seconds);
            if (Number.isFinite(audio.duration)) target = Math.min(target, Math.max(0, audio.duration - 0.01));
            // Live streams can have a moving window; seek within an actual range.
            if (!Number.isFinite(audio.duration) && audio.seekable.length) {
                target = Math.max(audio.seekable.start(0), Math.min(target, audio.seekable.end(audio.seekable.length - 1)));
            }
            try {
                audio.currentTime = target;
                return true;
            } catch (_) {
                say('This audio cannot seek to that position yet.');
                return false;
            }
        }

        function restore() {
            if (!restorePending) return;
            if (seek(position)) {
                restorePending = false;
                say(`Resumed at ${timestamp(audio.currentTime)}.`);
            }
        }

        function save(force = false) {
            if (!touched || restorePending || !Number.isFinite(audio.currentTime)) return;
            const now = Date.now();
            if (!force && now - lastSave < 5000) return;
            lastSave = now;
            position = completed ? 0 : Math.max(0, audio.currentTime);
            const persisted = write(progressKey, { position, completed, updatedAt: now });
            update();
            say(persisted
                ? (completed ? 'Episode finished. Start over to listen again.' : `Saved at ${timestamp(position)} on this browser.`)
                : 'Progress is temporary: browser storage is unavailable.');
        }

        function applyRate(value) {
            try {
                audio.playbackRate = value;
                audio.defaultPlaybackRate = value;
                select.value = String(value);
            } catch (_) { say('This player does not support that speed.'); }
        }

        const state = { player, audio, save };
        states.add(state);
        initialized.set(player, state);
        applyRate(rate);
        select.disabled = false;
        select.addEventListener('change', () => {
            const value = Number(select.value);
            if (!speeds.includes(value)) return;
            rate = value;
            applyRate(value);
            if (!write(speedKey, value)) say('Speed is temporary: browser storage is unavailable.');
        });

        back.setAttribute('aria-label', 'Rewind 15 seconds');
        forward.setAttribute('aria-label', 'Forward 30 seconds');
        for (const [control, offset] of [[back, -15], [forward, 30]]) {
            control.addEventListener('click', () => {
                restorePending = false;
                touched = true;
                completed = false;
                if (seek(audio.currentTime + offset)) save(true);
            });
        }
        resume.addEventListener('click', () => {
            restorePending = true;
            touched = true;
            restore();
            // Keep play() inside the user's gesture, including for preload="none".
            const promise = audio.play();
            if (promise) promise.catch(() => say('Press play on the audio player to continue.'));
        });
        restart.addEventListener('click', () => {
            restorePending = false;
            completed = false;
            touched = true;
            position = 0;
            // A zero default playback position is valid even before metadata loads.
            try { audio.currentTime = 0; } catch (_) { /* The initial position is already zero. */ }
            save(true);
        });

        audio.addEventListener('loadedmetadata', () => { applyRate(rate); restore(); update(); });
        audio.addEventListener('canplay', restore);
        audio.addEventListener('play', () => {
            for (const other of states) {
                if (other.audio !== audio && !other.audio.paused) other.audio.pause();
            }
            touched = true;
            completed = false;
            restore();
        });
        audio.addEventListener('timeupdate', () => save());
        audio.addEventListener('pause', () => save(true));
        audio.addEventListener('seeked', () => {
            // Native seek controls must update progress as well as our buttons.
            touched = true;
            completed = false;
            save(true);
        });
        audio.addEventListener('ended', () => { touched = true; completed = true; restorePending = false; save(true); });
        audio.addEventListener('error', () => say('Unable to load audio. Try its original download link below.'));
        controls.hidden = false;
        update();
        if (completed) say('Episode finished. Start over to listen again.');
        else if (restorePending) say(`Saved at ${timestamp(position)}. Playback will resume there.`);
        else say('Your place is saved in this browser as you listen.');
        if (!storageAvailable) say('Progress is temporary: browser storage is unavailable.');
        restore();
    }

    function scan(root) {
        if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;
        if (root.matches && root.matches('[data-podcast-player]')) init(root);
        root.querySelectorAll('[data-podcast-player]').forEach(init);
    }

    function start() {
        scan(document);
        document.body.addEventListener('freshrss:load-more', () => scan(document));
        new MutationObserver((records) => {
            for (const record of records) for (const node of record.addedNodes) scan(node);
            for (const state of states) {
                if (!state.player.isConnected) {
                    state.audio.pause();
                    state.save(true);
                    states.delete(state);
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
        const flush = () => { for (const state of states) state.save(true); };
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
