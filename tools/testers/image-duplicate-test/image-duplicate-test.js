/* ── Image Duplicate Test ─────────────────────────────────────────────────── */

const IDT_ATTACHMENT_BATCH = 50;
const IDT_PRODUCT_BATCH    = 50;
const IDT_PAGE_SIZE        = 20;

let idtScanData    = null;  // live scan results (in memory)
let idtDisplayData = null;  // what is currently rendered (scan or loaded)
let idtCurrentPage = { s1: 1, s2: 1, s3: 1 };

// Tracks fix state across page changes — keyed by globalIdx for S1/S2, 's3' for S3
// Values: 'fixing' | 'fixed' | 'error:<msg>'
const idtFixedState = { s1: {}, s2: {}, s3: null };

// ── Progress helpers ──────────────────────────────────────────────────────────

function idtSetStatus(msg) {
    const el = document.getElementById('idtStatus');
    if (el) el.textContent = msg;
}
function idtSetProgress(pct) {
    const bar = document.getElementById('idtProgressBar');
    if (bar) bar.style.width = Math.min(100, Math.round(pct)) + '%';
}
function idtShowProgress(show) {
    const el = document.getElementById('idtProgressWrap');
    if (el) el.style.display = show ? 'block' : 'none';
}

// ── Page load — restore saved results ────────────────────────────────────────

function idtRestoreSavedResults() {
    if (typeof IDT === 'undefined') return;

    const st = IDT.scanStatus;
    if (st && (st.state_exists || st.phase4_interrupted)) {
        idtShowContinueBtn(true);
    }

    const d = IDT.savedResults;
    if (!d || (!d.duplicates_same_product?.length &&
               !d.duplicates_cross_product?.length &&
               !d.unused_images?.filter(i => !i.referenced_elsewhere).length)) 
               return;

    idtDisplayData = d;
    idtCurrentPage = { s1: 1, s2: 1, s3: 1 };

    // Always render full results on page load — we show whatever data we have
    // idtRenderPartial is only for live scans where Phase 4 is actively running
    idtRenderResults(idtDisplayData);
    idtShowClearBtn(true);
    idtRenderExistingZips();

    const wrapper = document.getElementById('image-duplicate-test-wrapper');
    const btn     = document.getElementById('image-duplicate-test-button');
    if (wrapper && wrapper.style.display === 'none' && btn) {
        btn.click();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist('#idtResults').then((el) => {
        idtRestoreSavedResults();
        // Always render existing zip panel on load, even if no scan results
        idtRenderExistingZips();
    });
});

// ── Main scan entry point ─────────────────────────────────────────────────────

async function idtRunScan() {
    const btn     = document.getElementById('idtScanButton');
    const results = document.getElementById('idtResults');
    
    let existingMsg = document.querySelector(".idt-zip-deleted-message");
    if(existingMsg)
        existingMsg.remove();
        
    btn.disabled      = true;
    results.innerHTML = '';
    idtScanData       = null;
    idtDisplayData    = null;
    idtCurrentPage    = { s1: 1, s2: 1, s3: 1 };
    idtFixedState.s1  = {};
    idtFixedState.s2  = {};
    idtFixedState.s3  = null;
    idtShowClearBtn(false);
    idtShowContinueBtn(false);

    idtShowProgress(true);
    idtSetProgress(0);

    // Phase 1 — hash attachments
    idtSetStatus('Phase 1 of 4 — Hashing images…');
    let attOffset = 0, attTotal = null, attTotalTime = 0, attBatchCount = 0;
    while (true) {
        const t0  = performance.now();
        const res = await idtFetch('ttr_idt_scan_attachments', { offset: attOffset, batch_size: IDT_ATTACHMENT_BATCH });
        attTotalTime += (performance.now() - t0) / 1000;
        attBatchCount++;
        if (!res)         { idtScanError('Attachment scan request failed.');             btn.disabled = false; return; }
        if (!res.success) { idtScanError(res.data?.message ?? 'Attachment scan error.'); btn.disabled = false; return; }
        attTotal  = res.data.total;
        attOffset = res.data.processed;
        idtSetProgress((attOffset / attTotal) * 50);
        const attAvg = attTotalTime / attBatchCount;
        const attEta = idtFormatEta(Math.ceil((attTotal - attOffset) / IDT_ATTACHMENT_BATCH) * attAvg);
        idtSetStatus(`Phase 1 of 4 — Hashing images… ${attOffset} / ${attTotal}${attEta}`);
        if (res.data.done) break;
    }

    // Phase 2 — map products
    idtSetStatus('Phase 2 of 4 — Mapping product images…');
    let prodOffset = 0, prodTotal = null, prodTotalTime = 0, prodBatchCount = 0;
    while (true) {
        const t0  = performance.now();
        const res = await idtFetch('ttr_idt_scan_products', { offset: prodOffset, batch_size: IDT_PRODUCT_BATCH });
        prodTotalTime += (performance.now() - t0) / 1000;
        prodBatchCount++;
        if (!res)         { idtScanError('Product scan request failed.');             btn.disabled = false; return; }
        if (!res.success) { idtScanError(res.data?.message ?? 'Product scan error.'); btn.disabled = false; return; }
        prodTotal  = res.data.total;
        prodOffset = res.data.processed;
        idtSetProgress(50 + (prodOffset / prodTotal) * 40);
        const prodAvg = prodTotalTime / prodBatchCount;
        const prodEta = idtFormatEta(Math.ceil((prodTotal - prodOffset) / IDT_PRODUCT_BATCH) * prodAvg);
        idtSetStatus(`Phase 2 of 4 — Mapping product images… ${prodOffset} / ${prodTotal}${prodEta}`);
        if (res.data.done) break;
    }

    // Phase 3 — analyse
    const skipUnused = document.getElementById('idtSkipUnused')?.checked ?? false;
    idtSetStatus('Phase 3 of 4 — Analysing results…');
    idtSetProgress(95);
    const res = await idtFetch('ttr_idt_analyse', { skip_unused: skipUnused ? 1 : 0 });
    if (!res)         { idtScanError('Analysis request failed.');             btn.disabled = false; return; }
    if (!res.success) { idtScanError(res.data?.message ?? 'Analysis error.'); btn.disabled = false; return; }

    idtScanData    = res.data;
    idtDisplayData = res.data;
    idtSetProgress(100);
    idtSetStatus('Analysing complete — rendering results…');
    idtRenderPartial(idtDisplayData);

    // Phase 4 — deep-check unused images (skipped if user opted out)
    const unusedCount = res.data.unused_images?.length ?? 0;
    if (unusedCount > 0 && !skipUnused) {
        idtShowProgress(true);
        idtSetProgress(0);
        idtSetStatus('Phase 4 of 4 — Deep-checking unused images…');

        let deepOffset = 0, deepTotal = null, deepTotalTime = 0, deepBatchCount = 0;
        const DEEP_BATCH = 25;

        while (true) {
            const t0   = performance.now();
            const dRes = await idtFetch('ttr_idt_deep_check_unused', { offset: deepOffset, batch_size: DEEP_BATCH });
            deepTotalTime += (performance.now() - t0) / 1000;
            deepBatchCount++;
            if (!dRes || !dRes.success) break;

            deepTotal  = dRes.data.total;
            deepOffset = dRes.data.processed;

            const deepAvg = deepTotalTime / deepBatchCount;
            const deepEta = idtFormatEta(Math.ceil((deepTotal - deepOffset) / DEEP_BATCH) * deepAvg);
            idtSetProgress((deepOffset / deepTotal) * 100);
            idtSetStatus(`Phase 4 of 4 — Deep-checking unused images… ${deepOffset} / ${deepTotal}${deepEta}`);

            if (dRes.data.done) break;
        }

        const reloadRes = await idtFetch('ttr_idt_get_results', {});
        if (reloadRes?.success) {
            idtScanData    = reloadRes.data;
            idtDisplayData = reloadRes.data;
        }
    }

    idtSetProgress(100);
    idtSetStatus('Scan complete.');
    idtShowProgress(false);
    btn.disabled = false;
    idtShowClearBtn(true);
    idtRenderResults(idtDisplayData);
}

