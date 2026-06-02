const limit = 10; 
var offset = 0; 
var rotation = 0;
var inProgress = false;
var stopExecution = false;

async function testaroo_qa_product_analysis_run_batch(isInit, continueAtThisOffset) {
    if(!isInit && stopExecution) {
        inProgress = false;
        return;
    }
    else if (isInit) {
        stopExecution = false;
		document.querySelector("#resultsOfMassBrokenImageFix").parentElement.style.display = "none";
		document.querySelector("#resultsOfMassTooSmallImageFix").parentElement.style.display = "none";
		document.querySelector("#resultsOfMassPromoteGalleryFix").parentElement.style.display = "none";
		
        // Save delimiter and minimum image size to tools-settings on every new scan
        let batchDelimVal = document.querySelector("#batch-image-splicing-delimiter").value;
        try {
            await fetch(TTR.ajaxUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "ttr_save_tools_setting",
                    nonce:  TTR.nonce,
                    key:    'imageSizeDelimiter',
                    value:  JSON.stringify(batchDelimVal)
                })
            });
            if (typeof ToolsSettingsManager !== 'undefined') {
                ToolsSettingsManager.getSettings().imageSizeDelimiter = batchDelimVal;
            }
        } catch (e) {
            console.log("Error saving imageSizeDelimiter setting: " + e.message);
        }

        let minImgDimensionVal = document.querySelector("#batch-minimum-img-size").value;
        try {
            await fetch(TTR.ajaxUrl, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    action: "ttr_save_tools_setting",
                    nonce:  TTR.nonce,
                    key:    'minimumImageDimensions',
                    value:  JSON.stringify(minImgDimensionVal)
                })
            });
            if (typeof ToolsSettingsManager !== 'undefined') {
                ToolsSettingsManager.getSettings().minimumImageDimensions = minImgDimensionVal;
            }
        } catch (e) {
            console.log("Error saving minimumImageDimensions setting: " + e.message);
        }
    }
    
    inProgress = true;
    isContinue = false;
    if(typeof continueAtThisOffset != "undefined" && parseInt(continueAtThisOffset) > 0) {
        offset = parseInt(continueAtThisOffset);
        isContinue = true;   
    } else if (isInit) {
        offset = parseInt(elBatchStartIndexInput().value || 0);
    }
    
    let resultsTableOuter = elBatchTestResults();
    let resultsTable = resultsTableOuter.querySelector("tbody");
    if(!resultsTable) {        
        resultsTableOuter.innerHTML += "<tbody></tbody>";    
        resultsTable = resultsTableOuter.querySelector("tbody");
    }
        
    if (isInit && resultsTable && !isContinue) {
        resultsTable.innerHTML = "";
        batchActiveFilters.clear();
        batchCurrentPage = 1;
        document.getElementById('ttr-batch-filter-bar')?.remove();
    }
    
    elStop().style = "display:inline-block;";
    var res = null;
    try {
        res = await fetch(TTR.ajaxUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                action: "testaroo_batch",
                nonce: TTR.nonce,
                limit: limit,
                offset: offset
            })
        });
    } catch (e) {
        elBatchError().style = "display:inline-block;";
        return;
    }
        
    const data = await res.json();
    rotation += 20; 
    elSpinner().style.transform = `rotate(${rotation}deg)`;
    offset += data.batch_size; 
    let percent = (offset / data.total) * 100;

    elCountProcessed().innerText = `Processed ${offset}/${data.total}`;
    elCurrentOffset().value = offset; 
    elPercentageProcessed().innerText = percent.toFixed(2) + "%"; 
    
    data.results.forEach(item => 
    { 
       let itemHasErrors = item.has_no_category 
            || item.has_only_uncategorized 
            || item.has_no_product_image 
            || (item.url_broken_images && item.url_broken_images.length > 0) 
            || (item.too_small_images && item.too_small_images.length > 0); 
       if (itemHasErrors) 
       { 
           let data = GenerateHtmlAndJson(item); 
           resultsTable.insertAdjacentHTML('beforeend', data.html);
           const formData = new FormData(); 
           formData.append('action', 'testaroo_append_result'); 
		   formData.append('nonce', TTR.nonce);
           formData.append('data', data.json); 
           fetch(TTR.ajaxUrl, { method: 'POST', body: formData, }); } 
    });
    
    if (offset < parseInt(data.total)) 
	{
        await testaroo_qa_product_analysis_run_batch(false); 
	}
    else 
	{
		paginateResults();
		inProgress = false;
	}
}

function renderExistingBatchRunResults() {
    const allCallsBroken = [];
    const allCallsTooSmall = [];
    const allCallsPromoteGallery = [];
    if (typeof TTR !== 'undefined' && TTR.results && TTR.results.length > 0) {
        const html = TTR.results.slice().reverse().map(item => {
            if (item.url_broken_images && item.url_broken_images.length > 0) {
                allCallsBroken.push({
                    product_id: item.product_id,
                    image_url:  item.url_broken_images[0].url,
                });
            }
            if (item.too_small_images && item.too_small_images.length > 0) {
                allCallsTooSmall.push({
                    product_id: item.product_id,
                    image_url:  item.too_small_images[0].url,
                });
            }
            if (item.has_gallery_image_available && item.first_gallery_image_id) {
                allCallsPromoteGallery.push({
                    product_id:    item.product_id,
                    attachment_id: item.first_gallery_image_id,
                });
            }
            return GenerateHtmlAndJson(item).html;
        }).join('');

        elResults().innerHTML            = html;
        elMassTryFixBrokenImagesCalls().value = JSON.stringify(allCallsBroken);
        elMassTryFixTooSmallImagesCalls().value = JSON.stringify(allCallsTooSmall);
        elMassTryFixPromoteGalleryCalls().value = JSON.stringify(allCallsPromoteGallery);
    }

    elTryFixAllBrokenImagesRegion().style.display =
        allCallsBroken.length > 0 ? 'block' : 'none';
        
    elTryFixAllTooSmallImagesRegion().style.display =
        allCallsTooSmall.length > 0 ? 'inline-block' : 'none';

    elTryFixAllPromoteGalleryRegion().style.display =
        allCallsPromoteGallery.length > 0 ? 'inline-block' : 'none';
}


