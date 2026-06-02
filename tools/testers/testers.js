const elmainButtonsBatchRun            = () => document.getElementById('mainButtonsBatchRun');
const elBatchResultsPagination         = () => document.getElementById('ttr-batch-filter-bar');
const elAddNewImagesModalWrapper       = () => document.getElementById('add-new-images-modal-wrapper');
const elAddNewImagesModalImageContainer= () => document.getElementById('add-new-images-modal-image-container');
const elImageSearchRegion              = () => document.querySelector('.image-search-region');
const elImageSearchSuffix              = () => document.getElementById('image-search-suffix');
const elImageSearchCustomToggle        = () => document.getElementById('image-search-custom-toggle');
const elImageSearchSuffixHint          = () => document.getElementById('image-search-suffix-hint');
const elImageSearchTermPreview         = () => document.getElementById('image-search-term-preview');
const elImageSearchUsedTerm            = () => document.getElementById('image-search-used-term');
const elImageSearchGoogleBtn           = () => document.getElementById('image-search-google-btn');
const elImageSearchLoader              = () => document.querySelector('.image-search-loader');
const elImageSearchSitesBody           = () => document.getElementById('image-search-sites-body');
const elImageAttributeFoldoutBody      = () => document.getElementById('image-attribute-foldout-body');
const elImageAttributeFoldoutToggle    = () => document.querySelector('.image-attribute-foldout-toggle');
const elImageUrlInput                  = () => document.getElementById('image-url-input');
const elImageUrlError                  = () => document.querySelector('.image-url-error');
const elNoImagesFoundError             = () => document.querySelector('.no-images-found-error');
const elAddNewImagesClearResults       = () => document.querySelector('.add-new-images-clear-results');
const elGoBackToSearch                 = () => document.querySelector('.go-back-to-search');
const elConfirmAddNewImageModal        = () => document.querySelector('.confirm-add-new-image-modal');
const elConfirmButton                  = () => document.querySelector('.confirm-button');
const elEditImageButton                = () => document.querySelector('.edit-image-button');
const elConfirmResponseMessage         = () => document.querySelector('.confirm-add-new-image-buttons-response-message');
const elEditedImagesSuccessfullyAdded  = () => document.querySelector('.edited-images-successfully-added');
const elAddNewImagesModalLinkContainer = () => document.querySelector('.add-new-images-modal-link-container');
const elAddNewImagesModalLinkHeader    = () => document.querySelector('.add-new-images-modal-link');
const elImageSearchSuffixLabel         = () => document.querySelector('.image-search-suffix-label');
const elBody                           = () => document.querySelector('body');
const elBatchTestResults               = () => document.getElementById('batch-test-results');
const elClearBatchRunResultsRegion     = () => document.getElementById('clearBatchRunResultsRegion');
const elTryFixAllBrokenImagesRegion    = () => document.getElementById('tryFixAllBrokenImagesRegion');
const elTryFixAllTooSmallImagesRegion  = () => document.getElementById('tryFixAllTooSmallImagesRegion');
const elMassTryFixBrokenImagesResults  = () => document.getElementById('massTryFixBrokenImages_Results');
const elMassTryFixTooSmallImagesCalls  = () => document.getElementById('massTryFixTooSmallImages_Calls');
const elMassTryFixTooSmallImagesResults= () => document.getElementById('massTryFixTooSmallImages_Results');
const elSpinner                        = () => document.getElementById('spinner');
const elBatchError                     = () => document.getElementById('batchError');
const elCountProcessed                 = () => document.getElementById('countProcessed');
const elCurrentOffset                  = () => document.getElementById('currentOffset');
const elPercentageProcessed            = () => document.getElementById('percentageProcessed');
const elBatchStartIndexInput           = () => document.getElementById('batch-start-index-input');
const elBatchImageSplicingDelimiter    = () => document.getElementById('batch-image-splicing-delimiter');
const elBatchMinimumImgSize            = () => document.getElementById('batch-minimum-img-size');
const elTtwSaveBatchSettings           = () => document.getElementById('ttrSaveBatchSettings');
const elTtwImageDelimiter              = () => document.getElementById('ttrImageDelimiter');
const elTtwMinimumImageDimensions      = () => document.getElementById('ttrMinimumImageDimensions');
const elTtwIgnoredProductIds           = () => document.getElementById('ttrIgnoredProductIds');
const elTtwImageEditorModal            = () => document.getElementById('ttr-image-editor-modal');
const elTtwEditorStatus                = () => document.getElementById('ttr-editor-status');
const elTtwEditorColorSwatch           = () => document.getElementById('ttr-editor-color-swatch');
const elTtwEditorBtnSample             = () => document.getElementById('ttr-editor-btn-sample');
const elTtwEditorBtnDraw               = () => document.getElementById('ttr-editor-btn-draw');
const elTtwEditorCanvas                = () => document.getElementById('ttr-editor-canvas');
const elTtwEditorConfirmBtn            = () => document.querySelector('.ttr-editor-confirm-btn');
const elsImageSearchSiteCheckboxes     = () => document.querySelectorAll('.image-search-site-checkbox');
const elsImageSearchSiteCheckboxChecked= () => document.querySelectorAll('.image-search-site-checkbox:checked');
const elsTtwPagination                 = () => document.querySelectorAll('.ttr-pagination');
const elImageResultsGoogleBtn          = () => document.getElementById('image-results-google-btn');
const elNewScan                        = () => document.getElementById('newScan');
const elContinueScan                   = () => document.getElementById('continueScan');
const elStop                           = () => document.getElementById('stop');
const elTryFixAllBrokenImagesButton    = () => document.getElementById('tryFixAllBrokenImagesButton');
const elTryFixAllTooSmallImagesButton  = () => document.getElementById('tryFixAllTooSmallImagesButton');
const elTryFixAllPromoteGalleryButton  = () => document.getElementById('tryFixAllPromoteGalleryButton');
const elTryFixAllPromoteGalleryRegion  = () => document.getElementById('tryFixAllPromoteGalleryRegion');
const elMassTryFixBrokenImagesCalls    = () => document.getElementById('massTryFixBrokenImages_Calls');
const elResultsOfMassBrokenImageFix    = () => document.getElementById('resultsOfMassBrokenImageFix');
const elResultsOfMassTooSmallImageFix  = () => document.getElementById('resultsOfMassTooSmallImageFix');
const elMassTryFixPromoteGalleryCalls  = () => document.getElementById('massTryFixPromoteGallery_Calls');
const elResultsOfMassPromoteGalleryFix = () => document.getElementById('resultsOfMassPromoteGalleryFix');