async function idtContinueScan() {
    const st = IDT.scanStatus;
    if (!st) { idtRunScan(); return; }

    const btn = document.getElementById('idtScanButton');
    btn.disabled = true;
    idtShowContinueBtn(false);
    idtShowClearBtn(false);
    idtShowProgress(true);

    if (st.state_exists && st.phase === 1) {
        idtSetStatus('Resuming Phase 1 of 4 — Hashing images…');
        let attOffset = st.att_processed, attTotal = st.att_total;
        let attTotalTime = 0, attBatchCount = 0;
        while (true) {
            const t0  = performance.now();
            const res = await idtFetch('ttr_idt_scan_attachments', { offset: attOffset, batch_size: IDT_ATTACHMENT_BATCH });
            attTotalTime += (performance.now() - t0) / 1000;
            attBatchCount++;
            if (!res || !res.success) { idtScanError('Attachment scan failed.'); btn.disabled = false; return; }
            attTotal  = res.data.total;
            attOffset = res.data.processed;
            idtSetProgress((attOffset / attTotal) * 50);
            const eta = idtFormatEta(Math.ceil((attTotal - attOffset) / IDT_ATTACHMENT_BATCH) * (attTotalTime / attBatchCount));
            idtSetStatus(`Phase 1 of 4 — Hashing images… ${attOffset} / ${attTotal}${eta}`);
            if (res.data.done) break;
        }
        st.phase = 2;
        st.prod_processed = 0;
    }

    if (st.state_exists && st.phase === 2) {
        idtSetStatus('Resuming Phase 2 of 4 — Mapping product images…');
        let prodOffset = st.prod_processed, prodTotal = st.prod_total;
        let prodTotalTime = 0, prodBatchCount = 0;
        while (true) {
            const t0  = performance.now();
            const res = await idtFetch('ttr_idt_scan_products', { offset: prodOffset, batch_size: IDT_PRODUCT_BATCH });
            prodTotalTime += (performance.now() - t0) / 1000;
            prodBatchCount++;
            if (!res || !res.success) { idtScanError('Product scan failed.'); btn.disabled = false; return; }
            prodTotal  = res.data.total;
            prodOffset = res.data.processed;
            idtSetProgress(50 + (prodOffset / prodTotal) * 40);
            const eta = idtFormatEta(Math.ceil((prodTotal - prodOffset) / IDT_PRODUCT_BATCH) * (prodTotalTime / prodBatchCount));
            idtSetStatus(`Phase 2 of 4 — Mapping product images… ${prodOffset} / ${prodTotal}${eta}`);
            if (res.data.done) break;
        }
        st.phase = 3;
    }

    if (st.state_exists && st.phase === 3) {
        idtSetStatus('Phase 3 of 4 — Analysing results…');
        idtSetProgress(95);
        const res = await idtFetch('ttr_idt_analyse', {});
        if (!res || !res.success) { idtScanError('Analysis failed.'); btn.disabled = false; return; }
        idtScanData    = res.data;
        idtDisplayData = res.data;
        idtRenderPartial(idtDisplayData);
        st.phase4_interrupted = true;
        st.deep_offset = 0;
        st.deep_total  = res.data.unused_images?.length ?? 0;
    }

    if (st.phase4_interrupted && st.deep_total > 0) {
        if (!idtDisplayData) {
            const r = await idtFetch('ttr_idt_get_results', {});
            if (r?.success) { idtScanData = r.data; idtDisplayData = r.data; idtRenderPartial(idtDisplayData); }
        }

        idtShowProgress(true);
        idtSetProgress(0);
        let deepOffset = st.deep_offset, deepTotal = st.deep_total;
        let deepTotalTime = 0, deepBatchCount = 0;
        const DEEP_BATCH = 25;
        while (true) {
            const t0   = performance.now();
            const dRes = await idtFetch('ttr_idt_deep_check_unused', { offset: deepOffset, batch_size: DEEP_BATCH });
            deepTotalTime += (performance.now() - t0) / 1000;
            deepBatchCount++;
            if (!dRes || !dRes.success) break;
            deepTotal  = dRes.data.total;
            deepOffset = dRes.data.processed;
            const eta = idtFormatEta(Math.ceil((deepTotal - deepOffset) / DEEP_BATCH) * (deepTotalTime / deepBatchCount));
            idtSetProgress((deepOffset / deepTotal) * 100);
            idtSetStatus(`Phase 4 of 4 — Deep-checking unused images… ${deepOffset} / ${deepTotal}${eta}`);
            if (dRes.data.done) break;
        }

        const reloadRes = await idtFetch('ttr_idt_get_results', {});
        if (reloadRes?.success) { idtScanData = reloadRes.data; idtDisplayData = reloadRes.data; }
    }

    idtSetProgress(100);
    idtSetStatus('Scan complete.');
    idtShowProgress(false);
    btn.disabled = false;
    idtShowClearBtn(true);
    idtShowContinueBtn(false);
    idtRenderResults(idtDisplayData);
}

function idtScanError(msg) {
    idtShowProgress(false);
    document.getElementById('idtResults').innerHTML = `<p class="idt-error">${msg}</p>`;
}

async function idtFetch(action, params) {
    try {
        const res  = await fetch(TTR.ajaxUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({ action, nonce: TTR.nonce, ...params }),
        });
        const text = await res.text();
        return JSON.parse(text);
    } catch (e) {
        console.error(`[idtFetch] ${action} error:`, e);
        return null;
    }
}

// ── ETA formatter ─────────────────────────────────────────────────────────────

function idtFormatEta(seconds) {
    if (!isFinite(seconds) || seconds <= 0) return '';
    const s = Math.round(seconds);
    if (s < 60) return ` — ~${s}s remaining`;
    const m = Math.floor(s / 60), r = s % 60;
    return ` — ~${m}m ${r}s remaining`;
}

// ── Clear / continue buttons ──────────────────────────────────────────────────

