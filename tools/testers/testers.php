<?php
	if ( ! defined( 'ABSPATH' ) ) {
		exit;
	}
    require_once plugin_dir_path(__FILE__) . 'product-batch-test/product-batch-test.php';
    require_once plugin_dir_path(__FILE__) . 'image-duplicate-test/image-duplicate-test.php';
    
    add_action('admin_enqueue_scripts', function ($hook) {
        if ($hook !== 'toplevel_page_testaroo') {
            return;
        }
        
        wp_enqueue_script(
            'ttr-testers-js',
            plugin_dir_url(__FILE__) . 'testers.js',
            [],
            filemtime(plugin_dir_path(__FILE__) . 'testers.js'),
            true
        );
    });

    function get_testers_html() {
?>
    <div id="image-duplicate-test-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
        <div class='button-fixer-tester-name'>
            <span>Image Duplicate &amp; Unused Finder</span>
        </div>
        <div class='button-fixer-tester-description' style='display: flex;'>
            <span>Scans all media library images and product attachments to find problems.</span>
            <ul style='padding: 0 10px 0 10px;'>
                <li>Finds and removes duplicate images on the same product</li>
                <li>Finds identical images shared across different products and consolidates them</li>
                <li>Finds images not attached to any product and safely moves them to trash</li>
            </ul>
        </div>
        <div class="button-fixer-tester-selected-options">
            <button id="idtScanButton" onclick="event.stopPropagation(); idtRunScan();">Run Scan</button>
                <button id="idtContinueButton" onclick="event.stopPropagation(); idtContinueScan();" style="display:none;">
                    Continue Scan
                </button>
                <div id="clearMissingImageResultsRegion" style="display:none;">
                    <div class='button-divider'>|</div>
                    <button  class="add-new-images-clear-results" id="idtClearImageDupeResultsBtn" onclick="event.stopPropagation(); idtClearResults();">
                        Clear Results
                    </button>
                </div>
                <label class="idt-scan-option" onclick="event.stopPropagation();">
                    <input id="idtSkipUnused" class="settings-checkbox" type="checkbox" onchange="idtToggleCustomSearch(this)" style='min-height: 20px !important;min-width: 20px !important;     margin-top: 0px !important;margin-right: 5px !important;'>
                    Skip unused image scan
                </label>
                <span id="idtSpinner"></span>
        </div>
    </div>
    <div id="image-duplicate-test-wrapper" class="wrap" style="display:none;">
        <div id="idtProgressWrap" class="idt-progress-wrap" style="display:none;">
            <div class="idt-progress-track">
                <div class="idt-progress-bar" id="idtProgressBar"></div>
            </div>
            <div class="idt-status" id="idtStatus">Starting scan…</div>
        </div>
        <div id="idtResults"></div>
    </div>

    <!-- IDT Ignore Image Modal -->
    <div id="idt-ignore-modal-wrapper" style="display:none;position:fixed;inset:0;z-index:9999;">
        <div style="position:absolute;inset:0;background:#888181;opacity:0.5;"></div>
        <div id="idt-ignore-modal" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:grey;border:2px solid var(--ttr-accent);border-radius:6px;padding:24px;z-index:10000;width:360px;font-family:'DM Mono',monospace;">
            <div style="font-size:14px;color:var(--ttr-accent);margin-bottom:16px;text-transform:uppercase;letter-spacing:1px;">Ignore This Image?</div>
            <div id="idt-ignore-modal-filename" style="font-size:12px;color:#e8e8e8;margin-bottom:16px;word-break:break-all;"></div>
            <label style="display:block;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Reason (optional)</label>
            <input id="idt-ignore-modal-reason" type="text" placeholder="Why is this image being ignored?" style="width:100%;background:#0e0e0f;color:#e8e8e8;border:1px solid #2e2e32;border-radius:4px;padding:7px 10px;font-family:'DM Mono',monospace;font-size:12px;box-sizing:border-box;margin-bottom:16px;">
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button onclick="idtIgnoreModalCancel()" style="padding:6px 16px;border:1px solid #2e2e32;color:#888;background:transparent;border-radius:4px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;">Cancel</button>
                <button onclick="idtIgnoreModalConfirm()" style="padding:6px 16px;border:1px solid var(--ttr-accent);color:var(--ttr-accent);background:transparent;border-radius:4px;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">Add to Ignore List</button>
            </div>
            <div id="idt-ignore-modal-error" style="display:none;margin-top:10px;font-size:11px;color:#e05555;"></div>
        </div>
    </div>
    <div id="batch-test-products-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
        <div class='button-fixer-tester-name'>
            <span>Product Batch Test</span>
        </div>
        <div class='button-fixer-tester-description' style='display: flex;'>
            <span>This scans all products in the database to find problems.</span>
            <ul style='padding: 0 10px 0 10px;'>
                <li>Reports broken images and no images</li>
                <li>Reports "uncategorized" or no categories</li>
                <li>Offers automated fix attempt for broken images, using file name to search all product images for matching image name(s) and applies them for you to confirm (jpg, png, gif, webp, bmp supported)</li>
            </ul>
        </div>
        <div class="button-fixer-tester-selected-options many-options">
            <div id="mainButtonsBatchRun" class='center-main-batch-run-buttons'>
                <button id="newScan">New Scan</button>
                <button id="continueScan">Continue Scan</button>
                <button id="stop" style="display:none;">Stop</button>
                <div id="spinner" style="display:none;">⟳</div>     
                <div id="clearBatchRunResultsRegion" style="display:none;">
                    <div class='button-divider'>|</div>
                    <button  class="add-new-images-clear-results" id="clearBatchRunResultsBtn">
                        Clear Results
                    </button>
                </div>
            </div>
            <div id="tryFixAllBrokenImagesRegion">
                <button id="tryFixAllBrokenImagesButton">
                    Try Fix Broken Images
                </button>
                <label class="ttr-inline-check" onclick="event.stopPropagation();">
                    <input type="checkbox" id="removeUnfixableBrokenRefs">
                    Also remove unfixable broken references
                </label>
            </div>
            <div id="tryFixAllTooSmallImagesRegion">
                <button id="tryFixAllTooSmallImagesButton">
                    Try Fix Small/Pixelated Images
                </button>
            </div>
            <div id="tryFixAllPromoteGalleryRegion">
                <button id="tryFixAllPromoteGalleryButton">
                    Try Fix: Promote Gallery Images
                </button>
            </div>
        </div>
    </div>
    <div class="results-container" style="margin-top:15px;">
        <div style="border:1px solid #2b2b2b;border-radius:6px;overflow:hidden;background:#050505;">
            <div style="padding:18px 28px;background:linear-gradient(to right,#241f08,#050505);border-bottom:1px solid #2b2b2b;font-size:18px;font-weight:600;color:#d6b36a;">
                Product Batch Test Settings
            </div>
    
            <div style="padding:28px;color:#f1f1f1;">
                <p style="margin-bottom:25px;line-height:1.8;">
                    Configure Product Batch Test scan behavior and image validation settings.
                </p>
    
                <details open>
                    <summary style="cursor:pointer;color:#d6b36a;letter-spacing:2px;font-size:13px;margin-bottom:25px;">
                        PRODUCT BATCH SETTINGS
                    </summary>
    
                    <div style="display:flex;flex-direction:column;gap:18px;max-width:600px;">
    
                        <div>
                            <label style="display:block;margin-bottom:8px;font-weight:600;">Image Filename Delimiter</label>
                            <input id="ttrImageDelimiter" type="text" value="<?php echo esc_attr(ttr_product_batch_test_get_settings()['imageSizeDelimiter']); ?>" style="width:120px;background:#111;color:#fff;border:1px solid #444;padding:10px;">
                        </div>
    
                        <div>
                            <label style="display:block;margin-bottom:8px;font-weight:600;">Minimum Image Dimensions</label>
                            <input id="ttrMinimumImageDimensions" type="number" min="1" value="<?php echo esc_attr(ttr_product_batch_test_get_settings()['minimumImageDimensions']); ?>" style="width:120px;background:#111;color:#fff;border:1px solid #444;padding:10px;">
                        </div>
    
                        <div>
                            <button id="ttrSaveBatchSettings">
                                Save Settings
                            </button>
                        </div>
    
                    </div>
                </details>
            </div>
        </div>
    </div>
    <div id="batch-test-products-wrapper" class="wrap">
       <div class='setting batch-run-setting'>
         <details>
             <summary class='optional-parameters' style="margin-top: 20px; cursor: pointer;">Optional Parameters</summary>
             <div style='width:1px;height:20px;'></div>
             <div style='display: inline-flex;margin: 10px 10px 10px 0'>
                <input id='batch-start-index-input' type='number' class='settings-input settings-non-checkbox-input' style='margin-top: 5px;' value="0" />
                <div class='setting-description'>
                Start at specific product index. Products roughly are checked in the same order every time. Only newly-imported/added products affect the order of scanning.
                </div>
             </div>
             <br />
             <div style='display: inline-flex;margin: 10px 10px 10px 0'>
             <input id='batch-image-splicing-delimiter' type='text' class='settings-input settings-non-checkbox-input' style='margin-top: 20px;'/>
                <div class='setting-description'>
                    This is the delimeter we use to search broken images for a matching file in other locations. For example, your product images may follow a pattern like, ".../CampAndGo_2PersonTent_RedAndGrey-600x600.png". The delimiter will be used to splice "600x600.png" off of the image name, and then the term "CampAndGo_2PersonTent_RedAndGrey" is used to find all matching images and their size variants wherever they may be located. The default delimiter is a "-", but it can be any string or character.
                </div>
             </div>
             <br />
             <div style='display: inline-flex;margin: 10px 10px 10px 0'>
                <input id='batch-minimum-img-size' style='margin-top: 12px;' type='number 'onfocusout="if(this.value > 800) this.value = 800; else if(this.value < 100) this.value = 100;"  min='100' max='800' class='settings-input settings-non-checkbox-input' />
                <div class='setting-description'>
                    Any primary/hero image smaller than this pixel width OR height is considered "too small" to be a hero image, and will likely be stretched on the product page. This does not include high DPI images which are excluded when found. The recommended value is 300 (pixels), but you can choose any value from 100 to 800.
                </div>
             </div>
         </details>
       </div>
    </div>
    <p id="batchError">
        A server error interrupted the scan. This most often happens due to this long batch process causing a stale session that needs to be refreshed. Please reload the page and select "Continue Scan".
    </p>
    <p id="countProcessed"></p>
    <input id="currentOffset" type="hidden" value="">
    <p id="percentageProcessed"></p>
    <div class='results-container'>
        <div id="resultsOfMassBrokenImageFix">
            <div class='bulk-fix-in-progress-message'>Fix in progress! Progress will appear here shortly...</div>
        </div>
    </div>
    <div class='results-container'>
        <div id="resultsOfMassTooSmallImageFix">
            <div class='bulk-fix-in-progress-message'>Fix in progress! Progress will appear here shortly...</div>

        </div>
    </div>
    <div class='results-container'>
        <div id="resultsOfMassPromoteGalleryFix">
             <div class='bulk-fix-in-progress-message'>Fix in progress! Progress will appear here shortly...</div>
        </div>
    </div>
    <table id="batch-test-results"><tbody></tbody></table>
    <input id="massTryFixBrokenImages_Calls"   type="hidden" value="">
    <input id="massTryFixBrokenImages_Results" type="hidden" value="">
    <input id="massTryFixTooSmallImages_Calls"   type="hidden" value="">
    <input id="massTryFixTooSmallImages_Results" type="hidden" value="">
    <input id="massTryFixPromoteGallery_Calls"   type="hidden" value="">
    <input id="massTryFixPromoteGallery_Results" type="hidden" value="">
    <div id='add-new-images-modal-wrapper' class='add-new-images-modal-wrapper'>
        <div id='add-new-images-modal-background' class='add-new-images-modal-background'>
        </div>
        <div class="add-new-images-modal">
            <div class="add-new-images-modal-header">
                <div class="add-new-images-modal-close">
                    <div>X</div>
                </div>
                <div class="go-back-to-search" style='display:none;' onclick="goBackToImageSearch()">
                    <div>↩</div>
                </div>                
            </div>
            <div class="add-new-images-modal-link-container">
                <a class="add-new-images-modal-link">Product</a>
                <a id="image-results-google-btn" class="image-results-google-btn" href="#" target="_blank" style="display:none;">&#x1F50D; Google Images</a>
            </div>

            <div class="image-search-region">
                <div class="image-search-suffix-region">
                    <label class="image-search-suffix-label">Append to search name (e.g. colour/variant):</label>
                    <div class="image-search-suffix-input-row">
                        <div class="image-search-suffix-input-wrap">
                            <input type="text" id="image-search-suffix" class="image-search-suffix-input" placeholder="e.g. Black, OD Green..."/>
                            <span class="image-search-suffix-optional" id="image-search-suffix-hint"><em>optional</em></span>
                        </div>
                        <button class="image-search-suffix-button" onclick="triggerImageSearch()">Search</button>
                    </div>
                    <div class="image-search-custom-row">
                        <label class="image-search-custom-label">
                        <input id="image-search-custom-toggle" class="settings-checkbox" type="checkbox" onchange="idtToggleCustomSearch(this)" style='min-height: 20px !important;min-width: 20px !important;     margin-top: 0px !important;margin-right: 5px !important;'>
                            Ignore product name & use custom search term only
                        </label>
                    </div>
                    <!-- Live search term preview -->
                    <div id="image-search-term-preview" class="image-search-term-preview" style="display:none;">
                        <span>Search will use: <span class="image-search-term-preview-value"></span></span>
                        <div style="
                            width: 1px;
                            height: 10px;
                        "></div>
                        <a id="image-search-google-btn" class="image-search-google-btn" href="#" target="_blank">&#x1F50D; Google Images</a>
                    </div>
                </div>
    
                <div class="image-search-sites-region">
                    <button class="image-search-sites-toggle" onclick="idtToggleSitesFoldout()">&#9654; Search Sites</button>
                    <div id="image-search-sites-body" class="image-search-sites-body" style="display:none;"></div>
                </div>
                
                <div class="image-attribute-foldout-region">
                    <button class="image-attribute-foldout-toggle" onclick="idtToggleAttributeFoldout()">&#9654; Product Attributes For Search</button>
                    <div id="image-attribute-foldout-body" class="image-attribute-foldout-body" style="display:none;"></div>
                </div>
    
                <div class="image-url-region">
                    <label class="image-url-label">Or paste an image URL directly:</label>
                    <div class="image-url-input-row">
                        <input type="text" id="image-url-input" class="image-url-input" placeholder="https://example.com/image.jpg"/>
                        <button class="image-url-button" onclick="triggerUrlPreview()">Download &amp; Preview</button>
                    </div>
                    <span class="image-url-error" style="display:none;"></span>
                </div>
            </div>
            <div id="image-search-used-term" class="image-search-used-term" style="display:none;">
                Searched for: <span class="image-search-used-term-value"></span>
            </div>
            <div id="add-new-images-modal-image-container" class="add-new-images-modal-image-container"></div>
            <span class="image-search-loader"></span>
            <div class='no-images-found-error'>Sorry - we couldn't find any images using this product's name!</div>
            <div class='edited-images-successfully-added'>Your edited image has been applied to the product!</div>
        </div>
        <div class="confirm-add-new-image-modal">
            <div id='add-new-images-modal-background' class='add-new-images-modal-background'>
            </div>
            <div class="confirm-add-new-image">
                <div id="confirm-add-new-image-buttons" class="confirm-add-new-image-buttons">
                    <h3>Add Image To Product?</h3>
                    <div class="confirm-add-new-image-buttons-response-message"></div>
                    <button class="confirm-button update-mapping-button" data-product-id='' data-product-url='' onclick="attachExternalImageToProduct(event)">Confirm</button>
                    <button class="edit-image-button" onclick="ttrOpenImageEditor()">Edit</button>
                    <button onclick="document.querySelector('.confirm-add-new-image-modal').style = 'display:none;';" class="cancel-button delete-mapping-button">Close</button>
                </div>            
            </div>
        </div>

        <!-- Image Editor Modal -->
        <div id="ttr-image-editor-modal" style="display:none;position:fixed;inset:0;z-index:10001;">
            <div style="position:absolute;inset:0;background:#000;opacity:0.85;"></div>
            <div id="ttr-image-editor-inner" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#1a1a1d;border:2px solid var(--ttr-accent,#c9a84c);border-radius:6px;padding:16px;z-index:10002;display:flex;flex-direction:column;gap:12px;max-width:95vw;">
                <!-- Toolbar -->
                <div id="ttr-editor-toolbar" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="font-family:'DM Mono',monospace;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-right:4px;">Mode:</span>
                    <button id="ttr-editor-btn-sample" class="ttr-editor-tool-btn ttr-editor-tool-active" onclick="ttrEditorSetMode('sample')" title="Eyedropper — click to sample background colour">&#x1F4CC; Sample Color</button>
                    <button id="ttr-editor-btn-draw" class="ttr-editor-tool-btn" onclick="ttrEditorSetMode('draw')" title="Draw — click &amp; drag to select area to fill">&#x2702; Draw Fill</button>
                    <div style="width:1px;height:20px;background:#2e2e32;margin:0 4px;"></div>
                    <button class="ttr-editor-tool-btn" onclick="ttrEditorUndo()" title="Undo last fill">&#x21B6; Undo</button>
                    <button class="ttr-editor-tool-btn" onclick="ttrEditorReset()" title="Reset to original">&#x21BA; Reset</button>
                    <div style="display:flex;align-items:center;gap:6px;margin-left:4px;">
                        <span style="font-family:'DM Mono',monospace;font-size:11px;color:#888;">Sampled:</span>
                        <div id="ttr-editor-color-swatch" style="width:20px;height:20px;border:1px solid #444;border-radius:3px;background:#888;"></div>
                    </div>
                    <div style="margin-left:auto;display:flex;gap:8px;">
                        <button class="ttr-editor-action-btn ttr-editor-confirm-btn" onclick="ttrEditorConfirm()">Use This Image</button>
                        <button class="ttr-editor-action-btn ttr-editor-cancel-btn" onclick="ttrEditorCancel()">Cancel</button>
                    </div>
                </div>
                <!-- Canvas -->
                <div style="overflow:auto;max-height:80vh;">
                    <canvas id="ttr-editor-canvas" style="display:block;max-width:90vw;cursor:crosshair;border:1px solid #2e2e32;border-radius:4px;"></canvas>
                </div>
                <div id="ttr-editor-status" style="font-family:'DM Mono',monospace;font-size:11px;color:#888;min-height:16px;"></div>
            </div>
        </div>
    </div>
    </div>
</div>
<?php
}