function GenerateHtmlAndJson(item) {
    let itemStorageJson = {};
    itemStorageJson.product_id = item.product_id;
    itemStorageJson.product_name = item.product_name;
    var html = `<tr><td><div class="product-toggle" onclick="ToggleBatchFailureDetails(this);"> 
                <div class="status-indicator warning"> 
                    <div>x</div> 
                </div> 
                <div class="product-name">${item.product_name}</div> 
            </div> 
            <div class="product-details-region"> 
                <div class="product-details-toggle warning" onclick="ToggleBatchFailureDetails(this);"> 
                <div class="product-name">`;
    
    hiddenInputFlags = [];
    html += AddQaErrorNotice(`<a href='${TTR.adminUrl}post.php?post=${item.product_id}&action=edit'>Edit Product</a>`);

    itemStorageJson.has_no_category = item.has_no_category; 
    itemStorageJson.has_only_uncategorized = item.has_only_uncategorized;
    itemStorageJson.has_no_product_image = item.has_no_product_image;
    itemStorageJson.has_gallery_image_available = item.has_gallery_image_available;
    itemStorageJson.first_gallery_image_id = item.first_gallery_image_id;
    itemStorageJson.product_attributes = item.product_attributes;
    elClearBatchRunResultsRegion().style = "display:inline-block;";
	
	if(item.url_broken_images || item.too_small_images || (item.has_no_product_image && item.has_gallery_image_available))
    	elmainButtonsBatchRun().classList.remove('center-main-batch-run-buttons');
    
    if (item.has_no_category)
    {
         html += AddQaErrorNotice(`Has no categories!`); 
         hiddenInputFlags.push("has_no_category");
    }

    if (item.has_only_uncategorized)
    {
        html += AddQaErrorNotice(`Has only "uncategorized category!`); 
        hiddenInputFlags.push("has_only_uncategorized");
    }

    if (item.has_no_product_image)
    {
        hiddenInputFlags.push("has_no_product_image");

        // If a gallery image exists, offer a one-click promote button
        var galleryNotice = '';
        if (item.has_gallery_image_available && item.first_gallery_image_id) {
            galleryNotice = `<button
                class="ttr-promote-gallery-btn"
                onclick="ttrPromoteGalleryImage(${escapeHtml(item.product_id)}, ${escapeHtml(item.first_gallery_image_id)}, this)">
                ✔ Use Existing Gallery Image
            </button>
            <span class="ttr-promote-gallery-hint">Gallery image found — no thumbnail set</span>`;

            // Queue for bulk promote-gallery fix
            elTryFixAllPromoteGalleryRegion().style = 'display:inline-block;';
            const promoteCallsEl = elMassTryFixPromoteGalleryCalls();
            const promoteCalls = promoteCallsEl.value ? JSON.parse(promoteCallsEl.value) : [];
            promoteCalls.push({ product_id: item.product_id, attachment_id: item.first_gallery_image_id });
            promoteCallsEl.value = JSON.stringify(promoteCalls);
        }

        html += AddQaErrorNotice(`
            Has no product thumbnail!
            ${galleryNotice}
            <button 
                class="try-find-missing-images-button"
                onclick='offerMissingProductImages(this,event)'
                data-product-name="${escapeHtml(item.product_name)}"
                data-product-id="${escapeHtml(item.product_id)}"
                data-product-attributes="${escapeHtml(JSON.stringify(item.product_attributes || []))}"
                data-attributes-scanned="${item.product_attributes !== undefined ? '1' : '0'}">
                Find Replacement Images
            </button>
            <div class='replace-images-container'></div>
        `);
    }

    itemStorageJson.url_broken_images = item.url_broken_images;
    if (item.url_broken_images && item.url_broken_images.length > 0) 
    {
        elTryFixAllBrokenImagesRegion().style = "display:block;";
        hiddenInputFlags.push("has_broken_images");
        let index = 0;
        let fixImagesButtonImageUrl = '';
        item.url_broken_images.forEach(img => {
            index++
            let fixImagesButton = `<button class="try-fix-img-button" onclick="TestarooFixImage(${item.product_id}, '${escapeHtml(item.product_name)}', '${img.url}', this, ${escapeHtml(JSON.stringify(item.product_attributes || []))})">
                Try Fix Images
            </button>`;
            let removeRefButton = `<button class="ttr-remove-broken-ref-button" onclick="ttrRemoveBrokenReference(${item.product_id}, '${escapeHtml(img.url)}', this)">
                Remove Broken Reference
            </button>`;
            let shouldInsertButton = index == item.url_broken_images.length;
            if(shouldInsertButton)
                fixImagesButtonImageUrl = img.url;
            html += AddQaErrorNotice(`
                Found Broken Image:  <a href='${img.url}'>Image ${index}</a>
                    ${(shouldInsertButton ? fixImagesButton : '')}
                    ${removeRefButton}
                <div style="display:none;color:rgb(15 203 15);padding:5px;">Trying fix...</div>
                <div class="ttr-remove-ref-result" style="display:none;padding:5px;"></div>
            `);
        });
        
        let tryFixImagesScriptEl = elMassTryFixBrokenImagesCalls();
        let existingCalls = tryFixImagesScriptEl.value ? JSON.parse(tryFixImagesScriptEl.value) : [];
        existingCalls.push({
            product_id: item.product_id,
            image_url: fixImagesButtonImageUrl
        });
        tryFixImagesScriptEl.value = JSON.stringify(existingCalls);
    }
    
    itemStorageJson.too_small_images = item.too_small_images;
    if (item.too_small_images && item.too_small_images.length > 0) {
        elTryFixAllTooSmallImagesRegion().style = "display:inline-block;";
        hiddenInputFlags.push("has_too_small_images");
        let attachment_id = 0;
        item.too_small_images.forEach(img => {
            html += AddQaErrorNotice(`
                Image too small (${img.width}x${img.height}px):
                <a href='${img.url}' target='_blank'>View</a>
                <button 
                    class="try-pad-fix-button"
                    onclick="tryFixImageScaling(event);" 
                    data-product-id="${item.product_id}"
                    data-attachment-id="${img.attachment_id}">
                    Try Pad & Fix
                </button>
                <span class="upscale-result" style="display:none;padding:5px;"></span>
            `);
            attachment_id = img.attachment_id;
        });
        
                
        let tryFixTooSmallScriptEl = elMassTryFixTooSmallImagesCalls();
        let existingCalls = tryFixTooSmallScriptEl.value ? JSON.parse(tryFixTooSmallScriptEl.value) : [];
        existingCalls.push({
            product_id: item.product_id,
            attachment_id: attachment_id
        });
        tryFixTooSmallScriptEl.value = JSON.stringify(existingCalls);
    }

    html += `</div></div></div></td></tr><input type="hidden" value="${hiddenInputFlags.join(",")}"/></div>`;
    return {
        html: html,
        json: JSON.stringify(itemStorageJson)
    };
}

function AddQaErrorNotice(errorItemContent) {
    return `<div class="link-qa-notice"> ${errorItemContent} </div>`;
} 

function ToggleBatchFailureDetails(el) { 
    if(jQuery(el.nextElementSibling).is(':visible')) 
        jQuery(el.nextElementSibling).slideUp(400); 
    else 
        jQuery(el.nextElementSibling).slideDown(400); 
}

function tryFixImageScaling(e) {
    const productId    = e.target.dataset.productId;
    const attachmentId = e.target.dataset.attachmentId;
    TestarooUpscaleImage(productId, attachmentId, e.target);
}

var productMissingImageStagedForFix = null;
var productMissingImageName = null;
var productMissingImageId = null;
var productMissingImageAttributes = [];
var productMissingImageAttributesStale = false;
var productMissingImageLastSearchTerm = null;

async function offerMissingProductImages(thisButton, e) {
    let imgCntnr = elAddNewImagesModalImageContainer();
    imgCntnr.innerHTML = "";
    imgCntnr.style.display = "none";

    productMissingImageStagedForFix = thisButton.closest('td').querySelector('.product-toggle');

    elAddNewImagesModalWrapper().style.display = "inline-block";
    var rgBtn = elImageResultsGoogleBtn();
    if (rgBtn) rgBtn.style.display = 'none';
    elNoImagesFoundError().style.display = "none";
    elConfirmAddNewImageModal().style.display = "none";
    elImageSearchLoader().style.display = "none";
    elAddNewImagesClearResults().style.display = "none";
    elGoBackToSearch().style.display = "none";
    elImageSearchSuffix().value = "";
    elImageSearchCustomToggle().checked = false;
    elImageUrlInput().value = "";
    elImageUrlError().style.display = "none";
    elBody().style = "overflow:hidden;"; 
    idtToggleCustomSearch(elImageSearchCustomToggle());
    elEditedImagesSuccessfullyAdded().style.display = "none";
    
    productMissingImageName = e.target.dataset.productName;
    productMissingImageId   = e.target.dataset.productId;

    var rawAttrs = e.target.dataset.productAttributes;
    productMissingImageAttributesStale = (e.target.dataset.attributesScanned !== '1');
    try {
        productMissingImageAttributes = JSON.parse(rawAttrs || "[]");
    } catch(err) {
        productMissingImageAttributes = [];
        productMissingImageAttributesStale = true;
    }

    elAddNewImagesModalLinkHeader().href = `${TTR.adminUrl}post.php?post=${productMissingImageId}&action=edit`;
    elAddNewImagesModalLinkHeader().textContent = productMissingImageName

    elImageSearchRegion().style.display = "inline-block";
    idtUpdateSearchPreview();
    idtRenderAttributeFoldout();
    idtRenderSitesFoldout();
}

// Updates the "current search term" preview text below the search field
function idtUpdateSearchPreview() {
    const suffix   = elImageSearchSuffix().value.trim();
    const isCustom = elImageSearchCustomToggle().checked;
    const preview  = elImageSearchTermPreview();
    if (!preview) return;

    if (isCustom) {
        preview.style.display = "none";
    } else {
        const term = suffix ? (productMissingImageName + " " + suffix) : productMissingImageName;
        preview.style.display = "block";
        preview.querySelector(".image-search-term-preview-value").textContent = term;
        var googleBtn = elImageSearchGoogleBtn();
        if (googleBtn) {
            googleBtn.href = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(term);
        }
    }
}

