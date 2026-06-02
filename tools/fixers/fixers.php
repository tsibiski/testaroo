<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once plugin_dir_path(__FILE__) . 'convert-simple-categories/convert-simple-categories.php';
require_once plugin_dir_path(__FILE__) . 'convert-complex-categories/convert-complex-categories.php';
require_once plugin_dir_path(__FILE__) . 'decode-html-entities/decode-html-entities.php';
require_once plugin_dir_path(__FILE__) . 'add-parent-categories/add-parent-categories.php';

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_testaroo') {
        return;
    }
    
    wp_enqueue_script(
        'ttr-fixers-js',
        plugin_dir_url(__FILE__) . 'fixers.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'fixers.js'),
        true
    );
    
    wp_enqueue_style(
        'convert-simple-categories-css',
        plugin_dir_url(__FILE__) . 'convert-simple-categories/convert-simple-categories.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'convert-simple-categories/convert-simple-categories.css')
    );

    wp_enqueue_script(
        'convert-simple-categories-js',
        plugin_dir_url(__FILE__) . 'convert-simple-categories/convert-simple-categories.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'convert-simple-categories/convert-simple-categories.js'),
        true
    );
    
    wp_enqueue_style(
        'convert-complex-categories-css',
        plugin_dir_url(__FILE__) . 'convert-complex-categories/convert-complex-categories.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'convert-complex-categories/convert-complex-categories.css')
    );

    wp_enqueue_script(
        'convert-complex-categories-js',
        plugin_dir_url(__FILE__) . 'convert-complex-categories/convert-complex-categories.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'convert-complex-categories/convert-complex-categories.js'),
        true
    );

    wp_enqueue_style(
        'decode-html-entities-css',
        plugin_dir_url(__FILE__) . 'decode-html-entities/decode-html-entities.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'decode-html-entities/decode-html-entities.css')
    );

    wp_enqueue_script(
        'decode-html-entities-js',
        plugin_dir_url(__FILE__) . 'decode-html-entities/decode-html-entities.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'decode-html-entities/decode-html-entities.js'),
        true
    );
    
    wp_enqueue_style(
        'add-parent-categories-css',
        plugin_dir_url(__FILE__) . 'add-parent-categories/add-parent-categories.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'add-parent-categories/add-parent-categories.css')
    );
    
    wp_enqueue_script(
        'add-parent-categories-js',
        plugin_dir_url(__FILE__) . 'add-parent-categories/add-parent-categories.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'add-parent-categories/add-parent-categories.js'),
        true
    );
});

