// ── Element getters ───────────────────────────────────────────────────────────
const elWpcontent               = () => document.getElementById('wpcontent');
const elTtwSettingsLoading      = () => document.querySelector('.ttr-settings-loading');
const elTtwBlacklistEntries     = () => document.getElementById('ttr-blacklist-entries');
const elTtwBlProductIdInput     = () => document.getElementById('ttr-bl-product-id-input');
const elTtwBlListTypeSelect     = () => document.getElementById('ttr-bl-list-type-select');
const elTtwBlReasonInput        = () => document.getElementById('ttr-bl-reason-input');
const elTtwBlAddStatus          = () => document.getElementById('ttr-bl-add-status');
const elTtwBlPreview            = () => document.getElementById('ttr-bl-preview');
const elTtwBlPreviewThumb       = () => document.getElementById('ttr-bl-preview-thumb');
const elTtwBlPreviewName        = () => document.getElementById('ttr-bl-preview-name');
const elTtwBlPreviewId          = () => document.getElementById('ttr-bl-preview-id');
const elTtwBlImageIdInput       = () => document.getElementById('ttr-bl-image-id-input');
const elTtwBlImageReasonInput   = () => document.getElementById('ttr-bl-image-reason-input');
const elTtwBlImageAddStatus     = () => document.getElementById('ttr-bl-image-add-status');
const elTtwTavilyKeyInput       = () => document.getElementById('ttr-tavily-key-input');
const elTtwSearchSitesTable     = () => document.getElementById('ttr-search-sites-table');
const elTestarooContent       = () => document.getElementById('testaroo-content');
const elsTtwSearchSiteRows      = () => document.querySelectorAll('#ttr-search-sites-table .ttr-search-site-row');

document.addEventListener('DOMContentLoaded', function() {
    elWpcontent().style = "background-color:black;";
    
    //Init Main Tab
    const settings = SettingsManager.getSettings();

    // If settings haven't loaded yet, wait for them
    if (Object.keys(settings).length === 0) {
        SettingsManager.loadSettings().then(() => {
            const s = SettingsManager.getSettings();
            DisableAllAutoFixMappings.init(s.disableAllAutoFixTools ?? false);
            AutoFixSmallImage.init(s.autoFixSmallImage ?? false);
            AutoFixMissingThumbnail.init(s.autoFixMissingThumbnail ?? false);
        });
        return;
    }

    DisableAllAutoFixMappings.init(settings.disableAllAutoFixTools ?? false);
    AutoFixSmallImage.init(settings.autoFixSmallImage ?? false);
    AutoFixMissingThumbnail.init(settings.autoFixMissingThumbnail ?? false);
});

const wooTabName_Main = 'main-woo';
const wooTabName_Testers = 'testaroo';
const wooTabName_Fixers = 'fix-the-woo';
const wooTabName_TestTools = 'tool-the-woo';
const wooTabName_QAAutomation = 'automate-the-woo';