// Shows the search term used below the product link — hidden if it matches the bare product name
function idtShowUsedSearchTerm(term) {
    var el = elImageSearchUsedTerm();
    if (!el) return;
    if (!term || term === productMissingImageName) {
        el.style.display = "none";
    } else {
        el.querySelector(".image-search-used-term-value").textContent = term;
        el.style.display = "block";
    }
}

// Appends a value to the search suffix field (works regardless of toggle state)
function idtAppendAttribute(value) {
    const input   = elImageSearchSuffix();
    const current = input.value.trim();
    input.value   = current ? current + " " + value : value;
    input.focus();
    idtUpdateSearchPreview();
}

// Builds the attributes foldout content
function idtRenderAttributeFoldout() {
    const body = elImageAttributeFoldoutBody();
    if (!body) return;

    body.innerHTML = "";

    if (productMissingImageAttributesStale) {
        body.innerHTML = "<div class='image-attribute-empty' style='margin-bottom:15px;'><em>(Flagged as possibly stale data)</em></div>";
    }
    if (!productMissingImageAttributes || productMissingImageAttributes.length === 0) {
        body.innerHTML = "<div class='image-attribute-empty'>No attributes found for this product.</div>";
        return;
    }

    productMissingImageAttributes.forEach(function(attr) {
        var groupEl = document.createElement("div");
        groupEl.className = "image-attribute-group";

        var labelEl = document.createElement("div");
        labelEl.className = "image-attribute-label";
        labelEl.textContent = attr.label;
        groupEl.appendChild(labelEl);

        var valuesEl = document.createElement("div");
        valuesEl.className = "image-attribute-values";

        if (attr.values.length === 0) {
            var emptySpan = document.createElement("span");
            emptySpan.className = "image-attribute-empty";
            emptySpan.textContent = "No values set";
            valuesEl.appendChild(emptySpan);
        } else {
            attr.values.forEach(function(val) {
                var chip = document.createElement("div");
                chip.className = "image-attribute-chip";

                var nameSpan = document.createElement("span");
                nameSpan.className = "image-attribute-chip-name";
                nameSpan.textContent = val;

                var appendBtn = document.createElement("button");
                appendBtn.className = "image-attribute-append-btn";
                appendBtn.textContent = "+ Append";
                appendBtn.setAttribute("onclick", "idtAppendAttribute('" + escapeHtml(val) + "')");

                chip.appendChild(nameSpan);
                chip.appendChild(appendBtn);
                valuesEl.appendChild(chip);
            });
        }

        groupEl.appendChild(valuesEl);
        body.appendChild(groupEl);
    });
}

// Toggle the attribute foldout open/closed
function idtToggleAttributeFoldout() {
    const body   = elImageAttributeFoldoutBody();
    const toggle = elImageAttributeFoldoutToggle();
    if (!body) return;
    const isOpen       = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    toggle.textContent = isOpen ? "\u25B6 Product Attributes For Search" : "\u25BC Product Attributes For Search";
}

function idtToggleCustomSearch(checkbox) {
    const input  = elImageSearchSuffix();
    const hint   = elImageSearchSuffixHint();
    const label  = elImageSearchSuffixLabel();

    input.classList.remove("image-search-suffix-required");

    if (checkbox.checked) {
        label.textContent = "Custom search term:";
        input.placeholder = "Enter full search term\u2026";
        hint.style.display = "none";
        input.focus();
    } else {
        label.textContent = "Append to search name (e.g. colour/variant):";
        input.placeholder = "e.g. Black, OD Green...";
        hint.style.display = "inline";
    }

    idtUpdateSearchPreview();
}

// Shared result renderer — called by both triggerImageSearch and triggerUrlPreview
function idtShowSearchRegions(visible) {
    elImageSearchRegion().style.display = visible ? "inline-block" : "none";
}

function idtRenderImageResults(images) {
    let container = elAddNewImagesModalImageContainer();
    if (images.length === 0) {
        elNoImagesFoundError().style.display = "inline-block";
        return;
    }
    for (let i = 0; i < images.length; i++) {
        let imgUrl = images[i].url;
        var imgTag  = document.createElement("img");
        imgTag.setAttribute("onclick", "showConfirmAddImageToProductModal(event);");
        imgTag.setAttribute("data-image-url", imgUrl);
        imgTag.setAttribute("data-product-id", productMissingImageId);
        imgTag.setAttribute("src", imgUrl);
        container.appendChild(imgTag);
    }
    elAddNewImagesClearResults().style.display = "inline-block";
    elAddNewImagesModalImageContainer().style.display = "inline-block";
    // Show Google Images button in header with the current search term
    var resultsGoogleBtn = elImageResultsGoogleBtn();
    if (resultsGoogleBtn && productMissingImageLastSearchTerm) {
        resultsGoogleBtn.href = "https://www.google.com/search?tbm=isch&q=" + encodeURIComponent(productMissingImageLastSearchTerm);
        resultsGoogleBtn.style.display = "inline-block";
    }
}

async function triggerImageSearch() {
    const suffix   = elImageSearchSuffix().value.trim();
    const isCustom = elImageSearchCustomToggle().checked;

    if (isCustom && !suffix) {
        elImageSearchSuffix().classList.add("image-search-suffix-required");
        elImageSearchSuffix().focus();
        return;
    }

    const searchName = isCustom ? suffix : (suffix ? (productMissingImageName + " " + suffix) : productMissingImageName);
    productMissingImageLastSearchTerm = searchName;

    idtShowSearchRegions(false);
    elNoImagesFoundError().style.display = "none";
    elImageSearchLoader().style.display = "inline-block";
    elAddNewImagesClearResults().style.display = "none";

    const checkedDomains = idtGetCheckedSites();
    const res = await fetch(TTR.ajaxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            action: "ttr_find_product_images",
                nonce: TTR.nonce,
            product_name: searchName,
            search_domains: JSON.stringify(checkedDomains)
        })
    });

    elGoBackToSearch().style.display = "inline-block";
    elImageSearchLoader().style.display = "none";
    const data = await res.json();
    idtRenderImageResults(data.data.images);
    idtShowUsedSearchTerm(searchName);
    return { status: data.data.status, message: data.data.message };
}

async function triggerUrlPreview() {
    const imageUrl = elImageUrlInput().value.trim();
    const errorEl  = elImageUrlError();
    errorEl.style.display = "none";

    if (!imageUrl) {
        errorEl.textContent   = "Please paste an image URL first.";
        errorEl.style.display = "inline-block";
        return;
    }

    idtShowSearchRegions(false);
    elGoBackToSearch().style.display = "inline-block";
    elNoImagesFoundError().style.display = "none";
    elImageSearchLoader().style.display = "inline-block";
    elAddNewImagesClearResults().style.display = "none";
    elAddNewImagesModalImageContainer().innerHTML = "";
    elAddNewImagesModalImageContainer().style.display = "none";

    const res = await fetch(TTR.ajaxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            action:    "ttr_preview_url_image",
                nonce: TTR.nonce,
            image_url: imageUrl
        })
    });

    elImageSearchLoader().style.display = "none";
    const data = await res.json();

    if (data.data.status === "error" || data.data.images.length === 0) {
        const msg = data.data.message || "Could not load that image URL. Check the URL and try again.";
        errorEl.textContent   = msg;
        errorEl.style.display = "inline-block";
        idtShowSearchRegions(true);
        return;
    }

    productMissingImageLastSearchTerm = imageUrl;
    idtRenderImageResults(data.data.images);
    idtShowUsedSearchTerm(imageUrl);
}

function goBackToImageSearch() {
    var rgBtn = elImageResultsGoogleBtn();
    if (rgBtn) rgBtn.style.display = 'none';
    let imgCntnr = elAddNewImagesModalImageContainer();
    imgCntnr.innerHTML = "";
    idtShowUsedSearchTerm(null);
    imgCntnr.style.display = "none";
    elEditedImagesSuccessfullyAdded().style.display = "none";    
    elNoImagesFoundError().style.display = "none";
    elAddNewImagesClearResults().style.display = "none";
    elConfirmAddNewImageModal().style.display = "none";
    elGoBackToSearch().style.display = "none";
    
    elImageSearchSuffix().value = "";
    elImageSearchCustomToggle().checked = false;
    elImageUrlInput().value = "";
    elImageUrlError().style.display = "none";
    idtToggleCustomSearch(elImageSearchCustomToggle());
    idtShowSearchRegions(true);
}

