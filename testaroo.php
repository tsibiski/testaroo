<?php

if (!function_exists('ttr_ajax_security_check')) {
    function ttr_ajax_security_check() {
        check_ajax_referer('ttr_nonce', 'nonce', false) || wp_send_json_error('Invalid nonce', 403);
        if (!current_user_can('manage_woocommerce') && !current_user_can('manage_options')) {
            wp_send_json_error('Permission denied', 403);
        }
    }
}

/**
 * Plugin Name:             Testaroo
 * Plugin URI:              https://github.com/tsibiski/testaroo
 * Description:             WooCommerce product integrity testing tool.
 * Version:                 1.0
 * Author:                  Tim Sibiski
 * Author URI:              https://github.com/tsibiski
 * License:                 GPL-3.0
 * License URI:             https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain:             testaroo
 * Requires at least:       5.9
 * Requires PHP:            7.4
 * WC requires at least:    6.0
 * WC tested up to:         7.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once plugin_dir_path( __FILE__ ) . 'main/storage.php';
require_once plugin_dir_path( __FILE__ ) . 'main/automated-behaviors.php';
require_once plugin_dir_path( __FILE__ ) . 'main/blacklist.php';

require_once plugin_dir_path(__FILE__) . 'tools/testers/testers.php';
require_once plugin_dir_path(__FILE__) . 'tools/fixers/fixers.php';
require_once plugin_dir_path(__FILE__) . 'tools/qa_tools/qa_tools.php';
require_once plugin_dir_path(__FILE__) . 'tools/qa_automation/qa_automation.php';

add_action('admin_menu', function () {
    add_menu_page(
        'Testaroo',
        'Testaroo',
        'manage_options',
        'testaroo',
        'testaroo_tool',
        'dashicons-search',
        56
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_testaroo') {
        return;
    }

    wp_enqueue_style(
        'ttr-css',
        plugin_dir_url(__FILE__) . 'main/main.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'main/main.css')
    );

    wp_enqueue_script(
        'ttr-js',
        plugin_dir_url(__FILE__) . 'main/main.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'main/main.js'),
        true
    );

    wp_enqueue_style(
        'ttr-tools-css',
        plugin_dir_url(__FILE__) . 'tools/tools.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'tools/tools.css')
    );
    wp_enqueue_script(
        'ttr-tools-js',
        plugin_dir_url(__FILE__) . 'tools/tools.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'tools/tools.js'),
        true
    );

    $settings          = ttr_get_settings();
    $tools_settings    = ttr_get_tools_settings();
    $testers_blacklist = ttr_read_blacklist(ttr_testers_blacklist_path());
    $fixers_blacklist  = ttr_read_blacklist(ttr_fixers_blacklist_path());
    $images_blacklist_raw      = ttr_read_blacklist(ttr_images_blacklist_path());
    $images_blacklist          = array_values(array_filter($images_blacklist_raw, fn($e) => empty($e['type'])));
    $images_blacklist_patterns = array_values(array_filter($images_blacklist_raw, fn($e) => ($e['type'] ?? '') === 'pattern'));

    wp_localize_script('ttr-js', 'TTR', [
        'ajaxUrl'                 => admin_url('admin-ajax.php'),
        'adminUrl'                => admin_url(),
        'nonce'                   => wp_create_nonce('ttr_nonce'),
        'settings'                => $settings,
        'toolsSettings'           => $tools_settings,
        'testersBlacklist'        => $testers_blacklist,
        'fixersBlacklist'         => $fixers_blacklist,
        'imagesBlacklist'         => $images_blacklist,
        'imagesBlacklistPatterns' => $images_blacklist_patterns,
    ]);
});

add_action('wp_ajax_ttr_load_tab', function () {
    ttr_ajax_security_check();

    $tab     = sanitize_key(wp_unslash($_POST['tab']) ?? '');
    $allowed = ['testers', 'fixers', 'qa_tools', 'qa_automation'];
    if (!in_array($tab, $allowed, true)) {
        wp_die( esc_html__( 'Invalid tab', 'testaroo' ) );
    }

    $file = plugin_dir_path(__FILE__) . "tools/{$tab}/{$tab}.php";
    if (!file_exists($file)) {
        wp_die( esc_html__( 'Tab file not found', 'testaroo' ) );
    }

    require_once $file;

    $render_functions = [
        'testers'       => 'get_testers_html',
        'fixers'        => 'get_fixers_html',
        'qa_tools'      => 'get_qa_tools_html',
        'qa_automation' => 'get_qa_automation_html',
    ];

    $fn = $render_functions[$tab] ?? null;
    if ($fn && function_exists($fn)) {
        $fn();
    }

    wp_die();
});

add_action('wp_ajax_ttr_get_settings', 'ttr_get_settings_handler');
function ttr_get_settings_handler() {
    ttr_ajax_security_check();
    wp_send_json_success( ttr_get_settings() );
}

add_action('wp_ajax_ttr_save_setting', 'ttr_save_setting_handler');
function ttr_save_setting_handler() {
    ttr_ajax_security_check();

    $allowed_keys = ['disableAllAutoFixTools', 'searchSites', 'tavilyApiKey', 'autoFixSmallImage', 'autoFixMissingThumbnail'];
    $key          = wp_unslash($_POST['key']) ?? '';

    if (!in_array($key, $allowed_keys, true)) {
        wp_send_json_error(['message' => 'Invalid settings key: ' . esc_html($key)]);
        return;
    }

    $value = json_decode(stripslashes(wp_unslash($_POST['value'])), true);

    if (!ttr_save_setting_key($key, $value)) {
        wp_send_json_error(['message' => 'Could not save setting.']);
        return;
    }

    wp_send_json_success();
}

// ── Documentation ──

add_action('wp_ajax_ttr_get_read_me', function() {
    ttr_ajax_security_check();
    $path = plugin_dir_path(__FILE__) . 'README.md';
    if (!file_exists($path)) {
        wp_send_json_error(['message' => 'README.md not found.']);
        return;
    }
    wp_send_json_success(['content' => file_get_contents($path)]);
});

add_action('wp_ajax_ttr_get_how_to', function() {
    ttr_ajax_security_check();
    $path = plugin_dir_path(__FILE__) . 'HOW_TO.txt';
    if (!file_exists($path)) {
        wp_send_json_error(['message' => 'HOW_TO.txt not found.']);
        return;
    }
    wp_send_json_success(['content' => file_get_contents($path)]);
});

add_action('wp_ajax_ttr_get_faqs', function() {
    ttr_ajax_security_check();
    $path = plugin_dir_path(__FILE__) . 'FAQS.txt';
    if (!file_exists($path)) {
        wp_send_json_error(['message' => 'FAQS.txt not found.']);
        return;
    }
    wp_send_json_success(['content' => file_get_contents($path)]);
});

// ── Tools Settings ──

add_action('wp_ajax_ttr_get_tools_settings', function() {
    ttr_ajax_security_check();
    wp_send_json_success( ttr_get_tools_settings() );
});

add_action('wp_ajax_ttr_save_tools_setting', function() {
    ttr_ajax_security_check();
    $allowed = [
        'fixSimpleCategoryMappings',
        'fixComplexCategoryMappings',
        'autoFixSimpleCategoryMappings',
        'autoFixComplexCategoryMappings',
        'autoAddParentCategories',
        'autoDecodeHtmlEntities',
        'imageSizeDelimiter',
        'minimumImageDimensions',
    ];
    $key = wp_unslash($_POST['key']) ?? '';
    if (!in_array($key, $allowed, true)) {
        wp_send_json_error(['message' => 'Invalid tools settings key: ' . esc_html($key)]);
        return;
    }
    $value = json_decode(wp_unslash($_POST['value']) ?? 'null', true);
    if (!ttr_save_tools_setting_key($key, $value)) {
        wp_send_json_error(['message' => 'Could not save tools setting.']);
        return;
    }
    wp_send_json_success();
});

// Main page 
function testaroo_tool() {
?>
    <div class="ttr-page" style="font-family:'DM Mono',monospace;color:#e8e4dc;">
    <div class='background-color-padding'></div>
    <h1 class="ttr-title">Testaroo</h1>

    <div role="tablist" aria-label="Tabs" class="tab-list">
        <button id="main-tab" role="tab" aria-selected="true"  class="tab-title selected" onclick="ShowTab('main');">Info</button>
        <button id="testers-tab" role="tab" aria-selected="false" class="tab-title" onclick="ShowTab('testers');">Testers</button>
        <button id="fixers-tab" role="tab" aria-selected="false" class="tab-title" onclick="ShowTab('fixers');">Fixers</button>
        <button id="qa-tools-tab" role="tab" aria-selected="false" class="tab-title" onclick="ShowTab('qa-tools');">Test Tools<div class='wip-tag'>WIP</div></button>
        <button id="automation-tools-tab" role="tab" aria-selected="false" class="tab-title" onclick="ShowTab('automation-tools');">QA Automation<div class='wip-tag'>WIP</div></button>
    </div>

    <div class="tab-wrapper">
        <div id="main-content" data-loaded="true">
            <!-- ── Documentation ── -->
            <p>This is a testing suite that has various useful tools that test products, their images, categories, attributes (and more)
               for errors and mistakes. Some issues can automatically be corrected with a click of a button.</p>
            <p>Additionally, there are "fixers" that corrects various bad, missing, and undesirable data from imported products that you'd like to map to your own organization.</p>
            <p style='margin-top: 40px;'>
                <button id="ttr-view-how-to-btn" onclick="ttrShowDocumentation('howto')" style="
                    font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.5px;
                    padding:7px 18px;border-radius:4px;cursor:pointer;
                    border:1px solid var(--ttr-accent,#c9a84c);
                    background:transparent;color:var(--ttr-accent,#c9a84c);
                    transition:background .15s,color .15s;">
                    📖 View How To's
                </button>
                <button id="ttr-view-faqs-btn" onclick="ttrShowDocumentation('faqs')" style="
                    font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.5px;
                    padding:7px 18px;border-radius:4px;cursor:pointer;
                    border:1px solid var(--ttr-accent,#c9a84c);
                    background:transparent;color:var(--ttr-accent,#c9a84c);
                    transition:background .15s,color .15s;">
                    📖 View FAQs
                </button>
                <button id="ttr-view-readme-btn" onclick="ttrShowDocumentation('readme')" style="
                    font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.5px;
                    padding:7px 18px;border-radius:4px;cursor:pointer;
                    border:1px solid var(--ttr-accent,#c9a84c);
                    background:transparent;color:var(--ttr-accent,#c9a84c);
                    transition:background .15s,color .15s;">
                    📖 View Readme
                </button>
                <span style="margin-left:10px;font-size:11px">Testaroo.TTR@gmail.com</span>
            </p>
           <div>
                <!-- ── General Automated Behavior Settings ── -->
               <br />
               <h2>Settings</h2>
               <div class='settings-list'>
                    <div class='ttr-settings-loading'></div>
                    <div class='setting'>
                        <div id='master-settings' style='display:flex;position:relative;'>
                            <input id='disable-all-auto-fix-checkbox' class='settings-checkbox' type='checkbox'/>
                            <div class='setting-description'>
                                Disable all automatic fixers. This overrides Testaroo settings and prevents any product data fixes that you've set to run automatically when products are added or edited. The individual settings choices are not directly updated, so they will reactivate when you uncheck this setting.
                            </div>
                        </div>
                    </div>
                    <div class='setting'>
                        <div id='automatically-fix-image-padding-when-products-are-created-settings' style='display:flex;position:relative;'>
                            <input id='auto-fix-small-image-checkbox' class='settings-checkbox' type='checkbox'/>
                            <div class='setting-description'>
                                Automatically fix products that have a primary (or only) image that is far too small and not designed for dpi-based upscaling.
                                <p>
                                    WooCommerce will aggressively expand the image to fit the product page gallery. The image will likely look fine as a thumbnail, but will sometimes be stretch and pixelated to a comical level.
                                </p>
                                Just like the product batch test "Tester" feature, which lets you automatically fix the problem - this will automatically generate a padded version of the too-small image so that WooCommerce displays it unstretched and non-pixelated. The image will still appear smaller than may be desirable, but it will look better and far more presentable to customers.
                            </div>
                        </div>
                    </div>
                    <div class='setting'>
                        <div id='automatically-fix-missing-thumbnail-when-products-are-created-settings' style='display:flex;position:relative;'>
                            <input id='auto-fix-missing-thumbnail-checkbox' class='settings-checkbox' type='checkbox'  style="margin-top: 0 !important;"/>
                            <div class='setting-description'>
                                Automatically fix products that have a gallery image, but no set thumbnail. Set the first gallery image as the thumbnail.
                            </div>
                        </div>
                    </div>
               </div>
           </div>

           <!-- ── Store & API Settings ── -->
           <div>
               <br />
               <h2>Store &amp; API Settings</h2>
               <div style="border:1px solid #2b2b2b;border-radius:6px;overflow:hidden;background:#050505;">
                   <div style="padding:18px 28px;background:linear-gradient(to right,#241f08,#050505);border-bottom:1px solid #2b2b2b;font-size:18px;font-weight:600;color:#d6b36a;">
                       Store Identity &amp; Integrations
                   </div>
                   <div style="padding:28px;color:#f1f1f1;display:flex;flex-direction:column;gap:24px;">

                       <!-- Tavily API Key -->
                       <div>
                           <label style="display:block;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                               Tavily API Key <span style="color:#e05555;">*</span>
                           </label>
                           <div style="display:flex;gap:10px;align-items:center;">
                               <input id="ttr-tavily-key-input" type="password" placeholder="tvly-…" style="width:360px;background:#111;color:#fff;border:1px solid #444;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;border-radius:4px;">
                               <button onclick="ttrSaveTavilyKey(this)" style="padding:8px 16px;border:1px solid #c9a84c;color:#c9a84c;background:transparent;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;border-radius:4px;">Save</button>
                           </div>
                           <div style="margin-top:8px;font-size:11px;color:#888;line-height:1.7;">
                               Required for the image search tool. To get a free API key:
                               <ol style="margin:6px 0 0 16px;padding:0;color:#888;">
                                   <li>Visit <a href="https://tavily.com" target="_blank" style="color:#c9a84c;">tavily.com</a> and click <strong style="color:#e8e8e8;">Get Started</strong></li>
                                   <li>Sign up for a free account</li>
                                   <li>From your dashboard, copy your API key (starts with <code style="color:#e8e8e8;">tvly-</code>)</li>
                                   <li>Paste it above and click Save</li>
                               </ol>
                               The free tier includes 1,000 searches/month — plenty for typical use.
                           </div>
                       </div>

                       <!-- Search Sites -->
                       <div>
                           <label style="display:block;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                               Image Search Sites
                           </label>
                           <div style="font-size:11px;color:#888;margin-bottom:12px;line-height:1.7;">
                               Sites the image search tool will query. Assign a category to each site so you can filter quickly in the search modal. Leave empty to search the entire web.
                           </div>
                           <div id="ttr-search-sites-table" style="display:flex;flex-direction:column;gap:6px;max-width:560px;margin-bottom:10px;"></div>
                           <button onclick="ttrAddSearchSiteRow()" style="padding:6px 14px;border:1px solid #2e2e32;color:#888;background:transparent;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;border-radius:4px;margin-bottom:12px;">+ Add Site</button>
                           <div>
                               <button onclick="ttrSaveSearchSites(this)" style="padding:8px 16px;border:1px solid #c9a84c;color:#c9a84c;background:transparent;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;border-radius:4px;">Save Sites</button>
                           </div>
                       </div>

                   </div>
               </div>
           </div>

           <div class='setting'>
               <h2>Blacklists</h2>
               <div id="ttr-blacklist-panel" style="border:1px solid #2b2b2b;border-radius:6px;overflow:hidden;background:#050505;">
                   <div style="padding:18px 28px;background:linear-gradient(to right,#241f08,#050505);border-bottom:1px solid #2b2b2b;font-size:18px;font-weight:600;color:#d6b36a;">
                       Product &amp; Image Blacklists
                   </div>
                   <div style="padding:28px;color:#f1f1f1;">
                       <p style="margin-bottom:20px;line-height:1.8;font-size:13px;">
                           Blacklisted products are skipped by all tester or fixer tools, including automated behaviors.
                           Blacklisted images are ignored by the unused image scanner.
                       </p>
    
                       <!-- Add product by ID -->
                       <details open style="margin-bottom:24px;" open>
                           <summary style="cursor:pointer;color:#d6b36a;letter-spacing:2px;font-size:12px;margin-bottom:16px;">ADD PRODUCT TO BLACKLIST</summary>
                           <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin: 12px 12px 12px 20px;">
                               <div>
                                   <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">PRODUCT ID</label>
                                   <input id="ttr-bl-product-id-input" type="number" placeholder="e.g. 12345" style="width:120px;background:#111;color:#fff;border:1px solid #444;padding:8px;font-family:'DM Mono',monospace;font-size:12px;">
                               </div>
                               <div>
                                   <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">BLACKLIST</label>
                                   <select id="ttr-bl-list-type-select" style="background:#111;color:#fff;border:1px solid #444;font-family:'DM Mono',monospace;font-size:12px;height:40px;">
                                       <option value="testers">Testers</option>
                                       <option value="fixers">Fixers</option>
                                   </select>
                               </div>
                               <div style="flex:1;min-width:180px;">
                                   <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">REASON (OPTIONAL)</label>
                                   <input id="ttr-bl-reason-input" type="text" placeholder="Why is this product ignored?" style="width:100%;background:#111;color:#fff;border:1px solid #444;padding:8px;font-family:'DM Mono',monospace;font-size:12px;">
                               </div>
                               <button onclick="ttrBlacklistAddById()" style="padding:12px;border:1px solid #c9a84c;color:#c9a84c;background:transparent;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">
                                   Add
                               </button>
                           </div>
                           <div id="ttr-bl-add-status" style="margin-left:20px;margin-top:8px;font-size:11px;color:#888;"></div>
                           <!-- Preview of looked-up product -->
                           <div id="ttr-bl-preview" style="display:none;margin-top:12px;display:none;align-items:center;gap:12px;padding:10px;border:1px solid #2b2b2b;border-radius:4px;background:#0e0e0f;">
                               <img id="ttr-bl-preview-thumb" src="" style="width:48px;height:48px;object-fit:contain;border:1px solid #2b2b2b;">
                               <div>
                                   <div id="ttr-bl-preview-name" style="font-size:13px;color:#e8e8e8;"></div>
                                   <div id="ttr-bl-preview-id" style="font-size:11px;color:#888;"></div>
                               </div>
                           </div>
                       </details>
    
                       <!-- Add image to blacklist -->
                       <details style="margin-bottom:24px;" open>
                           <summary style="cursor:pointer;color:#d6b36a;letter-spacing:2px;font-size:12px;margin-bottom:16px;">ADD IMAGE TO BLACKLIST</summary>
                           <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin: 12px 12px 12px 20px;">
                               <div style="flex:1;min-width:180px;">
                                   <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">ATTACHMENT ID, IMAGE URL, OR PARTIAL IMAGE NAME (CONTAINS)</label>
                                   <input id="ttr-bl-image-id-input" type="text" placeholder="e.g. 9876 or https://…/image.jpg or _some_partial_filepath_or_name_" style="width:100%;background:#111;color:#fff;border:1px solid #444;padding:8px;font-family:'DM Mono',monospace;font-size:12px;">
                               </div>
                               <div style="flex:1;min-width:180px;">
                                   <label style="display:block;font-size:11px;color:#888;margin-bottom:4px;">REASON (OPTIONAL)</label>
                                   <input id="ttr-bl-image-reason-input" type="text" placeholder="Why is this image ignored?" style="width:100%;background:#111;color:#fff;border:1px solid #444;padding:8px;font-family:'DM Mono',monospace;font-size:12px;">
                               </div>
                               <button onclick="ttrBlacklistAddImage()" style="padding:12px;border:1px solid #c9a84c;color:#c9a84c;background:transparent;font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">
                                   Add
                               </button>
                           </div>
                           <div id="ttr-bl-image-add-status" style="margin-left:20px;margin-top:8px;font-size:11px;color:#888;"></div>
                       </details>
    
                       <!-- Current blacklist entries -->
                       <details open>
                           <summary style="cursor:pointer;color:#d6b36a;letter-spacing:2px;font-size:12px;margin-bottom:16px;">CURRENT BLACKLIST ENTRIES</summary>
                           <div id="ttr-blacklist-entries" style="margin: 12px 12px 12px 20px;"></div>
                       </details>
                   </div>
               </div>
           </div>
        </div>
        <div id="testers-content" data-loaded="false" style="display:none;"></div>
        <div id="fixers-content" data-loaded="false" style="display:none;"></div>
        <div id="qa-tools-content" data-loaded="false" style="display:none;"></div>
        <div id="automation-tools-content" data-loaded="false" style="display:none;"></div>   
    </div>
<?php
}