var wooShown = wooTabName_Main;
function ShowWoo(whichWoo) {
    wooShown = whichWoo;
    // Hide all content panels
    document.getElementById(wooTabName_Main + '-content').style.display    = 'none';
    document.getElementById(wooTabName_Testers + '-content').style.display = 'none';
    document.getElementById(wooTabName_Fixers + '-content').style.display  = 'none';
    document.getElementById(wooTabName_TestTools + '-content').style.display  = 'none';
    document.getElementById(wooTabName_QAAutomation + '-content').style.display  = 'none';
    
    // Deselect all tabs
    document.getElementById(wooTabName_Main + '-tab').classList.remove('selected');
    document.getElementById(wooTabName_Testers + '-tab').classList.remove('selected');
    document.getElementById(wooTabName_Fixers + '-tab').classList.remove('selected');
    document.getElementById(wooTabName_TestTools + '-tab').classList.remove('selected');
    document.getElementById(wooTabName_QAAutomation + '-tab').classList.remove('selected');
    
    // Select clicked tab
    document.getElementById(`${whichWoo}-tab`).classList.add('selected');

    const contentDiv = document.getElementById(`${whichWoo}-content`);
    if (!contentDiv) return;

    // Show the panel
    contentDiv.style.display = 'block';

    // Lazy-load: only fetch once
    if (contentDiv.dataset.loaded === 'false') {
        contentDiv.dataset.loaded = 'loading'; // prevent double-fetch
        contentDiv.innerHTML = '<p>Loading...</p>';

        // Map tab id → server-side tab slug
        const tabSlugMap = {
            'testaroo': 'testers',
            'fix-the-woo':  'fixers',
            'tool-the-woo':  'qa_tools',
            'automate-the-woo':  'qa_automation',
        };
        const tabSlug = tabSlugMap[whichWoo];

        if (!tabSlug) {
            contentDiv.innerHTML = '<p>Tab not found.</p>';
            return;
        }

        fetch(TTR.ajaxUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({
                action: 'ttr_load_tab',
                nonce:  TTR.nonce,
                tab:    tabSlug,
            }),
        })
        .then(r => r.text())
        .then(html => {
            contentDiv.innerHTML      = html;
            contentDiv.dataset.loaded = 'true';

            const inits = {
                'testaroo': initTestersTab,
                'fix-the-woo':  initFixersTab,
                'tool-the-woo':  initTestToolsTab,
                'automate-the-woo':  initQAAutomationTab,
            };
            if (typeof inits[whichWoo] === 'function') {
                inits[whichWoo]();
            }
        })
        .catch(err => {
            contentDiv.innerHTML = '<p>Failed to load tab. Please refresh.</p>';
            contentDiv.dataset.loaded = 'false'; // allow retry
            console.error('TTR tab load error:', err);
        });
    }
}

// ============================================================
// Helpers
// ============================================================

function waitForElementToExist(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Briefly swap a button's label to give the user feedback
function showInlineConfirm(button, message = 'Saved!', duration = 1500) {
    const original = button.textContent;
    button.textContent = message;
    button.disabled = true;
    setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
    }, duration);
}

// ============================================================
// Settings Manager
// ============================================================

const SettingsManager = (() => {
    let settings = {};

    function seedSettings(data) {
        if (data && typeof data === 'object') settings = data;
    }

    async function loadSettings() {
        const spinner = elTtwSettingsLoading();

        const response = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_get_settings',
                nonce:  TTR.nonce,
            }),
        });

        const data = await response.json();
        spinner.style = 'display:none;';

        if (!data.success) {
            console.error('Failed to load settings:', data);
            return;
        }

        settings = data.data;
    }

    async function saveSetting(key, value) {
        const response = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_save_setting',
                nonce:  TTR.nonce,
                key,
                value:  JSON.stringify(value),
            }),
        });

        const data = await response.json();

        if (!data.success) {
            console.error(`Failed to save setting "${key}":`, data);
            return false;
        }

        settings[key] = value; // keep local state in sync
        return true;
    }

    return { loadSettings, saveSetting, getSettings: () => settings, seedSettings };
})();

// ============================================================
// Master Disable AutoFix Behaviors
// ============================================================

const DisableAllAutoFixMappings = (() => {

    const checkboxSel = '#disable-all-auto-fix-checkbox';

    function init(value) {
        waitForElementToExist(checkboxSel).then((el) => {
            el.checked = value;
            el.addEventListener('change', handleChange);
        });
    }

    function handleChange(e) {
        SettingsManager.saveSetting('disableAllAutoFixTools', e.target.checked);
    }

    return { init };
})();

const AutoFixSmallImage = (() => {
    function init(value) {
        waitForElementToExist('#auto-fix-small-image-checkbox').then((el) => {
            el.checked = value;
            el.addEventListener('change', (e) => {
                SettingsManager.saveSetting('autoFixSmallImage', e.target.checked);
            });
        });
    }
    return { init };
})();

const AutoFixMissingThumbnail = (() => {
    function init(value) {
        waitForElementToExist('#auto-fix-missing-thumbnail-checkbox').then((el) => {
            el.checked = value;
            el.addEventListener('change', (e) => {
                SettingsManager.saveSetting('autoFixMissingThumbnail', e.target.checked);
            });
        });
    }
    return { init };
})();