function get_fixers_html() {
?>
<div id="add-parent-categories-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
    <div class='button-fixer-tester-name'>
        <span>Add Parent Categories</span>
    </div>
    <div class='button-fixer-tester-description'>
        <p>
            This will check all product categories and add any missing parent categories. For example: If a category structure exists like "Food > Fruit > Banana", and a product only has "Banana" as a category, then "Fruit" and "Food" will automatically applied.
        </p>
        <p>
            This is especially helpful when you've been moving product categories around, adding new ones in the parent/child heirarchy, or when importing third party product data.
        </p>
    </div>
    <div class="button-fixer-tester-selected-options">
        <button id="addParentCategoriesButton" style="width: 150px;">
            Run Fix
        </button>
    </div>
</div>
<div id="add-parent-categories-wrapper" class="wrap">
    <div class='setting'>
       <div style='display:flex;'>
            <input id='auto-add-parent-categories-checkbox' class='settings-checkbox' type='checkbox'/>
            <div class='setting-description'>
                Check this if you want to automatically add parent categories when products are added or updated. This automated fix is always invoked after other automated category fixers run so that the final intended categories are used. Additionally, the "uncategorized" category is removed from products that already have other valid categories assigned to them.
            </div>
        </div>
    <div class="add-parent-categories-result"></div>
   </div>
</div>
<div id="decode-html-entities-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
    <div class='button-fixer-tester-name'>
        <span>Decode HTML Entities</span>
    </div>
    <div class='button-fixer-tester-description'>
        <p>
            Products imported from external APIs sometimes arrive with HTML-encoded characters in their titles and descriptions.
            For example, <strong>R&amp;amp;R</strong> instead of <strong>R&R</strong>. The encoded version renders
            correctly on screen but cannot be found via product search — a customer searching for "R&R" may only be able to find the product by searching for "<code>R&amp;R</code>" instead.
        </p>
        <p>
            This will scan all product titles, short descriptions, and long descriptions for HTML entities
            (such as <code>&amp;amp;</code> or <code>&amp;quot;</code> or <code>&amp;#039;</code> ) and replace them
            with their literal characters.
        </p>
    </div>
    <div class="button-fixer-tester-selected-options">
        <button id="decodeHtmlEntitiesButton" style="width: 150px;">
            Run Fix
        </button>
    </div>
</div>
<div id="decode-html-entities-wrapper" class="wrap">
    <div class='setting'>
       <div style='display:flex;'>
            <input id='auto-decode-html-entities-checkbox' class='settings-checkbox' type='checkbox'/>
            <div class='setting-description'>
                <p>
                    Check this if you want to automatically identify encoded characters in products that are being edited or inserted into your database.
                </p>
            </div>
        </div>
        <div class="decode-html-entities-result"></div>
        <div class="decode-html-entities-product-list"></div>
    </div>
</div>
<div id="convert-simple-categories-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
    <div class='button-fixer-tester-name'>
        <span>Simple Category Conversion</span>
    </div>
    <div class='button-fixer-tester-description'>
        <p>
            This is designed for those importing products from an external API. Products will come in with categories assigned by the supplier, which do not always match your way of organizing products. You define "mappings" between incoming category names and yours. Example mappings might be:
            <br/><strong>Incoming Category:</strong> sconce-wall-light -> <strong>Your Category:</strong> light-fixtures
            <br/><strong>Incoming Category:</strong> ceiling-lights -> <strong>Your Category:</strong> light-fixtures
        </p>
    </div>
    <div class="button-fixer-tester-selected-options">
        <button id="convertSimpleCategoriesButton" style="width: 150px;">
            Run Conversion
        </button>
    </div>
</div>
<div id="convert-simple-categories-wrapper" class="wrap">
    <div class="conversion-result"></div>
    <div class='setting'>
       <div class='setting-description'>
        <p>Add mappings that will match incoming product categories applied to products, and automatically fix them to associate with your own custom product categories
        </p>
        <p>
            <strong>Incoming Category:</strong> sconce-wall-light -> <strong>Your Category:</strong> light-fixtures
            <br/><strong>Incoming Category:</strong> ceiling-lights -> <strong>Your Category:</strong> light-fixtures
        </p>
       </div>
       <details class="settings-foldout">
           <summary>Category Mappings</summary>
           <div class=settings-foldout-region>
               <div class='settings-category-mapping'>
                    <div class='new-setting-mappings-region'>
                        <div class='new-setting-mapping'>
                            <input class='settings-category-mapping-input-category-to-update' placeholder='Category slug to change' />
                            <span class='settings-category-mapping-arrow'>
                               ⇨
                            </span>
                            <input class='settings-category-mapping-input-desired-category'  placeholder='Your desired category slug'/>
                            <button class='add-mapping-button'>
                                Add New
                            </button>
                        </div>
                    </div>
                    <div id='simple-existing-scenarios-region' class='existing-settings-mappings-region'>
                        <div class='existing-setting-mapping'>
                            <input class='settings-category-mapping-input-category-to-update' placeholder='Category slug to change' />
                            <span class='settings-category-mapping-arrow'>
                               ⇨
                            </span>
                            <input class='settings-category-mapping-input-desired-category'  placeholder='Your desired category slug'/>
                            <button class='add-mapping-button'>
                                Update
                            </button>
                        </div>
                    </div>
               </div>
           </div>
        </details>
        <br/>
        <div style='display:flex;'>
           <input id='auto-fix-simple-categories-checkbox' class='settings-checkbox' type='checkbox'/>
           <div class='setting-description'>                
                <p>
                    Check this if you want to automatically fix simple category-mappings on products when they are inserted or edited. The mappings assigned in the mapping list will automatically be checked and run on matching products, so that manually running the fixer is no longer necessary in most cases.
                </p>
            </div>
        </div>
   </div>
</div>
<div id="convert-complex-categories-button" onclick="toggleSubTab(this)" class="button-fixer-tester">
    <div class='button-fixer-tester-name'>
        <span>Complex Category Conversion</span>
    </div>
    <div class='button-fixer-tester-description'>
        <p style='margin-top: 20px;'>
            This is designed just like Simple Category Conversion, but is used when products lack a definining or clear set of categories that would make it easy to assign them your desired categories. Using titles, descriptions, and attributes, you can identify products that should have your custom categories assigned.
        </p>
    </div>
    <div class="button-fixer-tester-selected-options">
        <button id="convertComplexCategoriesButton" style="width: 150px;">
            Run Conversion
        </button>
    </div>
</div>
<div id="convert-complex-categories-wrapper" class="wrap">
    <div class="conversion-result"></div>
    <div class='setting'>
       <div class='setting-description'>
        <p>Add mappings that will identify incoming products, and automatically determine the appropriate categories to apply to them.
        </p>
        <p>
            <strong>Incoming Category:</strong> sconce-wall-light -> <strong>Your Category:</strong> light-fixtures
            <br/><strong>Incoming Category:</strong> ceiling-lights -> <strong>Your Category:</strong> light-fixtures
        </p>
       </div>
       <details class="settings-foldout">
           <summary>Category Mappings</summary>
           <div class=settings-foldout-region>
               <div class='settings-category-mapping'>
                    <div class='new-setting-mappings-region'>
                        <div class='new-setting-mapping'>
                            <input class='settings-category-mapping-input-category-to-update' placeholder='Category slug to change' />
                            <span class='settings-category-mapping-arrow'>
                               ⇨
                            </span>
                            <input class='settings-category-mapping-input-desired-category'  placeholder='Your desired category slug'/>
                            <button class='add-mapping-button'>
                                Add New
                            </button>
                        </div>
                    </div>
                    <div id='complex-existing-scenarios-region' class='existing-settings-mappings-region'>
                        <div class='existing-setting-mapping'>
                            <input class='settings-category-mapping-input-category-to-update' placeholder='Category slug to change' />
                            <span class='settings-category-mapping-arrow'>
                               ⇨
                            </span>
                            <input class='settings-category-mapping-input-desired-category'  placeholder='Your desired category slug'/>
                            <button class='add-mapping-button'>
                                Update
                            </button>
                        </div>
                    </div>
               </div>
           </div>
        </details>
        <br/>
        <div style='display:flex;'>
           <input id='auto-fix-complex-categories-checkbox' class='settings-checkbox' type='checkbox'/>
           <div class='setting-description'>Check this if you want to automatically fix complex category-mappings on products when they are inserted or edited. The mappings assigned in the mapping list will automatically be checked and run on matching products, so that manually running the fixer is no longer necessary in most cases.
            </div>
        </div>
   </div>
</div>
<?php
}