function showConfirmAddImageToProductModal(e)
{
    let confirmButton = elConfirmButton();
    confirmButton.dataset.productId = e.target.dataset.productId;
    confirmButton.dataset.productUrl = e.target.dataset.imageUrl;
    confirmButton.style = "visibility: visible;";
    // Store on edit button too so editor knows what to load
    let editBtn = elEditImageButton();
    if (editBtn) {
        editBtn.dataset.imageUrl   = e.target.dataset.imageUrl;
        editBtn.dataset.productId  = e.target.dataset.productId;
    }
    elConfirmResponseMessage().innerText = "";  
    elConfirmAddNewImageModal().style = "display:inline-block;";
}

async function attachExternalImageToProduct(e)
{
    let img_url = e.target.dataset.productUrl;
    let product_id = e.target.dataset.productId;

    // Show loading indicator in place of Confirm button
    let confirmButton = elConfirmButton();
    confirmButton.style.visibility = "hidden";
    let loadingEl = document.querySelector(".confirm-add-new-image-loading");
    if (!loadingEl) {
        loadingEl = document.createElement("span");
        loadingEl.className = "confirm-add-new-image-loading image-search-loader";
        confirmButton.parentNode.insertBefore(loadingEl, confirmButton);
    }
    loadingEl.style.display = "inline-block";

    const res = await fetch(TTR.ajaxUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            action: "ttr_apply_product_image",
                nonce: TTR.nonce,
            product_id: product_id,
            image_url: img_url
        })
    });
    
    loadingEl.style.display = "none";
    const data = await res.json();
    let responseMessage = elConfirmResponseMessage();
    if (!data.success)
    {
        confirmButton.style.visibility = "visible";
        responseMessage.style = "color:red;";
        responseMessage.innerText = "There was an error attempting to add this image to your product";    
    }
    else 
    {
        let noticeEls = productMissingImageStagedForFix.nextElementSibling.getElementsByClassName("link-qa-notice");
        let willBeTotallyFixed = noticeEls.length == 2;
        for(let x = 0; x < noticeEls.length > 0; x++)
        {
            if(noticeEls[x].textContent.includes("Has no product image"))
            {
                noticeEls[x].textContent = "Image added!"
                break;
            }
        }
        
        if(willBeTotallyFixed)
        {
            let status_indicator = productMissingImageStagedForFix.querySelector(".status-indicator");
            status_indicator.style = "color:green !important;";
            status_indicator.textContent = "✔";
        }
        
        fetch(TTR.ajaxUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: "testaroo_remove_result",
                nonce: TTR.nonce,
                product_id: product_id
            })
        });
            
        responseMessage.style = "color:green;";
        responseMessage.innerText = "Success!";
        confirmButton.style = "visibility: hidden;";
        
        let tryFindMissingImageButton = productMissingImageStagedForFix.nextElementSibling.querySelector('.try-find-missing-images-button');
        if(tryFindMissingImageButton)
            tryFindMissingImageButton.style.display = "none";
    }
}

async function ttrRemoveBrokenReference(productId, imageUrl, btn)
{
    btn.disabled    = true;
    btn.textContent = 'Removing…';
    const resultEl  = btn.parentElement.querySelector(".ttr-remove-ref-result");

    const res  = await fetch(TTR.ajaxUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:     'ttr_remove_broken_image_reference',
                nonce: TTR.nonce,
            product_id: productId,
            image_url:  imageUrl,
        })
    });
    const data = await res.json();

    btn.style.display = 'none';
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.style.color   = data.status === 'success' ? 'orange' : '#888';
        resultEl.textContent   = '↳ ' + (data.message ?? 'Done');
    }
}

async function TestarooFixImage(productId, productName, imageUrl, thisButton, product_attributes)
{
    let isMassFix = typeof thisButton == "undefined";
    let resultEl = null;
    if(!isMassFix)
    {
        resultEl = thisButton.parentElement.querySelector(".ttr-remove-ref-result");
        thisButton.style.display = "none";
        resultEl.style.display = "inline-block";        
    }

    const res = await fetch(TTR.ajaxUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            action: "testaroo_try_fix_image",
                nonce: TTR.nonce,
            product_id: productId,
            image_url: imageUrl
        })
    });
    const data = await res.json();

    if(!isMassFix)
    {
        resultEl.textContent  = `${data.status} -> ${data.message}`;
        if(data.status == "error")
            resultEl.style = `padding: 5px; color: red !important;`;
    }
    else {
        let tryFixResultsEl = elMassTryFixBrokenImagesResults();
        tryFixResultsEl.value = tryFixResultsEl.value + `${data.status}--${data.message}|`;
    }
        
    if(!data.success && data.status != "skipped" && !isMassFix)
    {
        thisButton.outerHTML = `<button 
                class="try-find-missing-images-button"
                onclick='offerMissingProductImages(this,event)'
                data-product-name="${escapeHtml(productName)}"
                data-product-id="${escapeHtml(productId)}"
                data-product-attributes="${escapeHtml(JSON.stringify(product_attributes || []))}">
                Find Replacement Images
            </button>`;
    }
    
    return {status: data.status, message: data.message };
}

async function TestarooUpscaleImage(productId, attachment_id, thisButton) {
    let isMassFix = typeof thisButton == "undefined";
    if(!isMassFix)
    {
        thisButton.style.display = 'none';
        const resultEl = thisButton.nextElementSibling;
        resultEl.style.display = 'inline-block';
        resultEl.textContent = 'Upscaling...';      
    } 

    const res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:        'testaroo_upscale_image',
                nonce: TTR.nonce,
            product_id:    productId,
            attachment_id:     attachment_id,
        })
    });

    const data = await res.json();
    if(!isMassFix)
    {
        const resultEl = thisButton.nextElementSibling;
        resultEl.textContent = `${data.status} -> ${data.message}`;
        if (data.status === 'success') {
            resultEl.style.color = 'green';
            resultEl.innerHTML = `${data.message} — <a href='${data.url}' target='_blank'>View</a> | <a href='${data.edit_url}' target='_blank'>Edit Product</a>`;
        } else if (data.status === 'skipped') {
            resultEl.style.color = 'orange';
            resultEl.innerHTML = `Already padded — <a href='${data.url}' target='_blank'>View existing</a>`;
        } else {
            resultEl.style.color = 'red';
            resultEl.textContent = `Failed: ${data.message}`;
        }
    }
    else 
    {
        let tryFixResultsEl = elMassTryFixTooSmallImagesResults();
        tryFixResultsEl.value = tryFixResultsEl.value + `${data.status}--${data.message}|`;
    }
    return {status: data.status, message: data.message };
}

// ── Pagination for #batch-test-results table ──────────────────────────────────────────
const TTR_PAGE_SIZE = 20;

// ── Batch test error-type filter state ───────────────────────────────────────
// Set of flag strings currently active as filters. Empty = show all.
let batchActiveFilters = new Set();
let batchCurrentPage = 1;

const BATCH_FILTER_LABELS = {
    'has_no_category':        'No Category',
    'has_only_uncategorized': 'Only Uncategorized',
    'has_no_product_image':   'No Product Image',
    'has_broken_images':      'Broken Images',
    'has_too_small_images':   'Too-Small Images',
};

/**
 * Scan all current rows, collect every error flag present, and re-render
 * the filter bar so new filters appear as the batch run proceeds.
 * Called after every batch and on page load with existing results.
 */