function idtShowClearBtn(show) {
    const btn = document.getElementById('elClearMissingImageResultsRegion');
    if (btn) btn.style.display = show ? 'inline-block' : 'none';
}

function idtShowContinueBtn(show) {
    const btn = document.getElementById('idtContinueButton');
    if (btn) btn.style.display = show ? 'inline-block' : 'none';
}

async function idtClearResults() {
    if (!confirm('Are you sure you want to clear all previous scan results? This cannot be undone.')) return;
    await idtFetch('ttr_idt_clear_results', {});
    idtDisplayData = null;
    idtScanData    = null;
    idtShowClearBtn(false);
    document.getElementById('idtResults').innerHTML = '';
}

// ── Filter state ──────────────────────────────────────────────────────────────

let idtFilters = { s1: true, s2: true, s3: true };

function idtGetFilters() {
    return idtFilters;
}

function idtOnFilterChange() {
    if (!idtDisplayData) return;
    idtFilters = {
        s1: document.getElementById('idtFilterS1')?.checked ?? true,
        s2: document.getElementById('idtFilterS2')?.checked ?? true,
        s3: document.getElementById('idtFilterS3')?.checked ?? true,
    };
    idtCurrentPage = { s1: 1, s2: 1, s3: 1 };
    idtRenderResults(idtDisplayData);
}

// ── Partial render — S1 + S2 only, S3 placeholder ────────────────────────────

function idtRenderPartial(data) {
    // Use a shallow copy so we never mutate idtDisplayData.unused_images
    const partial = Object.assign({}, data, { unused_images: [] });
    idtRenderResults(partial);

    const results = document.getElementById('idtResults');
    if (results && data.unused_images?.length > 0) {
        const placeholder = document.createElement('div');
        placeholder.id        = 'idt-s3-placeholder';
        placeholder.className = 'idt-section';
        placeholder.innerHTML = `
            <div class="idt-section-header">
                <span class="idt-badge idt-badge-info">…</span>
                Scenario 3 — Unused images (deep-checking in progress…)
            </div>
            <p class="idt-section-desc">
                Found ${data.unused_images.length} candidate image${data.unused_images.length !== 1 ? 's' : ''} not attached to any product.
                Running deep reference check against site content, post meta, options, and theme files —
                results will appear when complete.
            </p>`;
        results.appendChild(placeholder);
    }
}

// ── Render ────────────────────────────────────────────────────────────────────

