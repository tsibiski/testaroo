document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist("#convertSimpleCategoriesButton").then((el) => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            RunConvertSimpleCategories();
        });
    });
});

async function RunConvertSimpleCategories()
{
    const result = document.querySelector("#convert-simple-categories-wrapper").querySelector('.conversion-result');

    result.textContent = 'Running...';
    result.style = "display:block;";

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
                action: 'ttr_save_category_conversion_simple',
                nonce:  TTR.nonce,
                offset: offset,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            result.innerHTML = `<div>Error: ${data.data}</div>`;
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

    let results = `<div>Done. Processed ${totals.processed} products and updated ${totals.updated}.</div>`;

    for (let x = 0; x < updatedProducts.length; x++) {
        const product = updatedProducts[x];

        results += `<div><a href='/wp-admin/post.php?post=${product.product_id}&action=edit' target='_blank'>${product.product_name}</a></div>`;
    }

    result.innerHTML = results;
}