function syncBatchFilterBar() {
    const table = elBatchTestResults();
    if (!table) return;

    // Collect all flags present in any row
    const presentFlags = new Set();
    table.querySelectorAll('input[type="hidden"]').forEach(input => {
        (input.value || '').split(',').forEach(f => { if (f) presentFlags.add(f); });
    });

    if (presentFlags.size === 0) {
        // No filters to show — remove bar if present
        document.getElementById('ttr-batch-filter-bar')?.remove();
        return;
    }

    // Find or create the filter bar (insert before the table's parent wrap)
    let bar = document.getElementById('ttr-batch-filter-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'ttr-batch-filter-bar';
        bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0 4px;'
            + 'font-family:\'DM Mono\',monospace;font-size:11px;border-bottom:1px solid #333;margin-bottom:8px;';
        const label = document.createElement('span');
        label.textContent = 'Filter:';
        label.style.cssText = 'color:#888;text-transform:uppercase;letter-spacing:1px;';
        bar.appendChild(label);

        const allBtn = document.createElement('button');
        allBtn.id = 'ttr-batch-filter-all';
        allBtn.textContent = 'All';
        allBtn.onclick = () => { batchActiveFilters.clear(); applyBatchFilter(); syncBatchFilterBar(); };
        styleBatchFilterBtn(allBtn, true);
        bar.appendChild(allBtn);

        // Insert before the table
        table.parentNode.insertBefore(bar, table);
    }

    // Add a button for every flag not yet in the bar
    presentFlags.forEach(flag => {
        const btnId = 'ttr-batch-filter-' + flag;
        if (document.getElementById(btnId)) return; // already exists

        const btn = document.createElement('button');
        btn.id = btnId;
        btn.dataset.flag = flag;
        btn.textContent = BATCH_FILTER_LABELS[flag] || flag;
        btn.onclick = () => { toggleBatchFilter(flag); };
        styleBatchFilterBtn(btn, false);
        bar.appendChild(btn);
    });

    // Refresh active-state styling
    bar.querySelectorAll('button[data-flag]').forEach(btn => {
        styleBatchFilterBtn(btn, batchActiveFilters.has(btn.dataset.flag));
    });
    const allBtn = document.getElementById('ttr-batch-filter-all');
    if (allBtn) styleBatchFilterBtn(allBtn, batchActiveFilters.size === 0);
}

function styleBatchFilterBtn(btn, isActive) {
    btn.style.cssText = `
        padding:4px 10px;border-radius:4px;cursor:pointer;
        font-family:'DM Mono',monospace;font-size:11px;
        border:1px solid ${isActive ? 'var(--ttr-accent,#c9a84c)' : 'var(--ttr-border,#333)'};
        background:${isActive ? 'var(--ttr-accent,#c9a84c)' : 'transparent'};
        color:${isActive ? '#0e0e0f' : 'var(--ttr-muted,#888)'};
        transition:all .15s;
    `;
}

function toggleBatchFilter(flag) {
    if (batchActiveFilters.has(flag)) {
        batchActiveFilters.delete(flag);
    } else {
        batchActiveFilters.add(flag);
    }
    applyBatchFilter();
    syncBatchFilterBar();
}

/**
 * Show/hide rows based on batchActiveFilters.
 * A row is shown if ANY of its flags matches ANY active filter.
 * If no filters are active, all rows are shown.
 * Importantly: when a row is shown, ALL its error details are shown — we only
 * hide/show at the product row level.
 * After filtering, re-run pagination so page numbers reflect visible rows.
 */
function applyBatchFilter() {
    const table = elBatchTestResults();
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr:has(.product-toggle)'));
    rows.forEach(row => {
        if (batchActiveFilters.size === 0) {
            row.style.display = '';
            return;
        }
        // Find the adjacent hidden input (it's a sibling after the </tr>)
        // In the DOM the hidden input is inside a stray </div> after the tr —
        // check all inputs in the table and match by position
        const allInputs = Array.from(table.querySelectorAll('input[type="hidden"]'));
        const allRows   = Array.from(table.querySelectorAll('tr:has(.product-toggle)'));
        const rowIdx    = allRows.indexOf(row);
        const input     = allInputs[rowIdx];
        const flags     = input ? (input.value || '').split(',') : [];
        const matches   = flags.some(f => batchActiveFilters.has(f));
        row.style.display = matches ? '' : 'none';
    });

    paginateResults();
}

function paginateResults(userTriggered = false) {
    const table = elBatchTestResults();
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tr:has(.product-toggle)')).filter(r => r.style.display !== 'none');
    if (rows.length === 0) {
        elsTtwPagination().forEach(el => el.remove());
        syncBatchFilterBar();
        return;
    }

    const totalPages = Math.ceil(rows.length / TTR_PAGE_SIZE);

    if (batchCurrentPage > totalPages) batchCurrentPage = totalPages;
    if (batchCurrentPage < 1)          batchCurrentPage = 1;

    // Only actually hide/show rows when triggered by user interaction or scan completion
    // During an active scan just update the controls so numbers stay accurate
    if (userTriggered || !inProgress) {
        showPage(batchCurrentPage);
    } else {
        renderControls();
    }

    function showPage(page) {
        batchCurrentPage = page;
        const start = (page - 1) * TTR_PAGE_SIZE;
        const end   = start + TTR_PAGE_SIZE;

        rows.forEach((row, i) => {
            row.style.display = (i >= start && i < end) ? '' : 'none';
        });

        renderControls();
    }

    function renderControls() {
        // Remove existing controls if re-rendering
        elsTtwPagination().forEach(el => el.remove());

        const wrap = document.createElement('div');
        wrap.classList.add('ttr-pagination');
        wrap.style.cssText = `
            display: flex; align-items: center; gap: 8px;
            padding: 16px 0 8px; font-family: 'DM Mono', monospace;
            font-size: 12px; color: var(--ttr-muted);
        `;

        const prev = document.createElement('button');
        prev.textContent = '← Prev';
        prev.disabled    = batchCurrentPage === 1;
        prev.onclick     = () => showPage(batchCurrentPage - 1);
        stylePageBtn(prev, false);

        const next = document.createElement('button');
        next.textContent = 'Next →';
        next.disabled    = batchCurrentPage === totalPages;
        next.onclick     = () => showPage(batchCurrentPage + 1);
        stylePageBtn(next, false);

        const label = document.createElement('span');
        const start = (batchCurrentPage - 1) * TTR_PAGE_SIZE + 1;
        const end   = Math.min(batchCurrentPage * TTR_PAGE_SIZE, rows.length);
        label.textContent = `${start}–${end} of ${rows.length}`;
        label.style.cssText = 'flex: 1; text-align: center;';

        // Page number buttons
        const pageButtons = document.createElement('div');
        pageButtons.style.cssText = 'display: flex; gap: 4px;';
        for (let p = 1; p <= totalPages; p++) {
            const btn = document.createElement('button');
            btn.textContent = p;
            btn.onclick     = () => showPage(p);
            stylePageBtn(btn, p === batchCurrentPage);
            pageButtons.appendChild(btn);
        }

        wrap.appendChild(prev);
        wrap.appendChild(label);
        wrap.appendChild(pageButtons);
        wrap.appendChild(next);

        // Insert above and below the table
        table.parentNode.insertBefore(wrap, table);
        table.parentNode.insertBefore(wrap.cloneNode(true), table.nextSibling);

        // Re-bind cloned buttons
        const clonedBtns = table.nextSibling.querySelectorAll('button');
        clonedBtns[0].onclick = () => showPage(batchCurrentPage - 1);
        clonedBtns[0].disabled = batchCurrentPage === 1;
        clonedBtns[clonedBtns.length - 1].onclick = () => showPage(batchCurrentPage + 1);
        clonedBtns[clonedBtns.length - 1].disabled = batchCurrentPage === totalPages;
        for (let p = 1; p <= totalPages; p++) {
            clonedBtns[p].onclick = () => showPage(p);
        }
    }

    function stylePageBtn(btn, isActive) {
        btn.style.cssText = `
            padding: 5px 12px;
            border-radius: 4px;
            border: 1px solid ${isActive ? 'var(--ttr-accent)' : 'var(--ttr-border)'};
            background: ${isActive ? 'var(--ttr-accent)' : 'transparent'};
            color: ${isActive ? '#0e0e0f' : 'var(--ttr-muted)'};
            font-family: 'DM Mono', monospace;
            font-size: 11px; cursor: pointer;
            transition: all .15s;
        `;
    }

    showPage(batchCurrentPage);
    syncBatchFilterBar();
}