function idtRenderResults(data) {
    const results = document.getElementById('idtResults');
    const filters = idtGetFilters();

    const s1 = data.duplicates_same_product  ?? [];
    const s2 = data.duplicates_cross_product ?? [];
    const s3 = data.unused_images            ?? [];

    if (!s1.length && !s2.length && !s3.length) {
        results.innerHTML = '<p class="idt-clean">✔ No duplicate or unused images found. Everything looks clean.</p>';
        return;
    }

    const scannedAt = data.scanned_at ? `<p class="idt-scan-date">Last scanned: ${data.scanned_at}</p>` : '';

    let html = `
    ${scannedAt}
    <div class="idt-filter-bar">
        <span class="idt-filter-label">Show:</span>
        <label class="idt-filter-check"><input type="checkbox" id="idtFilterS1" ${filters.s1 ? 'checked' : ''} onchange="idtOnFilterChange()" ${!s1.length ? 'disabled' : ''}> <span class="idt-badge ${s1.length ? 'idt-badge-warn' : 'idt-badge-zero'}">${s1.length}</span> Same-product dupes</label>
        <label class="idt-filter-check"><input type="checkbox" id="idtFilterS2" ${filters.s2 ? 'checked' : ''} onchange="idtOnFilterChange()" ${!s2.length ? 'disabled' : ''}> <span class="idt-badge ${s2.length ? 'idt-badge-danger' : 'idt-badge-zero'}">${s2.length}</span> Cross-product dupes</label>
        <label class="idt-filter-check"><input type="checkbox" id="idtFilterS3" ${filters.s3 ? 'checked' : ''} onchange="idtOnFilterChange()" ${!s3.length ? 'disabled' : ''}> <span class="idt-badge ${s3.length ? 'idt-badge-info' : 'idt-badge-zero'}">${s3.length}</span> Unused images</label>
    </div>`;

    // ── S1 ───────────────────────────────────────────────────────────────────
    if (s1.length && filters.s1) {
        const page      = idtCurrentPage.s1;
        const total     = s1.length;
        const start     = (page - 1) * IDT_PAGE_SIZE;
        const pageItems = s1.slice(start, start + IDT_PAGE_SIZE);

        html += `
        <div class="idt-section">
            <div class="idt-section-header">
                <span class="idt-badge idt-badge-warn">${total}</span>
                Scenario 1 — Duplicate images on the same product
            </div>
            <p class="idt-section-desc">
                These products have identical image files attached more than once.
                Only the oldest copy is kept. Safe to auto-fix.
            </p>
            <div class="idt-section-actions">
                <button class="idt-fix-all-btn" onclick="idtFixAllS1()">Auto-Fix All Same-Product Dupes (${total})</button>
                <span class="idt-fixall-status" id="idt-s1-fixall-status"></span>
            </div>
            <div class="idt-card-list" id="idt-s1-list">`;

        pageItems.forEach((item, localIdx) => {
            const globalIdx = start + localIdx;
            const s1State   = idtFixedState.s1[globalIdx];
            const s1BtnHtml = s1State
                ? (s1State.startsWith('error')
                    ? `<span class="idt-fixed-badge idt-fixed-err">✖ ${s1State.slice(6)}</span>`
                    : s1State === 'fixing'
                        ? `<button class="idt-fix-btn" disabled>Fixing…</button>`
                        : `<span class="idt-fixed-badge idt-fixed-ok">✔ Fixed</span>`)
                : `<button class="idt-fix-btn" onclick="idtFixS1(${globalIdx})">Auto-Fix</button>`;
            html += `
            <div class="idt-card" id="idt-s1-card-${globalIdx}">
                <img class="idt-thumb" src="${item.kept_url}" alt="">
                <div class="idt-card-body">
                    <div class="idt-product-name">
                        <a href="${TTR.adminUrl}post.php?post=${item.product_id}&action=edit" target="_blank">${item.product_name}</a>
                    </div>
                    <div class="idt-card-meta">
                        Kept: #${item.kept_id} &nbsp;·&nbsp; Duplicates to remove: ${item.deleted_ids.map(id => '#' + id).join(', ')}
                    </div>
                </div>
                ${s1BtnHtml}
            </div>`;
        });

        html += `</div>${idtPager(total, page, 's1')}</div>`;
    }

    // ── S2 ───────────────────────────────────────────────────────────────────
    if (s2.length && filters.s2) {
        const page      = idtCurrentPage.s2;
        const total     = s2.length;
        const start     = (page - 1) * IDT_PAGE_SIZE;
        const pageItems = s2.slice(start, start + IDT_PAGE_SIZE);

        html += `
        <div class="idt-section">
            <div class="idt-section-header">
                <span class="idt-badge idt-badge-danger">${total}</span>
                Scenario 2 — Same image used across different products
            </div>
            <p class="idt-section-desc">
                Multiple products share physically identical image files. Most likely a mistake.
                Duplicates will be deleted and all affected products pointed to a single image.
                <strong>Please verify after fixing.</strong>
            </p>
            <div class="idt-section-actions">
                <button class="idt-fix-all-btn idt-fix-all-btn-danger" onclick="idtFixAllS2()">Auto-Fix All Cross-Product Dupes (${total})</button>
                <span class="idt-fixall-status" id="idt-s2-fixall-status"></span>
            </div>
            <div class="idt-card-list" id="idt-s2-list">`;

        pageItems.forEach((item, localIdx) => {
            const globalIdx = start + localIdx;
            const foldoutId = `idt-s2-foldout-${globalIdx}`;
            const firstName = item.affected_products[0]?.product_name ?? 'Unknown product';
            const productLinksHtml = item.affected_products.map(p =>
                `<a href="${p.edit_url}" target="_blank" class="idt-foldout-link">${p.product_name}</a>`
            ).join('');

            html += `
            <div class="idt-card idt-card-danger" id="idt-s2-card-${globalIdx}">
                <img class="idt-thumb" src="${item.kept_url}" alt="">
                <div class="idt-card-body">
                    <div class="idt-card-meta idt-cross-label">Shared by ${item.affected_products.length} products:</div>
                    <div class="idt-foldout">
                        <button class="idt-foldout-toggle" onclick="idtToggleFoldout('${foldoutId}', this)" type="button">
                            ${firstName} <span class="idt-foldout-arrow">▶</span>
                        </button>
                        <div class="idt-foldout-body" id="${foldoutId}">${productLinksHtml}</div>
                    </div>
                    <div class="idt-card-meta">
                        Kept: #${item.kept_id} &nbsp;·&nbsp; Deleted: ${item.duplicate_ids.map(id => '#' + id).join(', ')}
                    </div>
                </div>
                ${idtFixedState.s2[globalIdx]
                    ? (idtFixedState.s2[globalIdx].startsWith('error')
                        ? `<span class="idt-fixed-badge idt-fixed-err">✖ ${idtFixedState.s2[globalIdx].slice(6)}</span>`
                        : idtFixedState.s2[globalIdx] === 'fixing'
                            ? `<button class="idt-fix-btn idt-fix-btn-danger" disabled>Fixing…</button>`
                            : `<span class="idt-fixed-badge idt-fixed-warn">✔ Fixed — verify products</span>`)
                    : `<button class="idt-fix-btn idt-fix-btn-danger" onclick="idtFixS2(${globalIdx})">Auto-Fix + Report</button>`}
            </div>`;
        });

        html += `</div>${idtPager(total, page, 's2')}</div>`;
    }

    // ── S3 ───────────────────────────────────────────────────────────────────
    if (s3.length && filters.s3) {
        const page      = idtCurrentPage.s3;
        const total     = s3.length;
        const start     = (page - 1) * IDT_PAGE_SIZE;
        const pageItems = s3.slice(start, start + IDT_PAGE_SIZE);

        // Build action HTML without nested template literals
        let s3ActionHtml = '';
        if (idtFixedState.s3) {
            const fs = idtFixedState.s3;
            if (fs.startsWith('error')) {
                s3ActionHtml = '<button class="idt-delete-unused-btn" disabled>Delete (to trash)</button>'
                             + '<span class="idt-fixed-badge idt-fixed-err">&#x2716; ' + fs.slice(6) + '</span>';
            } else if (fs.startsWith('warn:')) {
                s3ActionHtml = '<span class="idt-fixed-badge idt-fixed-warn">' + fs.slice(5) + '</span>';
            } else if (fs === 'deleting') {
                s3ActionHtml = '<button class="idt-delete-unused-btn" disabled>Deleting…</button>'
                             + '<span class="idt-fixall-status" id="idt-s3-delete-status"></span>';
            } else if (fs.startsWith('zip:')) {
                // Parse zip:url|moved|skipped|zip_name
                const parts   = fs.slice(4).split('|');
                const zipUrl  = parts[0];
                const nMoved  = parts[1] ?? '?';
                const nSkip   = parts[2] ?? '0';
                const zipName = parts[3] ?? '';
                s3ActionHtml  = '<span class="idt-fixed-badge idt-fixed-ok">'
                              + '✔ ' + nMoved + ' image(s) archived, ' + nSkip + ' skipped.'
                              + '</span>'
                              + '<a class="idt-zip-download-btn" href="' + zipUrl + '" download>'
                              + '⬇ Download Backup</a>'
                              + '<button class="idt-zip-delete-btn idt-fix-all-btn-danger" onclick="idtDeleteZip(' + escapeHtml(JSON.stringify(zipName)) + ')">'
                              + '🗑 Delete Backup</button>';
            } else {
                s3ActionHtml = '<span class="idt-fixed-badge idt-fixed-ok">' + fs + '</span>';
            }
        } else {
            const safeCount = s3.some(i => i.deep_checked)
                ? s3.filter(i => !i.referenced_elsewhere).length
                : total;
            const btnLabel = s3.some(i => i.deep_checked)
                ? 'Delete ' + safeCount + ' Safe Unused Images (to trash)'
                : 'Delete All ' + total + ' Unused Images (to trash)';
            s3ActionHtml = '<button class="idt-delete-unused-btn" id="idt-s3-delete-btn" onclick="idtDeleteAllUnused()">' + btnLabel + '</button>';
        }

        const warnedCount = s3.filter(i => i.referenced_elsewhere).length;
        const warnedHtml  = warnedCount > 0
            ? '<span class="idt-ref-badge" style="margin-left:8px;">&#x26A0; ' + warnedCount + ' excluded — referenced elsewhere</span>'
            : '';

        const cacheHtml = (typeof IDT !== 'undefined' && IDT.cacheCount > 0)
            ? '<button class="idt-view-cache-btn" onclick="idtShowCacheModal()">👁 View Cache (' + IDT.cacheCount + ')</button>'
            + '<button class="idt-clear-cache-btn" onclick="idtClearDeepCache()">Clear Deep-Use Cache (' + IDT.cacheCount + ')</button>'
            : '';

        html += '<div class="idt-section">'
              + '<div class="idt-section-header">'
              + '<span class="idt-badge idt-badge-info">' + total + '</span>'
              + ' Scenario 3 — Unused images (not attached to any product)'
              + '</div>'
              + '<p class="idt-section-desc">'
              + 'These images are not attached to any product. Clicking <strong>Delete All Unused</strong> '
              + 'moves them to <code>deleted_unused_product_images</code> in your uploads folder and puts them '
              + 'in the WordPress trash — <strong>not permanently deleted</strong>.'
              + '</p>'
              + '<p class="idt-section-desc">'
              + 'The "Deep-Use Cache" determines if images are used in html, css, plugins, posts, post-meta and anything '
              + "that isn't a product. The cache stores those images so they are not scanned in the future, increasing scan performance."
              + '</p>'
              + '<p class="idt-section-desc">'
              + 'It is still possible that an image is used/referenced in a way this tool cannot detect. '
              + 'Double check before deleting. You can add an image url to the blacklist on the Main tab so it is not checked in future scans.'
              + '</p>'
              + '<div class="idt-section-actions">'
              + s3ActionHtml
              + warnedHtml
              + cacheHtml
              + '</div>'
              + '<div class="idt-unused-list" id="idt-s3-list">';

        pageItems.forEach(item => {
            const refCount   = item.references?.length ?? 0;
            const referenced = item.referenced_elsewhere;
            const foldoutId  = `idt-s3-ref-${item.attachment_id}`;

            let refHtml = '';
            if (referenced && refCount > 0) {
                const refLinks = item.references.map(r => {
                    if (r.source === 'post_content') {
                        return `<span class="idt-ref-item">Post/Page: <a href="${TTR.adminUrl}post.php?post=${r.id}&action=edit" target="_blank">${r.title || '#' + r.id}</a> (${r.type})</span>`;
                    } else if (r.source === 'postmeta') {
                        return `<span class="idt-ref-item">Meta: <code>${r.meta_key}</code> on <a href="${TTR.adminUrl}post.php?post=${r.id}&action=edit" target="_blank">${r.title || '#' + r.id}</a> (${r.type})</span>`;
                    } else if (r.source === 'filesystem') {
                        return `<span class="idt-ref-item">File: <code>${r.file}</code> (matched: <code>${r.matched}</code>)</span>`;
                    } else if (r.source === 'cache') {
                        return `<span class="idt-ref-item idt-ref-cached">📦 ${r.note}</span>`;
                    } else {
                        return `<span class="idt-ref-item">Site option: <code>${r.option_name}</code></span>`;
                    }
                }).join('');
                refHtml = `
                <div class="idt-foldout idt-ref-foldout">
                    <button class="idt-foldout-toggle idt-ref-toggle" onclick="idtToggleFoldout('${foldoutId}', this)" type="button">
                        ⚠ Referenced in ${refCount} other location${refCount !== 1 ? 's' : ''} <span class="idt-foldout-arrow">▶</span>
                    </button>
                    <div class="idt-foldout-body" id="${foldoutId}">${refLinks}</div>
                </div>`;
            }

            html += `<div class="idt-unused-item ${referenced ? 'idt-unused-item-warned' : ''}" id="idt-s3-item-${item.attachment_id}">
                <div class="idt-unused-item-row">
                    <a href="${item.url}" target="_blank" class="idt-unused-link">${item.filename}</a>
                    <span class="idt-unused-id">#${item.attachment_id}</span>
                    ${referenced ? '<span class="idt-ref-badge">⚠ In use elsewhere</span>' : (item.deep_checked ? '<span class="idt-safe-badge">✔ Safe</span>' : '')}
                    <span class="idt-unused-item-actions">
                        <button class="idt-row-btn idt-row-btn-delete" title="Delete this image" onclick="idtDeleteSingleImage(${item.attachment_id}, this)">🗑 Delete</button>
                        <button class="idt-row-btn idt-row-btn-cache" title="Add to Deep-Use Cache (skip in future scans)" onclick="idtAddToDeepCache(${item.attachment_id}, this)">📦 Cache</button>
                        <button class="idt-row-btn idt-row-btn-blacklist" title="Add to image blacklist" onclick="idtAddToImageBlacklist(${item.attachment_id}, '${item.filename}', this)">🚫 Blacklist</button>
                    </span>
                </div>
                ${refHtml}
            </div>`;
        });

        html += `</div>${idtPager(total, page, 's3')}</div>`;
    }

    results.innerHTML = html;
    idtRenderExistingZips();
}