// ============================================================
// Boot
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // Seed both managers immediately from localized PHP data so they are
    // populated synchronously — before any tab opens and calls getSettings().
    if (typeof TTR !== 'undefined') {
        if (TTR.settings)        SettingsManager.seedSettings(TTR.settings);
        if (TTR.toolsSettings)  ToolsSettingsManager.seedSettings(TTR.toolsSettings);
    }

    // Then do a background AJAX refresh for freshness (updates if file changed on disk)
    SettingsManager.loadSettings().then(() => {
        const s = SettingsManager.getSettings();
        ttrInitTavilySettings(s);
    });
    ToolsSettingsManager.loadSettings();
});
// ============================================================
// Blacklist UI
// ============================================================

function ttrBlacklistRenderEntries() {
    var container = elTtwBlacklistEntries();
    if (!container) return;

    var testers  = (TTR && TTR.testersBlacklist)        ? TTR.testersBlacklist        : [];
    var fixers   = (TTR && TTR.fixersBlacklist)         ? TTR.fixersBlacklist         : [];
    var images   = (TTR && TTR.imagesBlacklist)         ? TTR.imagesBlacklist         : [];
    var patterns = (TTR && TTR.imagesBlacklistPatterns) ? TTR.imagesBlacklistPatterns : [];

    if (testers.length === 0 && fixers.length === 0 && images.length === 0 && patterns.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:12px;">No blacklisted items yet.</p>';
        return;
    }

    var html = '';

    // Merge testers + fixers by product_id
    var allProductIds = new Set([
        ...testers.map(e => e.product_id),
        ...fixers.map(e => e.product_id)
    ]);

    if (allProductIds.size > 0) {
        html += '<div style="font-size:11px;color:#c9a84c;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Blacklisted Products</div>';
        allProductIds.forEach(function(pid) {
            var tEntry = testers.find(e => e.product_id === pid);
            var fEntry = fixers.find(e => e.product_id === pid);
            var entry  = tEntry || fEntry;
            var name   = entry.product_name || 'Product #' + pid;
            var thumb  = entry.thumbnail_url || '';
            var editUrl = TTR.adminUrl + 'post.php?post=' + pid + '&action=edit';
            var lists  = [];
            if (tEntry) lists.push('Testers' + (tEntry.reason ? ' (' + tEntry.reason + ')' : ''));
            if (fEntry) lists.push('Fixers' + (fEntry.reason ? ' (' + fEntry.reason + ')' : ''));

            html += '<div class="ttr-bl-row">';
            if (thumb) {
                html += '<img src="' + thumb + '" class="ttr-bl-thumb">';
            } else {
                html += '<div class="ttr-bl-thumb ttr-bl-thumb-empty"></div>';
            }
            html += '<div class="ttr-bl-row-info">';
            html += '<a href="' + editUrl + '" target="_blank" class="ttr-bl-product-link">' + name + '</a>';
            html += '<div class="ttr-bl-lists">' + lists.join(' &amp; ') + '</div>';
            html += '</div>';
            html += '<div class="ttr-bl-row-actions">';
            if (tEntry) html += '<button class="ttr-bl-remove-btn" onclick="ttrBlacklistRemove(' + pid + ',\'testers\')">Remove from Testers</button>';
            if (fEntry) html += '<button class="ttr-bl-remove-btn" onclick="ttrBlacklistRemove(' + pid + ',\'fixers\')">Remove from Fixers</button>';
            html += '</div>';
            html += '</div>';
        });
    }

    if (images.length > 0) {
        html += '<div style="font-size:11px;color:#c9a84c;text-transform:uppercase;letter-spacing:1px;margin:18px 0 10px;">Blacklisted Images</div>';
        images.forEach(function(entry) {
            var aid    = entry.attachment_id;
            var url    = entry.url || '';
            var reason = entry.reason || '';
            html += '<div class="ttr-bl-row">';
            if (url) {
                html += '<img src="' + url + '" class="ttr-bl-thumb" style="object-fit:cover;">';
            } else {
                html += '<div class="ttr-bl-thumb ttr-bl-thumb-empty"></div>';
            }
            html += '<div class="ttr-bl-row-info">';
            html += '<span style="font-size:12px;color:#e8e8e8;">Attachment #' + aid + '</span>';
            if (url) html += '<div style="font-size:10px;color:#555;word-break:break-all;">' + url + '</div>';
            if (reason) html += '<div class="ttr-bl-lists">' + reason + '</div>';
            html += '</div>';
            html += '<div class="ttr-bl-row-actions">';
            html += '<button class="ttr-bl-remove-btn" onclick="ttrBlacklistRemoveImage(' + aid + ')">Remove</button>';
            html += '</div>';
            html += '</div>';
        });
    }

    // ── Pattern entries ──────────────────────────────────────────────────────
    if (patterns.length > 0) {
        html += '<div style="font-size:11px;color:#c9a84c;text-transform:uppercase;letter-spacing:1px;margin:18px 0 10px;">Blacklisted Image Patterns (partial name match)</div>';
        patterns.forEach(function(entry) {
            var pattern = entry.pattern || '';
            var reason  = entry.reason  || '';
            html += '<div class="ttr-bl-row">';
            html += '<div class="ttr-bl-thumb ttr-bl-thumb-empty" style="display:flex;align-items:center;justify-content:center;font-size:18px;color:#555;">*</div>';
            html += '<div class="ttr-bl-row-info">';
            html += '<span style="font-size:12px;color:#e8e8e8;font-style:italic;">*' + pattern + '*</span>';
            html += '<div style="font-size:10px;color:#555;">Any image URL or filename containing this substring</div>';
            if (reason) html += '<div class="ttr-bl-lists">' + reason + '</div>';
            html += '</div>';
            html += '<div class="ttr-bl-row-actions">';
            html += `<button class="ttr-bl-remove-btn" onclick="ttrBlacklistRemovePattern('${escapeHtml(pattern)}')">Remove</button>`;
            html += '</div>';
            html += '</div>';
        });
    }

    container.innerHTML = html;
}