function buildResultsHtml(results) {
    // Deduplicate/merge: if the same product_id appears multiple times 
    // in BATCH.results (from multiple batch runs), merge their failures
    const merged = {};
    for (const item of results) {
        if (!merged[item.product_id]) {
            merged[item.product_id] = { ...item };
        } else {
            // Merge arrays, avoiding duplicates by url/attachment_id
            merged[item.product_id].url_broken_images = [
                ...merged[item.product_id].url_broken_images,
                ...item.url_broken_images
            ].filter((v, i, a) => a.findIndex(x => x.url === v.url) === i);

            merged[item.product_id].too_small_images = [
                ...merged[item.product_id].too_small_images,
                ...item.too_small_images
            ].filter((v, i, a) => a.findIndex(x => x.attachment_id === v.attachment_id) === i);

            // Merge any other boolean flags
            merged[item.product_id].has_no_category        |= item.has_no_category;
            merged[item.product_id].has_only_uncategorized |= item.has_only_uncategorized;
            merged[item.product_id].has_no_product_image   |= item.has_no_product_image;
        }
    }

    return Object.values(merged);
}

// ── Search Sites Foldout ─────────────────────────────────────────────────────

function idtGetDefaultSites() {
    // Returns array of {url, category} objects from settings
    if (TTR && TTR.settings && Array.isArray(TTR.settings.searchSites) && TTR.settings.searchSites.length > 0) {
        return TTR.settings.searchSites.map(function(s) {
            // Support both old string format and new object format
            return typeof s === 'string' ? { url: s, category: '' } : s;
        });
    }
    return [];
}

function idtRenderSitesFoldout() {
    const body = elImageSearchSitesBody();
    if (!body) return;
    body.innerHTML = '';

    const sites = idtGetDefaultSites();

    // ── Category filter buttons ───────────────────────────────────────────────
    var categories = [];
    sites.forEach(function(s) {
        if (s.category && categories.indexOf(s.category) === -1) {
            categories.push(s.category);
        }
    });

    var catRow = document.createElement('div');
    catRow.className = 'image-search-sites-cat-row';

    // "All" button
    var allBtn = document.createElement('button');
    allBtn.textContent = 'All';
    allBtn.className = 'image-search-sites-cat-btn';
    allBtn.onclick = function() { idtSelectSitesByCategory(null, sites); };
    catRow.appendChild(allBtn);

    // One button per category
    categories.forEach(function(cat) {
        var btn = document.createElement('button');
        btn.textContent = cat;
        btn.className = 'image-search-sites-cat-btn';
        btn.onclick = function() { idtSelectSitesByCategory(cat, sites); };
        catRow.appendChild(btn);
    });

    body.appendChild(catRow);

    // ── Nested "Specific Sites" foldout ───────────────────────────────────────
    var specificToggle = document.createElement('button');
    specificToggle.className = 'image-search-sites-specific-toggle';
    specificToggle.textContent = '\u25B6 Specific Sites';
    specificToggle.onclick = function() {
        var specificBody = document.getElementById('image-search-specific-sites-body');
        var isOpen = specificBody.style.display !== 'none';
        specificBody.style.display = isOpen ? 'none' : 'block';
        specificToggle.textContent = (isOpen ? '\u25B6' : '\u25BC') + ' Specific Sites';
    };
    body.appendChild(specificToggle);

    var specificBody = document.createElement('div');
    specificBody.id = 'image-search-specific-sites-body';
    specificBody.style.display = 'block';

    // Uncheck all / Check all row inside specific sites
    var controlsRow = document.createElement('div');
    controlsRow.className = 'image-search-sites-controls';
    var checkAllBtn = document.createElement('button');
    checkAllBtn.className = 'image-search-sites-all-btn';
    checkAllBtn.textContent = 'Check All';
    checkAllBtn.onclick = function() { idtToggleAllSites(true); };
    var uncheckAllBtn = document.createElement('button');
    uncheckAllBtn.className = 'image-search-sites-all-btn';
    uncheckAllBtn.textContent = 'Uncheck All';
    uncheckAllBtn.onclick = function() { idtToggleAllSites(false); };
    controlsRow.appendChild(checkAllBtn);
    controlsRow.appendChild(uncheckAllBtn);
    specificBody.appendChild(controlsRow);

    // Individual site checkboxes
    var siteList = document.createElement('div');
    siteList.id = 'image-search-sites-list';
    siteList.className = 'image-search-sites-list';

    sites.forEach(function(site) {
        var row = document.createElement('label');
        row.className = 'image-search-site-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.className = 'image-search-site-checkbox settings-checkbox';
        cb.dataset.site = site.url;
        cb.style.cssText = 'min-height:14px!important;min-width:14px!important;margin-top:0!important;margin-right:6px!important;flex-shrink:0;';
        var labelEl = document.createElement('span');
        labelEl.textContent = site.url;
        if (site.category) {
            var catTag = document.createElement('span');
            catTag.textContent = site.category;
            catTag.className = 'image-search-site-cat-tag';
            row.appendChild(cb);
            row.appendChild(labelEl);
            row.appendChild(catTag);
        } else {
            row.appendChild(cb);
            row.appendChild(labelEl);
        }
        siteList.appendChild(row);
    });

    specificBody.appendChild(siteList);
    body.appendChild(specificBody);
}

// Fire-and-forget: select all sites in a category (or all if cat is null)
function idtSelectSitesByCategory(cat, sites) {
    elsImageSearchSiteCheckboxes().forEach(function(cb) {
        if (cat === null) {
            cb.checked = true;
        } else {
            var site = sites.find(function(s) { return s.url === cb.dataset.site; });
            cb.checked = site ? site.category === cat : false;
        }
    });
}

function idtToggleSitesFoldout() {
    const body   = elImageSearchSitesBody();
    const toggle = document.querySelector('.image-search-sites-toggle');
    if (!body) return;
    const isOpen       = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    toggle.textContent = (isOpen ? '\u25B6' : '\u25BC') + ' Search Sites';
}

function idtToggleAllSites(checked) {
    elsImageSearchSiteCheckboxes().forEach(function(cb) {
        cb.checked = checked;
    });
}

function idtGetCheckedSites() {
    var checked = [];
    elsImageSearchSiteCheckboxChecked().forEach(function(cb) {
        checked.push(cb.dataset.site);
    });
    return checked;
}

// ============================================================
// TTR Image Editor
// ============================================================

var ttrEditor = {
    canvas:        null,
    ctx:           null,
    originalImage: null,       // ImageData of original full-res
    current:       null,       // ImageData of latest committed state (post-fill)
    history:       [],         // stack of ImageData snapshots for undo
    mode:          'sample',   // 'sample' | 'draw'
    sampledColor:  null,       // { r, g, b }
    isDrawing:     false,
    startX:        0,
    startY:        0,
    productId:     null,
    imageUrl:      null,
    scale:         1,          // displayWidth / naturalWidth
    overlayCanvas: null,
    overlayCtx:    null,
    _bound:        false,
};

async function ttrOpenImageEditor() {
    var editBtn = elEditImageButton();
    if (!editBtn) return;

    ttrEditor.imageUrl  = editBtn.dataset.imageUrl;
    ttrEditor.productId = editBtn.dataset.productId;

    if (!ttrEditor.imageUrl) return;

    // Show modal with loading state immediately
    var modal = elTtwImageEditorModal();
    modal.style.display = 'block';
    elTtwEditorStatus().textContent = 'Downloading image…';
    elTtwEditorConfirmBtn().disabled = true;

    // Fetch image server-side to avoid CORS restrictions
    var res;
    try {
        res = await fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action:    'ttr_proxy_image_for_editor',
                nonce: TTR.nonce,
                image_url: ttrEditor.imageUrl,
            })
        });
    } catch(err) {
        elTtwEditorStatus().textContent = 'Network error fetching image: ' + err.message;
        return;
    }

    var data = await res.json();
    if (!data.success) {
        elTtwEditorStatus().textContent =
            'Could not download image: ' + (data.data ? data.data.message : 'unknown error');
        return;
    }

    // Load the proxied data URL into a canvas — no CORS issues
    var img = new Image();
    img.onload = function() {
        var canvas       = elTtwEditorCanvas();
        ttrEditor.canvas = canvas;
        ttrEditor.ctx    = canvas.getContext('2d');

        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ttrEditor.ctx.drawImage(img, 0, 0);

        ttrEditor.originalImage = ttrEditor.ctx.getImageData(0, 0, canvas.width, canvas.height);
        ttrEditor.current       = ttrEditor.originalImage;
        ttrEditor.history       = [];
        ttrEditor.sampledColor  = null;
        ttrEditor.mode          = 'sample';

        canvas.style.maxWidth = '90vw';
        canvas.style.height   = 'auto';

        elTtwEditorConfirmBtn().disabled = false;
        ttrEditorSetMode('sample');
        elTtwEditorColorSwatch().style.background = '#888';
        ttrEditorBindEvents();
    };
    img.onerror = function() {
        elTtwEditorStatus().textContent = 'Failed to render downloaded image.';
    };
    img.src = data.data.data_url;
}