// ── Existing zip backups (persists across page reloads) ─────────────────────

function idtRenderExistingZips() {
    const zips = IDT?.existingZips ?? [];
    if (!zips.length) 
        return;

    // Find or create the zip panel — attach it after #idtResults
    let panel = document.getElementById('idt-existing-zips-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id        = 'idt-existing-zips-panel';
        panel.className = 'idt-section';
        const results = document.getElementById('idtResults');
        if (results?.parentNode) {
            results.parentNode.insertBefore(panel, results.nextSibling);
        }
    }

    let html = '<div class="idt-section-header">'
             + '<span class="idt-badge idt-badge-info">' + zips.length + '</span>'
             + ' Existing Backup Zip' + (zips.length !== 1 ? 's' : '')
             + '</div>'
             + '<p class="idt-section-desc">'
             + 'These backup zips of previously deleted unused images are on your server. '
             + 'Download them for safekeeping or delete them once you\'re confident.'
             + '</p>'
             + '<div class="idt-section-actions" style="flex-direction:column;align-items:flex-start;gap:8px;">';

    zips.forEach(zip => {
        html += '<div style="display:flex;align-items:center;gap:10px;">'
              + '<span class="idt-fixall-status">' + zip.zip_name + ' (' + zip.size_mb + ' MB)</span>'
              + '<a class="idt-zip-download-btn" href="' + zip.zip_url + '" download>⬇ Download</a>'
              + '<button class="idt-zip-delete-btn idt-fix-all-btn-danger" onclick="idtDeleteZip(' + escapeHtml(JSON.stringify(zip.zip_name)) + ')">🗑 Delete</button>'
              + '</div>';
    });

    html += '</div>';
    panel.innerHTML = html;
}

// ── Pagination ────────────────────────────────────────────────────────────────

function idtPager(total, currentPage, section) {
    const pages = Math.ceil(total / IDT_PAGE_SIZE);
    if (pages <= 1) return '';

    let html = `<div class="idt-pager">`;
    if (currentPage > 1) {
        html += `<button class="idt-pager-btn" onclick="idtGoPage('${section}', ${currentPage - 1})">← Prev</button>`;
    }
    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || (p >= currentPage - 2 && p <= currentPage + 2)) {
            html += `<button class="idt-pager-btn ${p === currentPage ? 'idt-pager-active' : ''}" onclick="idtGoPage('${section}', ${p})">${p}</button>`;
        } else if (p === currentPage - 3 || p === currentPage + 3) {
            html += `<span class="idt-pager-ellipsis">…</span>`;
        }
    }
    if (currentPage < pages) {
        html += `<button class="idt-pager-btn" onclick="idtGoPage('${section}', ${currentPage + 1})">Next →</button>`;
    }
    html += `</div>`;
    return html;
}