async function ttrBlacklistAddById() {
    var idInput     = elTtwBlProductIdInput();
    var listSelect  = elTtwBlListTypeSelect();
    var reasonInput = elTtwBlReasonInput();
    var status      = elTtwBlAddStatus();
    var preview     = elTtwBlPreview();

    var productId = parseInt(idInput.value);
    if (!productId) { status.textContent = 'Please enter a valid product ID.'; return; }

    status.textContent = 'Looking up product…';

    // Fetch product info first
    var infoRes = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_blacklist_get_product_info', nonce: TTR.nonce, product_id: productId })
    });
    var infoData = await infoRes.json();
    if (!infoData.success) { status.textContent = infoData.data.message || 'Product not found.'; return; }

    var info = infoData.data;

    // Show preview
    elTtwBlPreviewThumb().src = info.thumbnail_url || '';
    elTtwBlPreviewThumb().style.display = info.thumbnail_url ? '' : 'none';
    elTtwBlPreviewName().textContent = info.product_name;
    elTtwBlPreviewId().textContent = 'ID: ' + info.product_id;
    preview.style.display = 'flex';

    // Add to blacklist
    var addRes = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:     'ttr_blacklist_add_product',
                nonce: TTR.nonce,
            product_id: productId,
            list_type:  listSelect.value,
            reason:     reasonInput.value
        })
    });
    var addData = await addRes.json();

    if (addData.success) {
        status.style.color = '#4caf50';
        status.textContent = info.product_name + ' added to ' + listSelect.value + ' blacklist.';
        idInput.value = '';
        reasonInput.value = '';
        preview.style.display = 'none';

        // Update local data and re-render
        var newEntry = { product_id: productId, product_name: info.product_name, thumbnail_url: info.thumbnail_url, reason: reasonInput.value };
        if (listSelect.value === 'testers') TTR.testersBlacklist.push(newEntry);
        else TTR.fixersBlacklist.push(newEntry);
        ttrBlacklistRenderEntries();
    } else {
        status.style.color = '#e05555';
        status.textContent = addData.data ? addData.data.message : 'Error adding to blacklist.';
    }
}

async function ttrBlacklistRemove(productId, listType) {
    var res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_blacklist_remove_product', nonce: TTR.nonce, product_id: productId, list_type: listType })
    });
    var data = await res.json();
    if (data.success) {
        if (listType === 'testers') TTR.testersBlacklist = TTR.testersBlacklist.filter(e => e.product_id !== productId);
        else TTR.fixersBlacklist = TTR.fixersBlacklist.filter(e => e.product_id !== productId);
        ttrBlacklistRenderEntries();
    }
}