// ── Element getters ───────────────────────────────────────────────────────────
const elIdtStatus             = () => document.getElementById('idtStatus');
const elIdtProgressBar        = () => document.getElementById('idtProgressBar');
const elIdtProgressWrap       = () => document.getElementById('idtProgressWrap');
const elIdtResults            = () => document.getElementById('idtResults');
const elIdtScanButton         = () => document.getElementById('idtScanButton');
const elIdtContinueButton     = () => document.getElementById('idtContinueButton');
const elIdtSkipUnused         = () => document.getElementById('idtSkipUnused');
const elIdtFilterS1           = () => document.getElementById('idtFilterS1');
const elIdtFilterS2           = () => document.getElementById('idtFilterS2');
const elIdtFilterS3           = () => document.getElementById('idtFilterS3');
const elIdtWrapper            = () => document.getElementById('image-duplicate-test-wrapper');
const elIdtButton             = () => document.getElementById('image-duplicate-test-button');
const elClearMissingImageResultsRegion = () => document.getElementById('clearMissingImageResultsRegion');
const elIdtIgnoreModalWrapper = () => document.getElementById('idt-ignore-modal-wrapper');
const elIdtIgnoreModalFilename= () => document.getElementById('idt-ignore-modal-filename');
const elIdtIgnoreModalReason  = () => document.getElementById('idt-ignore-modal-reason');
const elIdtIgnoreModalError   = () => document.getElementById('idt-ignore-modal-error');
const elIdtS3DeleteStatus     = () => document.getElementById('idt-s3-delete-status');
const elIdtIgnoreModalConfirmBtn = () => document.querySelector('#idt-ignore-modal button:last-child');
const elIdtFixAllBtn          = () => document.querySelector('.idt-section-actions .idt-fix-all-btn:not(.idt-fix-all-btn-danger)');
const elIdtFixAllDangerBtn    = () => document.querySelector('.idt-fix-all-btn-danger');
const elIdtFirstSection       = () => document.querySelector('.idt-section');