function idtGoPage(section, page) {
    idtCurrentPage[section] = page;
    idtRenderResults(idtDisplayData);
    document.querySelector('.idt-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Foldout ───────────────────────────────────────────────────────────────────

function idtToggleFoldout(id, btn) {
    const body = document.getElementById(id);
    if (!body) return;
    const open = body.classList.toggle('idt-foldout-open');
    const arrow = btn.querySelector('.idt-foldout-arrow');
    if (arrow) arrow.textContent = open ? '▼' : '▶';
}

// ── Update a single card's action area without full re-render ─────────────────

function idtUpdateCardAction(section, idx) {
    const page  = idtCurrentPage[section];
    const start = (page - 1) * IDT_PAGE_SIZE;
    const end   = start + IDT_PAGE_SIZE;
    if (idx < start || idx >= end) return;

    const card = document.getElementById(`idt-${section}-card-${idx}`);
    if (!card) return;

    const state = idtFixedState[section][idx];
    let html = '';
    if (section === 's1') {
        html = state === 'fixed'
            ? `<span class="idt-fixed-badge idt-fixed-ok">✔ Fixed</span>`
            : state === 'fixing'
                ? `<button class="idt-fix-btn" disabled>Fixing…</button>`
                : `<span class="idt-fixed-badge idt-fixed-err">✖ ${state.slice(6)}</span>`;
    } else {
        html = state === 'fixed'
            ? `<span class="idt-fixed-badge idt-fixed-warn">✔ Fixed — verify products</span>`
            : state === 'fixing'
                ? `<button class="idt-fix-btn idt-fix-btn-danger" disabled>Fixing…</button>`
                : `<span class="idt-fixed-badge idt-fixed-err">✖ ${state.slice(6)}</span>`;
    }

    const existing = card.querySelector('.idt-fix-btn, .idt-fixed-badge');
    if (existing) {
        existing.outerHTML = html;
    } else {
        card.insertAdjacentHTML('beforeend', html);
    }
}

// ── Fix All status helper ─────────────────────────────────────────────────────

function idtSetFixAllStatus(section, msg) {
    const el = document.getElementById('idt-' + section + '-fixall-status');
    if (el) el.textContent = msg;
}

// ── Fix S1 ────────────────────────────────────────────────────────────────────

async function idtFixS1(idx) {
    if (idtFixedState.s1[idx] === 'fixed') return;
    const item = idtDisplayData.duplicates_same_product[idx];

    idtFixedState.s1[idx] = 'fixing';
    idtUpdateCardAction('s1', idx);

    const res = await idtFetch('ttr_fix_same_product_duplicates', {
        product_id:  item.product_id,
        kept_id:     item.kept_id,
        deleted_ids: JSON.stringify(item.deleted_ids),
    });

    if (res?.success) {
        idtFixedState.s1[idx] = 'fixed';
        await idtFetch('ttr_idt_mark_fixed', { type: 's1', key: item.product_id });
    } else {
        idtFixedState.s1[idx] = 'error:' + (res?.data?.message ?? 'unknown');
    }
    idtUpdateCardAction('s1', idx);
}

async function idtFixAllS1() {
    const allBtn = document.querySelector('.idt-section-actions .idt-fix-all-btn:not(.idt-fix-all-btn-danger)');
    if (allBtn) { allBtn.disabled = true; allBtn.textContent = 'Fixing all…'; }

    const items     = idtDisplayData.duplicates_same_product ?? [];
    const total     = items.length;
    let   doneCount = Object.values(idtFixedState.s1).filter(v => v === 'fixed').length;

    for (let i = 0; i < items.length; i++) {
        if (idtFixedState.s1[i] === 'fixed') { doneCount++; continue; }
        const item = items[i];
        idtFixedState.s1[i] = 'fixing';
        idtSetFixAllStatus('s1', 'Fixing: ' + item.product_name + ' (' + (doneCount + 1) + ' of ' + total + ')');

        const res = await idtFetch('ttr_fix_same_product_duplicates', {
            product_id:  item.product_id,
            kept_id:     item.kept_id,
            deleted_ids: JSON.stringify(item.deleted_ids),
        });

        if (res?.success) {
            idtFixedState.s1[i] = 'fixed';
            await idtFetch('ttr_idt_mark_fixed', { type: 's1', key: item.product_id });
        } else {
            idtFixedState.s1[i] = 'error:' + (res?.data?.message ?? 'unknown');
        }
        idtUpdateCardAction('s1', i);
        doneCount++;
    }

    idtSetFixAllStatus('s1', 'Done — ' + doneCount + ' of ' + total + ' fixed.');
    idtRenderResults(idtDisplayData);
}

// ── Fix S2 ────────────────────────────────────────────────────────────────────

async function idtFixS2(idx) {
    if (idtFixedState.s2[idx] === 'fixed') return;
    const item = idtDisplayData.duplicates_cross_product[idx];

    idtFixedState.s2[idx] = 'fixing';
    idtUpdateCardAction('s2', idx);

    const res = await idtFetch('ttr_fix_cross_product_duplicates', {
        kept_id:           item.kept_id,
        duplicate_ids:     JSON.stringify(item.duplicate_ids),
        affected_products: JSON.stringify(item.affected_products),
    });

    if (res?.success) {
        idtFixedState.s2[idx] = 'fixed';
        await idtFetch('ttr_idt_mark_fixed', { type: 's2', key: item.hash });
    } else {
        idtFixedState.s2[idx] = 'error:' + (res?.data?.message ?? 'unknown');
    }
    idtUpdateCardAction('s2', idx);
}

async function idtFixAllS2() {
    const allBtn = document.querySelector('.idt-fix-all-btn-danger');
    if (allBtn) { allBtn.disabled = true; allBtn.textContent = 'Fixing all…'; }

    const items     = idtDisplayData.duplicates_cross_product ?? [];
    const total     = items.length;
    let   doneCount = Object.values(idtFixedState.s2).filter(v => v === 'fixed').length;

    for (let i = 0; i < items.length; i++) {
        if (idtFixedState.s2[i] === 'fixed') { doneCount++; continue; }
        const item = items[i];
        idtFixedState.s2[i] = 'fixing';
        const firstName = item.affected_products?.[0]?.product_name ?? 'item';
        idtSetFixAllStatus('s2', 'Fixing: ' + firstName + ' (' + (doneCount + 1) + ' of ' + total + ')');

        const res = await idtFetch('ttr_fix_cross_product_duplicates', {
            kept_id:           item.kept_id,
            duplicate_ids:     JSON.stringify(item.duplicate_ids),
            affected_products: JSON.stringify(item.affected_products),
        });

        if (res?.success) {
            idtFixedState.s2[i] = 'fixed';
            await idtFetch('ttr_idt_mark_fixed', { type: 's2', key: item.hash });
        } else {
            idtFixedState.s2[i] = 'error:' + (res?.data?.message ?? 'unknown');
        }
        idtUpdateCardAction('s2', i);
        doneCount++;
    }

    idtSetFixAllStatus('s2', 'Done — ' + doneCount + ' of ' + total + ' fixed.');
    idtRenderResults(idtDisplayData);
}

// ── Delete S3 ─────────────────────────────────────────────────────────────────

async function idtClearDeepCache() {
    if (!confirm('Clear the deep-use cache? Future scans will re-check all previously cached images from scratch.'))
        return;
        
    const res = await idtFetch('ttr_idt_clear_cache', {});
    if (res?.success) {
        IDT.cacheCount = 0;
        if (idtDisplayData) 
            idtRenderResults(idtDisplayData);
        alert('Deep-use cache cleared.');
    }
}

async function idtDeleteZip(zipName) {
    if (!confirm('Delete the backup zip from the server? This cannot be undone.')) 
        return;
    
    let existingMsg = document.querySelector(".idt-zip-deleted-message");
    if(existingMsg)
        existingMsg.remove();
        
    const res = await idtFetch('ttr_idt_delete_zip', { zip_name: zipName });
    if (res?.success) {
        // Remove from IDT.existingZips so the panel updates immediately
        if (IDT?.existingZips) {
            IDT.existingZips = IDT.existingZips.filter(z => z.zip_name !== zipName);
        }
        const noZipsLeft  = !IDT?.existingZips?.length;
        const noPhase1Left = idtDisplayData.duplicates_same_product.length == 0;
        const noPhase2Left = idtDisplayData.duplicates_cross_product.length == 0;
        if (noZipsLeft && noPhase1Left && noPhase2Left) {
            // Everything is clean — silently clear results without prompting
            await idtFetch('ttr_idt_clear_results', {});
            idtDisplayData = null;
            idtScanData    = null;
            idtShowClearBtn(false);
            document.getElementById('idtResults').innerHTML = '';
            const existingZipPanel = document.querySelector('#idt-existing-zips-panel');
            if (existingZipPanel) existingZipPanel.remove();
            return;
        }

        let idt = document.querySelector("#idtResults");
        const msg = document.createElement("div");
        msg.classList.add('idt-zip-deleted-message');
        msg.textContent = '✔ Backup zip deleted from server.';
        idt.appendChild(msg, null);
        idt.style.display = "block";
        let existingZipPanel = document.querySelector("#idt-existing-zips-panel");
        if (existingZipPanel)
            existingZipPanel.style.display = "none";
        
        if (idtDisplayData) 
            idtRenderResults(idtDisplayData);
        else
            idtRenderExistingZips();
    } else {
        alert('Could not delete zip: ' + (res?.data?.message ?? 'unknown error'));
    }
}

async function idtDeleteAllUnused() {
    const DELETE_BATCH = 50;
    const allUnused    = idtDisplayData?.unused_images ?? [];
    const safeToDelete = allUnused.filter(i => !i.referenced_elsewhere);
    const warned       = allUnused.filter(i => i.referenced_elsewhere);
    const ids          = safeToDelete.map(i => i.attachment_id);
    const total        = ids.length;

    if (warned.length > 0 && ids.length === 0) {
        idtFixedState.s3 = 'warn:⚠ All ' + warned.length + ' image(s) are referenced elsewhere — none deleted.';
        idtRenderResults(idtDisplayData);
        return;
    }

    // Set deleting state — renders the disabled button + status span
    idtFixedState.s3 = 'deleting';
    idtRenderResults(idtDisplayData);

    let moved   = 0;
    let skipped = 0;
    let errors  = 0;

    for (let offset = 0; offset < total; offset += DELETE_BATCH) {
        const chunk    = ids.slice(offset, offset + DELETE_BATCH);
        const batchEnd = Math.min(offset + DELETE_BATCH, total);

        // Update the live status span — safe because it's rendered by the 'deleting' state above
        const statusEl = document.getElementById('idt-s3-delete-status');
        if (statusEl) {
            const lastName = safeToDelete[batchEnd - 1]?.filename ?? '';
            statusEl.textContent = 'Batch Deleted ' + batchEnd + ' of ' + total
                + (lastName ? ' — ' + lastName : '');
        }

        const res = await idtFetch('ttr_delete_unused_images', {
            attachment_ids: JSON.stringify(chunk),
        });

        if (res?.success) {
            moved   += res.data.moved?.length   ?? 0;
            skipped += res.data.skipped?.length ?? 0;
            for (const id of chunk) {
                await idtFetch('ttr_idt_mark_fixed', { type: 's3', key: id });
            }
        } else {
            errors++;
        }
    }

    if (errors > 0) {
        idtFixedState.s3 = 'warn:⚠ Completed with ' + errors + ' batch error(s). ' + moved + ' moved, ' + skipped + ' skipped.';
        idtRenderResults(idtDisplayData);
        return;
    }

    // All batches done — zip the archive folder and offer download
    idtFixedState.s3 = 'deleting';
    const statusEl2 = document.getElementById('idt-s3-delete-status');
    if (statusEl2) statusEl2.textContent = 'Creating zip download…';

    const zipRes = await idtFetch('ttr_idt_zip_archive', {});

    if (zipRes?.success) {
        idtFixedState.s3 = 'zip:' + zipRes.data.zip_url + '|' + moved + '|' + skipped + '|' + zipRes.data.zip_name;
    } else {
        // Zip failed — still report success, just no download
        idtFixedState.s3 = '✔ ' + moved + ' image(s) archived. ' + skipped + ' skipped. '
                         + '(Zip unavailable: ' + (zipRes?.data?.message ?? 'unknown error') + ')';
    }
    idtRenderResults(idtDisplayData);
}
document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist('#clearDupeImageResultsRegion').then((el) => {
        el.addEventListener("click", function(e) {
            e.stopPropagation();
            e.preventDefault();
            elClearDupeImageResultsRegion().style = 'display:none;';
        });
    });    
});