async function ttrBlacklistAddImage() {
    var idInput     = elTtwBlImageIdInput();
    var reasonInput = elTtwBlImageReasonInput();
    var status      = elTtwBlImageAddStatus();

    var rawInput = idInput.value.trim();
    if (!rawInput) { status.textContent = 'Please enter an attachment ID, image URL, or partial image name.'; return; }

    status.style.color = '#888';

    // Detect whether this is a partial name (not numeric and not a URL)
    var isUrl     = rawInput.startsWith('http://') || rawInput.startsWith('https://') || rawInput.startsWith('/');
    var isNumeric = /^\d+$/.test(rawInput);
    var isPartial = !isUrl && !isNumeric;

    if (isPartial) {
        // Save as a pattern entry — no resolution needed
        status.textContent = 'Adding pattern…';
        var res = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'ttr_images_blacklist_add_pattern', nonce: TTR.nonce, pattern: rawInput, reason: reasonInput.value })
        });
        var data = await res.json();
        if (data.success) {
            status.style.color = '#4caf50';
            status.textContent = 'Pattern "' + rawInput + '" added to images blacklist.';
            idInput.value = '';
            reasonInput.value = '';
            if (!TTR.imagesBlacklistPatterns) TTR.imagesBlacklistPatterns = [];
            TTR.imagesBlacklistPatterns.push({ type: 'pattern', pattern: rawInput, reason: reasonInput.value });
            ttrBlacklistRenderEntries();
        } else {
            status.style.color = '#e05555';
            status.textContent = data.data ? data.data.message : 'Error.';
        }
        return;
    }

    status.textContent = 'Resolving…';

    // Resolve ID or URL to a confirmed attachment ID + URL
    var resolveRes = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_resolve_image_attachment', nonce: TTR.nonce, input: rawInput })
    });
    var resolveData = await resolveRes.json();
    if (!resolveData.success) {
        status.style.color = '#e05555';
        status.textContent = resolveData.data ? resolveData.data.message : 'Could not resolve attachment.';
        return;
    }

    var attachmentId  = resolveData.data.attachment_id;
    var attachmentUrl = resolveData.data.url;

    var res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_images_blacklist_add', nonce: TTR.nonce, attachment_id: attachmentId, reason: reasonInput.value })
    });
    var data = await res.json();
    if (data.success) {
        status.style.color = '#4caf50';
        status.textContent = 'Attachment #' + attachmentId + ' added to images blacklist.';
        idInput.value = '';
        reasonInput.value = '';
        TTR.imagesBlacklist.push({ attachment_id: attachmentId, url: attachmentUrl, reason: reasonInput.value });
        ttrBlacklistRenderEntries();
    } else {
        status.style.color = '#e05555';
        status.textContent = data.data ? data.data.message : 'Error.';
    }
}

async function ttrBlacklistRemoveImage(attachmentId) {
    var res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_images_blacklist_remove', nonce: TTR.nonce, attachment_id: attachmentId })
    });
    var data = await res.json();
    if (data.success) {
        TTR.imagesBlacklist = TTR.imagesBlacklist.filter(e => e.attachment_id !== attachmentId);
        ttrBlacklistRenderEntries();
    }
}

async function ttrBlacklistRemovePattern(pattern) {
    var res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'ttr_images_blacklist_remove_pattern', nonce: TTR.nonce, pattern: pattern })
    });
    var data = await res.json();
    if (data.success) {
        TTR.imagesBlacklistPatterns = (TTR.imagesBlacklistPatterns || []).filter(e => e.pattern !== pattern);
        ttrBlacklistRenderEntries();
    }
}

// Render on page load
document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist('#ttr-blacklist-entries').then(function() {
        ttrBlacklistRenderEntries();
    });
});
// ============================================================
// Fixers Settings Manager
// ============================================================

const ToolsSettingsManager = (() => {
    let settings = {};

    function seedSettings(data) {
        if (data && typeof data === 'object') settings = data;
    }

    async function loadSettings() {
        const response = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'ttr_get_tools_settings', nonce: TTR.nonce }),
        });
        const data = await response.json();
        if (data.success) settings = data.data;
    }

    async function saveSetting(key, value) {
        const response = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_save_tools_setting',
                nonce:  TTR.nonce,
                key,
                value: JSON.stringify(value),
            }),
        });
        const data = await response.json();
        if (data.success) { settings[key] = value; return true; }
        console.error('Failed to save fixers setting:', key, data);
        return false;
    }

    return { loadSettings, saveSetting, getSettings: () => settings, seedSettings };
})();

