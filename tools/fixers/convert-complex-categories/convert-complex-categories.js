document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist("#convertComplexCategoriesButton").then((el) => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            RunConvertComplexCategories();
        });
    });
});

async function RunConvertComplexCategories() {
    const result = document.querySelector("#convert-complex-categories-wrapper").querySelector('.conversion-result');

    if (result) {
        result.textContent = 'Running...';
        result.style.display = 'block';
    }

    let offset = 0;

    let totals = {
        processed: 0,
        updated: 0,
    };

    let updatedProducts = [];

    while (true) {
        const response = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_run_category_conversion_complex',
                nonce:  TTR.nonce,
                offset: offset,
            }),
        });

        const data = await response.json();

        if (!result) 
            return;
        
        if (!data.success) {
            const msg = typeof data.data === 'string' ? data.data : (data.data?.message ?? 'Unknown error');
            result.innerHTML = `<div class="ttr-error">Error: ${msg}</div>`;
            return;
        }

        totals.processed += data.data.productsProcessed;
        totals.updated += data.data.productsUpdated;

        updatedProducts = updatedProducts.concat(data.data.updatedProductsData ?? []);

        result.textContent = `Batch Processing... (${totals.processed})`;

        if (data.data.done)
            break;

        offset = data.data.next_offset;
    }

    let html = `<div>Done. Processed ${totals.processed} products and updated ${totals.updated}.</div>`;

    for (let i = 0; i < updatedProducts.length; i++) {
        const p = updatedProducts[i];

        html += `<div><a href="/wp-admin/post.php?post=${p.product_id}&action=edit" target="_blank">${p.product_name}</a></div>`;
    }

    result.innerHTML = html;
}