// ── Individual S3 row actions ─────────────────────────────────────────────────

async function idtDeleteSingleImage(attId, btn) {
    if (!confirm('Move image #' + attId + ' to the archive folder and trash it?')) return;
    btn.disabled = true;
    btn.textContent = '…';
    const res = await idtFetch('ttr_delete_single_unused_image', { attachment_id: attId });
    if (res?.success) {
        // Mark as fixed in results JSON
        await idtFetch('ttr_idt_mark_fixed', { type: 's3', key: attId });
        // Remove from display data
        if (idtDisplayData) {
            idtDisplayData.unused_images = (idtDisplayData.unused_images || []).filter(i => i.attachment_id !== attId);
        }
        const row = document.getElementById('idt-s3-item-' + attId);
        if (row) {
            row.style.transition = 'opacity .3s';
            row.style.opacity = '0';
            setTimeout(() => { row.remove(); }, 300);
        }
    } else {
        btn.disabled = false;
        btn.textContent = '🗑 Delete';
        alert('Could not delete: ' + (res?.data?.message ?? 'unknown error'));
    }
}

async function idtAddToDeepCache(attId, btn) {
    btn.disabled = true;
    btn.textContent = '…';
    const res = await idtFetch('ttr_idt_add_to_deep_cache', { attachment_id: attId });
    if (res?.success) {
        IDT.cacheCount = res.data.count;
        // Mark item as referenced so it won't be deleted in bulk
        if (idtDisplayData) {
            const item = (idtDisplayData.unused_images || []).find(i => i.attachment_id === attId);
            if (item) {
                item.referenced_elsewhere = true;
                item.deep_checked = true;
                item.references = item.references || [];
                item.references.push({ source: 'cache', note: 'Manually added to deep-use cache' });
            }
        }
        btn.textContent = '📦 Cached';
        btn.style.opacity = '0.5';
    } else {
        btn.disabled = false;
        btn.textContent = '📦 Cache';
        alert('Could not add to cache: ' + (res?.data?.message ?? 'unknown error'));
    }
}

