document.addEventListener('DOMContentLoaded', function() {
    waitForElementToExist("#addParentCategoriesButton").then((el) => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            AddParentCategories();
        });
    });
});

async function AddParentCategories()
{
    const result = document.querySelector('.add-parent-categories-result');
    result.textContent = 'Running...';
    result.style = 'display:inline-block;';

    let offset = 0;
    let totals = { checked: 0, updated: 0, added: 0 };

    while (true) {
        const res  = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'ttr_add_parent_categories',
                nonce:  TTR.nonce,
                offset: offset,
            })
        });

        const data = await res.json();

        totals.checked += data.data.checked_count;
        totals.updated += data.data.updated_count;
        totals.added   += data.data.totalCategoriesAdded_count;

        result.textContent = `Batch Processing... (${totals.checked})`;

        if (data.data.done) 
            break;
        offset = data.data.next_offset;
    }
    let results = `Done. Checked ${totals.checked}, updated ${totals.updated}, added ${totals.added} categories.`;
    result.textContent = results;
}