function ttrEditorGetScale() {
    var canvas = ttrEditor.canvas;
    if (!canvas) return 1;
    return canvas.width / canvas.getBoundingClientRect().width;
}

function ttrEditorBindEvents() {
    var canvas = ttrEditor.canvas;

    // Remove any previously attached listeners by using named handlers stored on the object
    // This avoids cloneNode which wipes canvas pixel data
    if (ttrEditor._bound) {
        canvas.removeEventListener('mousedown',  ttrEditorMouseDown);
        canvas.removeEventListener('mousemove',  ttrEditorMouseMove);
        canvas.removeEventListener('mouseup',    ttrEditorMouseUp);
        canvas.removeEventListener('mouseleave', ttrEditorMouseLeave);
    }

    canvas.addEventListener('mousedown',  ttrEditorMouseDown);
    canvas.addEventListener('mousemove',  ttrEditorMouseMove);
    canvas.addEventListener('mouseup',    ttrEditorMouseUp);
    canvas.addEventListener('mouseleave', ttrEditorMouseLeave);
    ttrEditor._bound = true;
}

function ttrEditorCanvasCoords(e) {
    var rect  = ttrEditor.canvas.getBoundingClientRect();
    var scale = ttrEditorGetScale();
    return {
        x: Math.round((e.clientX - rect.left) * scale),
        y: Math.round((e.clientY - rect.top)  * scale),
    };
}

function ttrEditorMouseDown(e) {
    var pos = ttrEditorCanvasCoords(e);
    if (ttrEditor.mode === 'sample') {
        ttrEditorSampleColor(pos.x, pos.y);
        ttrEditorSetMode('draw'); // auto-switch after one sample
    } else if (ttrEditor.mode === 'draw') {
        if (!ttrEditor.sampledColor) {
            elTtwEditorStatus().textContent = 'Sample a colour first before drawing a fill area.';
            return;
        }
        ttrEditor.isDrawing = true;
        ttrEditor.startX    = pos.x;
        ttrEditor.startY    = pos.y;
    }
}

function ttrEditorMouseMove(e) {
    if (!ttrEditor.isDrawing || ttrEditor.mode !== 'draw') return;
    var pos  = ttrEditorCanvasCoords(e);
    var rect = ttrEditor.canvas.getBoundingClientRect();

    // Draw overlay preview — we draw on top of current canvas pixels temporarily
    var ctx    = ttrEditor.ctx;
    var startX = ttrEditor.startX;
    var startY = ttrEditor.startY;

    // Restore latest committed state before re-drawing preview
    ctx.putImageData(ttrEditor.current, 0, 0);

    var c = ttrEditor.sampledColor;
    ctx.save();
    ctx.strokeStyle = 'rgba(201,168,76,0.9)';
    ctx.lineWidth   = Math.max(1, Math.round(2 / (rect.width / ttrEditor.canvas.width)));
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
    ctx.restore();
}

function ttrEditorMouseUp(e) {
    if (!ttrEditor.isDrawing || ttrEditor.mode !== 'draw') return;
    ttrEditor.isDrawing = false;
    var pos = ttrEditorCanvasCoords(e);
    ttrEditorApplyFill(ttrEditor.startX, ttrEditor.startY, pos.x, pos.y);
}

function ttrEditorMouseLeave(e) {
    if (ttrEditor.isDrawing) {
        ttrEditor.isDrawing = false;
        // Restore latest committed state without the preview stroke
        ttrEditor.ctx.putImageData(ttrEditor.current, 0, 0);
    }
}

function ttrEditorSampleColor(x, y) {
    var ctx    = ttrEditor.ctx;
    var canvas = ttrEditor.canvas;
    var half   = 2; // 5x5 sample = ±2 from centre
    var x0     = Math.max(0, x - half);
    var y0     = Math.max(0, y - half);
    var w      = Math.min(canvas.width  - x0, half * 2 + 1);
    var h      = Math.min(canvas.height - y0, half * 2 + 1);
    var data   = ctx.getImageData(x0, y0, w, h).data;

    var r = 0, g = 0, b = 0, count = 0;
    for (var i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    ttrEditor.sampledColor = { r, g, b };

    var hex = '#' + [r, g, b].map(function(v) {
        return v.toString(16).padStart(2, '0');
    }).join('');
    elTtwEditorColorSwatch().style.background = hex;
    elTtwEditorStatus().textContent =
        'Sampled colour: ' + hex + ' — now drag to select the area to fill.';
}

function ttrEditorApplyFill(x1, y1, x2, y2) {
    var ctx    = ttrEditor.ctx;
    var canvas = ttrEditor.canvas;

    // Normalise so x1,y1 is top-left
    var rx = Math.min(x1, x2);
    var ry = Math.min(y1, y2);
    var rw = Math.abs(x2 - x1);
    var rh = Math.abs(y2 - y1);

    // Restore latest committed state to wipe the drag preview stroke
    ctx.putImageData(ttrEditor.current, 0, 0);

    if (rw < 2 || rh < 2) {
        elTtwEditorStatus().textContent = 'Selection too small — drag a larger area.';
        return;
    }

    // Push current state to undo history BEFORE applying fill
    ttrEditor.history.push(ttrEditor.current);

    // Fill the rectangle
    var c = ttrEditor.sampledColor;
    ctx.save();
    ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

    // Update current to the new post-fill state
    ttrEditor.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    elTtwEditorStatus().textContent =
        'Fill applied. Sample again or draw another area. (' + ttrEditor.history.length + ' edit' +
        (ttrEditor.history.length !== 1 ? 's' : '') + ' — Undo available)';
}

function ttrEditorSetMode(mode) {
    ttrEditor.mode = mode;
    var canvas = ttrEditor.canvas;
    if (canvas) {
        canvas.style.cursor = mode === 'sample' ? 'crosshair' : 'cell';
    }
    elTtwEditorBtnSample().classList.toggle('ttr-editor-tool-active', mode === 'sample');
    elTtwEditorBtnDraw().classList.toggle('ttr-editor-tool-active',   mode === 'draw');
    if (mode === 'sample') {
        elTtwEditorStatus().textContent = 'Click anywhere to sample a background colour.';
    } else {
        var msg = ttrEditor.sampledColor
            ? 'Click and drag to select the area to fill.'
            : 'Sample a colour first, then drag to fill.';
        elTtwEditorStatus().textContent = msg;
    }
}

function ttrEditorUndo() {
    if (ttrEditor.history.length === 0) {
        elTtwEditorStatus().textContent = 'Nothing to undo.';
        return;
    }
    var prev = ttrEditor.history.pop();
    ttrEditor.ctx.putImageData(prev, 0, 0);
    ttrEditor.current = prev;
    elTtwEditorStatus().textContent =
        'Undone. ' + (ttrEditor.history.length > 0
            ? ttrEditor.history.length + ' edit(s) remaining.'
            : 'Back to original.');
}

function ttrEditorReset() {
    ttrEditor.ctx.putImageData(ttrEditor.originalImage, 0, 0);
    ttrEditor.current      = ttrEditor.originalImage;
    ttrEditor.history      = [];
    ttrEditor.sampledColor = null;
    elTtwEditorColorSwatch().style.background = '#888';
    ttrEditorSetMode('sample');
    elTtwEditorStatus().textContent = 'Reset to original. Click to sample a colour.';
}

function ttrEditorCancel() {
    elTtwImageEditorModal().style.display = 'none';
    ttrEditor.history = [];
}

async function ttrEditorConfirm() {
    var canvas    = ttrEditor.canvas;
    var productId = ttrEditor.productId;
    var statusEl  = elTtwEditorStatus();

    statusEl.textContent = 'Uploading edited image…';
    elTtwEditorConfirmBtn().disabled = true;

    // Export canvas as PNG blob → base64
    var dataUrl = canvas.toDataURL('image/png');
    var base64  = dataUrl.split(',')[1];

    const res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:     'ttr_upload_edited_image',
                nonce: TTR.nonce,
            product_id: productId,
            image_data: base64,
        })
    });

    elTtwEditorConfirmBtn().disabled = false;
    const data = await res.json();

    if (!data.success) {
        statusEl.style.color = '#e05555';
        statusEl.textContent = 'Upload failed: ' + (data.data ? data.data.message : 'unknown error');
        return;
    }

    // Close editor and confirm modals, update UI same as normal confirm flow
    elTtwImageEditorModal().style.display = 'none';
    elConfirmAddNewImageModal().style.display = 'none';

    // Mirror the success UI updates from attachExternalImageToProduct
    if (productMissingImageStagedForFix) {
        var noticeEls = productMissingImageStagedForFix.nextElementSibling.getElementsByClassName('link-qa-notice');
        for (var x = 0; x < noticeEls.length; x++) {
            if (noticeEls[x].textContent.includes('Has no product image')) {
                noticeEls[x].textContent = 'Image added!';
                break;
            }
        }
        if (noticeEls.length === 2) {
            var si = productMissingImageStagedForFix.querySelector('.status-indicator');
            if (si) { si.style = 'color:green !important;'; si.textContent = '✔'; }
            elEditedImagesSuccessfullyAdded().style.display = "inline-block";
        }
    }

    fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:     'testaroo_remove_result',
                nonce: TTR.nonce,
            product_id: productId,
        })
    });

    elAddNewImagesModalImageContainer().style.display = 'none';
    ttrEditor.history = [];
}


