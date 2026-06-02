document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist("#decodeHtmlEntitiesButton").then((el) => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            RunDecodeHtmlEntities();
        });
    });
});

async function RunDecodeHtmlEntities() {
    const wrapper  = document.querySelector('#decode-html-entities-wrapper');
    const result   = wrapper ? wrapper.querySelector('.decode-html-entities-result') : null;
    const listEl   = wrapper ? wrapper.querySelector('.decode-html-entities-product-list') : null;

    if (result) {
        result.textContent = 'Running...';
        result.style.display = 'inline-block';
    }
    if (listEl) {
        listEl.innerHTML = '';
        listEl.style.display = 'none';
    }

    let offset  = 0;
    let totals  = { checked: 0, updated: 0 };
    let allProducts = [];

    while (true) {
        const res = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_decode_html_entities',
                nonce:  TTR.nonce,
                offset: offset,
            }),
        });

        const data = await res.json();

        if (!data.success || data.data.error) {
            if (result) result.textContent = 'Error: ' + data.data;
            return;
        }

        totals.checked += data.data.checked_count;
        totals.updated += data.data.updated_count;
        allProducts     = allProducts.concat(data.data.updated_products ?? []);

        if (result) {
            result.textContent = `Processing... (${totals.checked} checked, ${totals.updated} updated so far)`;
        }

        if (data.data.done) break;
        offset = data.data.next_offset;
    }

    if (result) {
        result.textContent = `Done. Checked ${totals.checked} products, decoded ${totals.updated}.`;
    }

    if (listEl && allProducts.length > 0) {
        listEl.style.display = 'block';
        listEl.innerHTML = allProducts.map(p =>
            `<div class="decode-result-row">
                <a href="/wp-admin/post.php?post=${p.product_id}&action=edit" target="_blank">${escapeHtml(p.product_name)}</a>
                <span class="decode-result-fields">${p.fields.join(', ')}</span>
            </div>`
        ).join('');
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