async function idtAddToImageBlacklist(attId, filename, btn) {
    const reason = prompt('Add #' + attId + ' (' + filename + ') to blacklist.\nOptional reason:', '');
    btn.disabled = true;
    btn.textContent = '…';
    const res = await idtFetch('ttr_images_blacklist_add', { attachment_id: attId, reason: reason });
    if (res?.success) {
        // Also update the in-memory imagesBlacklist so the Settings panel reflects it
        if (typeof TTR !== 'undefined') {
            TTR.imagesBlacklist = TTR.imagesBlacklist || [];
            TTR.imagesBlacklist.push({ attachment_id: attId, url: '', reason: reason });
        }
        btn.textContent = '🚫 Listed';
        btn.style.opacity = '0.5';
    } else {
        btn.disabled = false;
        btn.textContent = '🚫 Blacklist';
        alert('Could not add to blacklist: ' + (res?.data?.message ?? 'unknown error'));
    }
}

// ── Deep-use cache modal ──────────────────────────────────────────────────────

async function idtShowCacheModal() {
    const res = await idtFetch('ttr_idt_get_cache_stats', {});
    if (!res?.success) { alert('Could not load cache data.'); return; }

    const entries = res.data.entries || [];

    let html = '<div id="idt-cache-modal-overlay" onclick="idtCloseCacheModal()" style="'
             + 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:99998;"></div>'
             + '<div id="idt-cache-modal" style="'
             + 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);'
             + 'background:#1a1a1b;border:1px solid #333;border-radius:8px;'
             + 'z-index:99999;width:min(800px,92vw);max-height:80vh;display:flex;flex-direction:column;'
             + 'font-family:\'DM Mono\',monospace;">'
             + '<div style="padding:16px 20px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">'
             + '<span style="color:#c9a84c;font-size:13px;letter-spacing:1px;text-transform:uppercase;">Deep-Use Cache (' + entries.length + ' entries)</span>'
             + '<button onclick="idtCloseCacheModal()" style="background:none;border:none;color:#888;font-size:18px;cursor:pointer;">✕</button>'
             + '</div>'
             + '<div style="overflow-y:auto;flex:1;padding:12px 16px;">';

    if (entries.length === 0) {
        html += '<p style="color:#888;font-size:12px;">Cache is empty.</p>';
    } else {
        entries.forEach(entry => {
            const attId = entry.attachment_id;
            const url   = wp_get_attachment_url_client(attId, entry);
            const refs  = (entry.references || []).map(r => {
                if (r.source === 'post_content') return 'Post: ' + (r.title || '#' + r.id);
                if (r.source === 'postmeta')     return 'Meta: ' + r.meta_key;
                if (r.source === 'filesystem')   return 'File: ' + r.file;
                if (r.source === 'options')      return 'Option: ' + r.option_name;
                if (r.source === 'manual')       return r.note || 'Manual';
                if (r.source === 'cache')        return r.note || 'Cached';
                return r.source;
            }).join(', ');

            html += '<div class="idt-cache-modal-row" id="idt-cm-row-' + attId + '" style="'
                  + 'display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #222;">'
                  + '<div style="flex:1;min-width:0;">'
                  + '<div style="font-size:12px;color:#e8e8e8;word-break:break-all;">#' + attId
                  + (entry.url ? ' — <a href="' + entry.url + '" target="_blank" style="color:#4a9eff;text-decoration:none;">' + (entry.url.split('/').pop() || entry.url) + '</a>' : '')
                  + '</div>'
                  + (refs ? '<div style="font-size:10px;color:#666;margin-top:2px;">' + refs + '</div>' : '')
                  + '<div style="font-size:10px;color:#555;margin-top:1px;">' + (entry.added_at || '') + '</div>'
                  + '</div>'
                  + '<div style="display:flex;gap:6px;flex-shrink:0;">'
                  + '<button class="idt-row-btn" onclick="idtCacheModalRemove(' + attId + ')" title="Remove from cache (will re-check on next scan)">↩ Remove</button>'
                  + '<button class="idt-row-btn idt-row-btn-delete" onclick="idtCacheModalDelete(' + attId + ')" title="Delete the image entirely">🗑 Delete</button>'
                  + '<button class="idt-row-btn idt-row-btn-blacklist" onclick="idtCacheModalBlacklist(' + attId + ', this)" title="Add to image blacklist">🚫 Blacklist</button>'
                  + '</div>'
                  + '</div>';
        });
    }

    html += '</div></div>';

    const existing = document.getElementById('idt-cache-modal-overlay');
    if (existing) existing.remove();
    const existingM = document.getElementById('idt-cache-modal');
    if (existingM) existingM.remove();

    document.body.insertAdjacentHTML('beforeend', html);
}

function idtCloseCacheModal() {
    document.getElementById('idt-cache-modal-overlay')?.remove();
    document.getElementById('idt-cache-modal')?.remove();
}

// Helper: get URL from cache entry (server stores it)
function wp_get_attachment_url_client(attId, entry) {
    return entry?.url || '';
}

async function idtCacheModalRemove(attId) {
    const res = await idtFetch('ttr_idt_remove_from_cache', { attachment_id: attId });
    if (res?.success) {
        document.getElementById('idt-cm-row-' + attId)?.remove();
        IDT.cacheCount = Math.max(0, (IDT.cacheCount || 1) - 1);
        if (idtDisplayData) idtRenderResults(idtDisplayData);
    } else {
        alert('Remove failed: ' + (res?.data?.message ?? 'unknown'));
    }
}

async function idtCacheModalDelete(attId) {
    if (!confirm('Permanently delete image #' + attId + ' from the server? This cannot be undone.')) return;
    const res = await idtFetch('ttr_delete_single_unused_image', { attachment_id: attId });
    if (res?.success) {
        // Also remove from cache
        await idtFetch('ttr_idt_remove_from_cache', { attachment_id: attId });
        document.getElementById('idt-cm-row-' + attId)?.remove();
        IDT.cacheCount = Math.max(0, (IDT.cacheCount || 1) - 1);
    } else {
        alert('Delete failed: ' + (res?.data?.message ?? 'unknown'));
    }
}

async function idtCacheModalBlacklist(attId, btn) {
    const reason = prompt('Add #' + attId + ' to blacklist.\nOptional reason:', '');
    if (reason === null) return;
    btn.disabled = true;
    btn.textContent = '…';
    const res = await idtFetch('ttr_images_blacklist_add', { attachment_id: attId, reason: reason });
    if (res?.success) {
        btn.textContent = '🚫 Listed';
        btn.style.opacity = '0.5';
    } else {
        btn.disabled = false;
        btn.textContent = '🚫 Blacklist';
        alert('Blacklist failed: ' + (res?.data?.message ?? 'unknown'));
    }
}