async function ttrPromoteGalleryImage(productId, attachmentId, btn) {
    btn.disabled = true;
    btn.textContent = 'Promoting…';

    const res = await fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:        'ttr_promote_gallery_image',
                nonce: TTR.nonce,
            product_id:    productId,
            attachment_id: attachmentId,
        })
    });

    const data = await res.json();

    if (!data.success) {
        btn.disabled = false;
        btn.textContent = '✔ Use Existing Gallery Image';
        btn.style.borderColor = '#e05555';
        btn.style.color       = '#e05555';
        btn.title = data.data ? data.data.message : 'Failed';
        return;
    }

    // Success — update the notice text and mark the row fixed
    var notice = btn.closest('.link-qa-notice');
    if (notice) notice.textContent = 'Thumbnail set from gallery image ✔';

    // Remove from saved results
    fetch(TTR.ajaxUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action:     'testaroo_remove_result',
                nonce: TTR.nonce,
            product_id: productId,
        })
    });
}

function ClearBatchRun() {
    ClearBatchRunFile();
    elmainButtonsBatchRun().classList.add('center-main-batch-run-buttons');
    elTryFixAllBrokenImagesRegion().style.display = 'none';
    elTryFixAllTooSmallImagesRegion().style.display = 'none';
    elTryFixAllPromoteGalleryRegion().style.display = 'none';
    elClearBatchRunResultsRegion().style = 'display:none;';
    document.querySelectorAll(".results-container").forEach(el => el.style.display = 'none');
    elResultsOfMassTooSmallImageFix().innerHTML = "";
    elResultsOfMassBrokenImageFix().innerHTML = "";
    elBatchTestResults().innerHTML = '<tbody></tbody>';
    if(elBatchResultsPagination())
    	elBatchResultsPagination().remove();
    if(elsTtwPagination())
        elsTtwPagination().forEach(el => el.remove());

}

document.addEventListener("DOMContentLoaded", function () {
      waitForElementToExist('#massTryFixBrokenImages_Calls').then(() => {
        elTryFixAllBrokenImagesRegion().style.display   = 'none';
        elTryFixAllTooSmallImagesRegion().style.display = 'none';
        elTryFixAllPromoteGalleryRegion().style.display = 'none';

        waitForElementToExist('#massTryFixTooSmallImages_Calls').then(() => {
            fetch(TTR.ajaxUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'testaroo_get_results',
                    nonce:  TTR.nonce,
                })
            })
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.data || !data.data.results || data.data.results.length === 0) 
                    return;
 
                const mergedItems = buildResultsHtml(data.data.results.slice().reverse());
 
                const brokenCalls   = [];
                const tooSmallCalls = [];
                const promoteCalls  = [];
 
                const html = mergedItems.map(item => {
                    if (item.url_broken_images?.length > 0)
                        brokenCalls.push({ product_id: item.product_id, image_url: item.url_broken_images[0].url });
                    if (item.too_small_images?.length > 0)
                        tooSmallCalls.push({ product_id: item.product_id, attachment_id: item.too_small_images[0].attachment_id });
                    if (item.has_gallery_image_available && item.first_gallery_image_id)
                        promoteCalls.push({ product_id: item.product_id, attachment_id: item.first_gallery_image_id });
                    return GenerateHtmlAndJson(item).html;
                }).join('');
 
                elBatchTestResults().innerHTML          = html;
                elMassTryFixBrokenImagesCalls().value   = JSON.stringify(brokenCalls);
                elMassTryFixTooSmallImagesCalls().value = JSON.stringify(tooSmallCalls);
                elMassTryFixPromoteGalleryCalls().value = JSON.stringify(promoteCalls);
 
                elTryFixAllBrokenImagesRegion().style.display   = brokenCalls.length  > 0 ? 'block'        : 'none';
                elTryFixAllTooSmallImagesRegion().style.display = tooSmallCalls.length > 0 ? 'inline-block' : 'none';
                elTryFixAllPromoteGalleryRegion().style.display = promoteCalls.length  > 0 ? 'inline-block' : 'none';
 
                paginateResults();
            });
        });
    });

    waitForElementToExist('#clearBatchRunResultsBtn').then((el) => {
        el.addEventListener("click", function(e) {
            e.stopPropagation();
            e.preventDefault();
            ClearBatchRun();
        });
    });
    
    waitForElementToExist("#batch-image-splicing-delimiter").then((el) => {
        const ts = (typeof ToolsSettingsManager !== 'undefined') ? ToolsSettingsManager.getSettings() : {};
        el.value = ts.imageSizeDelimiter ?? BATCH.imageSizeDelimiter ?? '-';
    });

    waitForElementToExist("#batch-minimum-img-size").then((el) => {
        const ts = (typeof ToolsSettingsManager !== 'undefined') ? ToolsSettingsManager.getSettings() : {};
        el.value = ts.minimumImageDimensions ?? BATCH.minimumImageDimensions ?? 300;
    });
    
    waitForElementToExist("#stop").then((el) => {
        el.addEventListener("click", function(e) {
            e.stopPropagation();
            e.preventDefault();
            stopExecution = true;
        });
    });
    
    waitForElementToExist(".add-new-images-modal-close").then((el) => {
        el.addEventListener("click", function(e) {
            e.stopPropagation();
            e.preventDefault();
            elBody().style = "overflow:auto;";
            elAddNewImagesModalImageContainer().innerHTML = "";
            elNoImagesFoundError().style.display = "none";
            elAddNewImagesClearResults().style.display = "none";
            elImageSearchRegion().style.display = "none";
            idtShowUsedSearchTerm(null);
            var rgBtn = elImageResultsGoogleBtn();
            if (rgBtn) rgBtn.style.display = 'none';
            elImageSearchSuffix().value = "";
            elImageSearchCustomToggle().checked = false;
            elImageUrlInput().value = "";
            elImageUrlError().style.display = "none";
            idtToggleCustomSearch(elImageSearchCustomToggle());
            elAddNewImagesModalWrapper().style = "display:none;";
        });
    });    
    
    waitForElementToExist("#image-search-suffix").then((el) => {
        el.addEventListener("input", idtUpdateSearchPreview);
    });

    const saveButton = elTtwSaveBatchSettings();
    if (saveButton) {
        saveButton.addEventListener("click", async function () {

            const ignoredIds = elTtwIgnoredProductIds().value;
            const delimiter = elTtwImageDelimiter().value || "-";
            const minimumSize = elTtwMinimumImageDimensions().value || 300;

            await fetch(TTR.ajaxUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    action: "ttr_save_product_batch_settings",
                nonce: TTR.nonce,
                    delimiter: delimiter,
                    minimum_size: minimumSize
                })
            });

            await fetch(TTR.ajaxUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    action: "ttr_save_ignored_products",
                nonce: TTR.nonce,
                    product_ids: ignoredIds
                })
            });

            alert("Batch test settings saved.");
        });
    }
});