// ============================================================
// Phase 4: Store & API Settings UI
// ============================================================

function ttrInitTavilySettings(s) {
    // Tavily API key
    waitForElementToExist('#ttr-tavily-key-input').then(el => {
        el.value = s.tavilyApiKey || '';
    });

    // Search sites table
    waitForElementToExist('#ttr-search-sites-table').then(() => {
        ttrRenderSearchSitesTable(Array.isArray(s.searchSites) ? s.searchSites : []);
    });
}

function ttrRenderSearchSitesTable(sites) {
    const table = elTtwSearchSitesTable();
    if (!table) return;
    table.innerHTML = '';

    // Header row
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:2px;';
    header.innerHTML = '<span style="flex:2;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">URL</span>'
                     + '<span style="flex:1;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;">Category</span>'
                     + '<span style="width:28px;"></span>';
    table.appendChild(header);

    sites.forEach(function(site, i) {
        ttrAppendSearchSiteRow(table, site.url || '', site.category || '', i);
    });
}

function ttrAppendSearchSiteRow(table, url, category, index) {
    var row = document.createElement('div');
    row.className = 'ttr-search-site-row';
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';

    var urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.value = url;
    urlInput.placeholder = 'e.g. garden-wholesalers.com/';
    urlInput.className = 'ttr-search-site-url';
    urlInput.style.cssText = 'flex:2;background:#111;color:#fff;border:1px solid #444;padding:6px 8px;font-family:"DM Mono",monospace;font-size:11px;border-radius:4px;';

    var catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.value = category;
    catInput.placeholder = 'e.g. outdoor solar lights';
    catInput.className = 'ttr-search-site-category';
    catInput.style.cssText = 'flex:1;background:#111;color:#fff;border:1px solid #444;padding:6px 8px;font-family:"DM Mono",monospace;font-size:11px;border-radius:4px;';

    var removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.style.cssText = 'width:28px;height:28px;border:1px solid #2e2e32;color:#888;background:transparent;border-radius:4px;cursor:pointer;font-size:12px;flex-shrink:0;';
    removeBtn.onclick = function() { row.remove(); };

    row.appendChild(urlInput);
    row.appendChild(catInput);
    row.appendChild(removeBtn);
    table.appendChild(row);
}

function ttrAddSearchSiteRow() {
    const table = elTtwSearchSitesTable();
    if (!table) return;
    ttrAppendSearchSiteRow(table, '', '', -1);
    // Focus the new URL input
    const rows = table.querySelectorAll('.ttr-search-site-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('.ttr-search-site-url').focus();
}

async function ttrSaveTavilyKey(btn) {
    const val = elTtwTavilyKeyInput().value.trim();
    if (!val) { alert('Please enter your Tavily API key.'); return; }
    const ok = await SettingsManager.saveSetting('tavilyApiKey', val);
    if (ok) showInlineConfirm(btn, 'Saved!');
}

async function ttrSaveSearchSites(btn) {
    const rows = elsTtwSearchSiteRows();
    const sites = [];
    rows.forEach(function(row) {
        const url = row.querySelector('.ttr-search-site-url').value.trim();
        const cat = row.querySelector('.ttr-search-site-category').value.trim();
        if (url) sites.push({ url, category: cat });
    });
    const ok = await SettingsManager.saveSetting('searchSites', sites);
    if (ok) {
        showInlineConfirm(btn, 'Saved!');
        // Mark the Testers tab dirty so search sites foldout re-renders on next visit
        var testersContent = elTestarooContent();
        if (testersContent) testersContent.dataset.loaded = 'false';
    }
}

// ============================================================
// Show Documentation
// ============================================================

async function ttrShowDocumentation(docType) {
    let api = 'ttr_get_';
    switch(docType) {
        case "readme":
            api += "read_me";
            break;
        case "howto":
            api += "how_to";
            break;
        case "faqs":
            api += "faqs";
            break;
    }
    // Fetch the documentation content
    const res  = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: api, nonce: TTR.nonce }),
    });
    const data = await res.json();
    if (!data.success) 
    { 
        alert('Could not load documentation: ' + (data.data?.message ?? 'unknown error')); 
        return; 
    }

    const html = ttrMarkdownToHtml(data.data.content);

    const overlay = document.createElement('div');
    overlay.id = 'ttr-readme-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);z-index:99998;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) ttrCloseReadmeModal(); });

    const modal = document.createElement('div');
    modal.id = 'ttr-readme-modal';
    modal.style.cssText = [
        'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
        'background:#1a1a1b;border:1px solid #333;border-radius:8px;',
        'z-index:99999;width:min(780px,92vw);max-height:85vh;',
        'display:flex;flex-direction:column;font-family:\'DM Mono\',monospace;',
    ].join('');

    modal.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:14px 20px;border-bottom:1px solid #333;flex-shrink:0;">
            <span style="color:var(--ttr-accent,#c9a84c);font-size:12px;letter-spacing:1px;text-transform:uppercase;">
                📖 Readme
            </span>
            <button onclick="ttrCloseReadmeModal()" style="background:none;border:none;color:#888;
                    font-size:18px;cursor:pointer;line-height:1;padding:0;">✕</button>
        </div>
        <div id="ttr-readme-body" style="overflow-y:auto;flex:1;padding:20px 24px;
             color:#ccc;font-size:13px;line-height:1.7;">
            ${html}
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