function initTestersTab() {
    const previousRunCount = BATCH?.previousRunCount ?? 0;
    if (previousRunCount === 0) {
        elContinueScan().style.display = 'none';
    }

    elNewScan().onclick = async () => {
        event.stopPropagation();
        event.preventDefault();
        elsTtwPagination().forEach(el => el.remove());
        await ClearBatchRunFile();
        ClearBatchRun();
        testaroo_qa_product_analysis_run_batch(true, 0);
        elNewScan().style.display      = 'none';
        elContinueScan().style.display = 'none';
        elStop().style.display      = 'display:inline-block;';
        let msg = `<div class='bulk-fix-in-progress-message'>Fix in progress! Progress will appear here shortly...</div>`;
        elResultsOfMassTooSmallImageFix().innerHTML = msg;
        elResultsOfMassBrokenImageFix().innerHTML = msg;
        elResultsOfMassPromoteGalleryFix().innerHTML = msg;
    };

    elContinueScan().onclick = async () => {
        event.stopPropagation();
        event.preventDefault();
        if(inProgress)
            return;
        testaroo_qa_product_analysis_run_batch(true, previousRunCount);
        elContinueScan().style.display = 'none';
        elNewScan().style.display      = 'none';
        elStop().style.display      = 'display:inline-block;';
    };

    elTryFixAllBrokenImagesButton().onclick = async (event) => 
    {
        event.stopPropagation();
        event.preventDefault();

        const calls = JSON.parse(elMassTryFixBrokenImagesCalls().value || '[]');
        const resultsContainer = elResultsOfMassBrokenImageFix();
        const removeUnfixable  = document.getElementById('removeUnfixableBrokenRefs')?.checked ?? false;
        window.scrollBy({ top: 600, behavior: 'smooth' });
        resultsContainer.parentElement.style = "display: inline-block;";
        let callsInProgressMessage = resultsContainer.querySelector(".bulk-fix-in-progress-message");
        for (const call of calls) {
            const result = await TestarooFixImage(call.product_id, call.image_url);
            if (callsInProgressMessage.checkVisibility())
                callsInProgressMessage.style.display = "none";

            const isNotFoundOnDisk = result.status === 'error'
                && result.message?.toLowerCase().includes('file not found on disk');

            let removeResult = null;
            if (removeUnfixable && isNotFoundOnDisk) {
                const removeRes = await fetch(TTR.ajaxUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        action:     'ttr_remove_broken_image_reference',
                nonce: TTR.nonce,
                        product_id: call.product_id,
                        image_url:  call.image_url,
                    })
                });
                removeResult = await removeRes.json();
            }

            resultsContainer.innerHTML += `
                <p>
                    <strong>Product</strong>: <a href='${TTR.adminUrl}post.php?post=${call.product_id}&action=edit'>${call.product_id}</a><br/>
                    <strong>Broken Image</strong>: <a href='${call.image_url}'>${call.image_url}</a><br/>
                    <span style='${result.status === 'error' ? 'color:red;' : 'color:green;'}'><strong>${result.status}</strong></span>
                    <span> ${result.message}</span>
                    ${removeResult ? `<br/><span style='color:${removeResult.status === "success" ? "orange" : "#888"};'>&#8627; ${removeResult.message}</span>` : ''}
                </p>`;
        }
    };
    
    elTryFixAllTooSmallImagesButton().onclick = async (event) => 
    {
        event.stopPropagation();
        event.preventDefault();
        const calls = JSON.parse(elMassTryFixTooSmallImagesCalls().value || '[]');
        const resultsContainer = elResultsOfMassTooSmallImageFix();
        window.scrollBy({
          top: 600,
          behavior: 'smooth'
        });
        resultsContainer.parentElement.style = "display: inline-block;";
        let callsInProgressMessage = resultsContainer.querySelector(".bulk-fix-in-progress-message");
        for (const call of calls) {
            const result = await TestarooUpscaleImage(call.product_id, call.attachment_id);
            if(callsInProgressMessage.checkVisibility())
                callsInProgressMessage.style.display = "none";            
            resultsContainer.innerHTML += `
                <p>
                    <strong>Product</strong>: <a href='${TTR.adminUrl}post.php?post=${call.product_id}&action=edit'>${call.product_id}</a><br/>
                    <span style='${result.status === 'error' ? 'color:red;' : 'color:green;'}'><strong>${result.status}</strong></span>
                    <span> ${result.message}</span>
                </p>`;
        }
    };

    elTryFixAllPromoteGalleryButton().onclick = async (event) =>
    {
        event.stopPropagation();
        event.preventDefault();
        const calls = JSON.parse(elMassTryFixPromoteGalleryCalls().value || '[]');
        const resultsContainer = elResultsOfMassPromoteGalleryFix();
        window.scrollBy({
          top: 600,
          behavior: 'smooth'
        });
        resultsContainer.parentElement.style = "display: inline-block;";
        let callsInProgressMessage = resultsContainer.querySelector(".bulk-fix-in-progress-message");
        for (const call of calls) {
            const res = await fetch(TTR.ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action:        'ttr_promote_gallery_image',
                nonce: TTR.nonce,
                    product_id:    call.product_id,
                    attachment_id: call.attachment_id,
                })
            });
            const data = await res.json();
            if(callsInProgressMessage.checkVisibility())
                callsInProgressMessage.style.display = "none";
            const ok = data.success;
            const msg = data.data?.message ?? (ok ? 'Promoted' : 'Failed');
            resultsContainer.innerHTML += `
                <p>
                    <strong>Product</strong>: <a href='${TTR.adminUrl}post.php?post=${call.product_id}&action=edit'>${call.product_id}</a><br/>
                    <span style='${ok ? 'color:green;' : 'color:red;'}'><strong>${ok ? 'success' : 'error'}</strong></span>
                    <span> ${msg}</span>
                </p>`;
        }
    };

    renderExistingBatchRunResults();
}

async function ClearBatchRunFile()
{
    try {
        await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'testaroo_clear_file', nonce: TTR.nonce })
        });
    } catch (e) {}
}