function ttrCloseReadmeModal() {
    document.getElementById('ttr-readme-overlay')?.remove();
    document.getElementById('ttr-readme-modal')?.remove();
}

/**
 * Minimal Markdown → HTML converter covering the subset used in README.md:
 * h1–h3, bold, bullet lists, code spans, paragraphs, horizontal rules.
 */
function ttrMarkdownToHtml(md) {
    const escape = (s) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    const lines   = md.split('\n');
    const out     = [];
    let inList    = false;

    const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

    const inlineFormat = (s) => {
        // Code spans
        s = s.replace(/`([^`]+)`/g, '<code style="background:#111;padding:1px 5px;border-radius:3px;color:#e8c97a;">$1</code>');
        // Bold
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e8e8e8;">$1</strong>');
        // Italic
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        return s;
    };

    for (let i = 0; i < lines.length; i++) {
        const raw  = lines[i];
        const line = raw.trimEnd();

        // Headings
        if (/^### (.+)/.test(line)) {
            closeList();
            out.push(`<h3 style="color:var(--ttr-accent,#c9a84c);font-size:14px;margin:20px 0 6px;letter-spacing:.5px;">${inlineFormat(escape(line.slice(4)))}</h3>`);
        } else if (/^## (.+)/.test(line)) {
            closeList();
            out.push(`<h2 style="color:var(--ttr-accent,#c9a84c);font-size:16px;margin:24px 0 8px;border-bottom:1px solid #333;padding-bottom:4px;">${inlineFormat(escape(line.slice(3)))}</h2>`);
        } else if (/^# (.+)/.test(line)) {
            closeList();
            out.push(`<h1 style="color:var(--ttr-accent,#c9a84c);font-size:20px;margin:0 0 12px;">${inlineFormat(escape(line.slice(2)))}</h1>`);
        } else if (/^### (.+)/.test(line)) {
            closeList();
            out.push(`<h3 style="color:var(--ttr-accent,#c9a84c);font-size:13px;margin:16px 0 4px;">${inlineFormat(escape(line.slice(4)))}</h3>`);
        }
        // Horizontal rule
        else if (/^---+$/.test(line.trim())) {
            closeList();
            out.push('<hr style="border:none;border-top:1px solid #333;margin:16px 0;">');
        }
        // Bullet list items
        else if (/^[ ]{0,3}- (.+)/.test(line)) {
            if (!inList) { out.push('<ul style="margin:6px 0 6px 20px;padding:0;">'); inList = true; }
            const content = line.replace(/^[ ]{0,3}- /, '');
            out.push(`<li style="margin:3px 0;">${inlineFormat(escape(content))}</li>`);
        }
        // Blank line
        else if (line.trim() === '') {
            closeList();
            out.push('');
        }
        // Normal paragraph line
        else {
            closeList();
            out.push(`<p style="margin:6px 0;">${inlineFormat(escape(line))}</p>`);
        }
    }

    closeList();
    return out.join('\n');
}