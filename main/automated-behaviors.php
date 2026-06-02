<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

$settings            = [];
$tools_settings_file = [];

add_action('init', function() use (&$settings, &$tools_settings_file) {
    $settings            = ttr_get_settings();
    $tools_settings_file = ttr_get_tools_settings();
});

add_action('woocommerce_process_product_meta', function($product_id) use (&$settings, &$tools_settings_file) {
    if (!empty($settings['disableAllAutoFixTools']))
        return;
    if (function_exists('ttr_is_product_blacklisted') && ttr_is_product_blacklisted(ttr_fixers_blacklist_path(), (int) $product_id))
        return;

    $simpleMappings   = $tools_settings_file['fixSimpleCategoryMappings']  ?? [];
    $complexScenarios = $tools_settings_file['fixComplexCategoryMappings'] ?? [];

    if (!empty($tools_settings_file['autoFixSimpleCategoryMappings']))
        fix_categoryMappings((int) $product_id, $simpleMappings);

    if (!empty($tools_settings_file['autoFixComplexCategoryMappings']))
        ttr_apply_complex_scenarios((int) $product_id, $complexScenarios);

    if (!empty($tools_settings_file['autoAddParentCategories']))
        ttr_add_parent_categories((int) $product_id);

    if (!empty($tools_settings_file['autoDecodeHtmlEntities']))
        ttr_decode_product_entities((int) $product_id);

    if (!empty($tools_settings_file['autoFixMissingThumbnail'])) {
        $thumb = get_post_thumbnail_id((int) $product_id);
        if (!$thumb && function_exists('ttr_promote_first_gallery_image'))
            ttr_promote_first_gallery_image((int) $product_id);
    }

    if (!empty($tools_settings_file['autoFixSmallImage'])) {
        if (function_exists('ttr_pad_product_image') && function_exists('ttr_product_batch_test_get_settings')) {
            $thumb_id = (int) get_post_thumbnail_id((int) $product_id);
            if ($thumb_id) {
                $file = get_attached_file($thumb_id);
                if ($file && file_exists($file) && strpos($file, '_ttr_padded_') === false) {
                    $batch_settings = ttr_product_batch_test_get_settings();
                    $min_dim = intval($batch_settings['minimumImageDimensions'] ?? 300);
                    $size    = @getimagesize($file);
                    if ($size && max($size[0], $size[1]) < $min_dim) {
                        ttr_pad_product_image((int) $product_id, $thumb_id);
                    }
                }
            }
        }
    }
}, 20);

add_action('save_post_product', function($product_id) use (&$settings, &$tools_settings_file) {
    if (!empty($settings['disableAllAutoFixTools']))
        return;
    if (function_exists('ttr_is_product_blacklisted') && ttr_is_product_blacklisted(ttr_fixers_blacklist_path(), (int) $product_id))
        return;

    $simpleMappings   = $tools_settings_file['fixSimpleCategoryMappings']  ?? [];
    $complexScenarios = $tools_settings_file['fixComplexCategoryMappings'] ?? [];

    if (!empty($tools_settings_file['autoFixSimpleCategoryMappings']))
        fix_categoryMappings((int) $product_id, $simpleMappings);

    if (!empty($tools_settings_file['autoFixComplexCategoryMappings']))
        ttr_apply_complex_scenarios((int) $product_id, $complexScenarios);

    if (!empty($tools_settings_file['autoAddParentCategories']))
        ttr_add_parent_categories((int) $product_id);

    if (!empty($tools_settings_file['autoDecodeHtmlEntities']))
        ttr_decode_product_entities((int) $product_id);

    if (!empty($tools_settings_file['autoFixMissingThumbnail'])) {
        $thumb = get_post_thumbnail_id((int) $product_id);
        if (!$thumb && function_exists('ttr_promote_first_gallery_image'))
            ttr_promote_first_gallery_image((int) $product_id);
    }

    if (!empty($tools_settings_file['autoFixSmallImage'])) {
        if (function_exists('ttr_pad_product_image') && function_exists('ttr_product_batch_test_get_settings')) {
            $thumb_id = (int) get_post_thumbnail_id((int) $product_id);
            if ($thumb_id) {
                $file = get_attached_file($thumb_id);
                if ($file && file_exists($file) && strpos($file, '_ttr_padded_') === false) {
                    $batch_settings = ttr_product_batch_test_get_settings();
                    $min_dim = intval($batch_settings['minimumImageDimensions'] ?? 300);
                    $size    = @getimagesize($file);
                    if ($size && max($size[0], $size[1]) < $min_dim) {
                        ttr_pad_product_image((int) $product_id, $thumb_id);
                    }
                }
            }
        }
    }
}, 10);

add_action('updated_post_meta', function($meta_id, $product_id, $meta_key) use (&$settings, &$tools_settings_file) {
    if (!empty($settings['disableAllAutoFixTools']))
        return;
    if (function_exists('ttr_is_product_blacklisted') && ttr_is_product_blacklisted(ttr_fixers_blacklist_path(), (int) $product_id))
        return;
    if ($meta_key !== '_product_attributes')
        return;

    $simpleMappings   = $tools_settings_file['fixSimpleCategoryMappings']  ?? [];
    $complexScenarios = $tools_settings_file['fixComplexCategoryMappings'] ?? [];

    if (!empty($tools_settings_file['autoFixSimpleCategoryMappings']))
        fix_categoryMappings((int) $product_id, $simpleMappings);

    if (!empty($tools_settings_file['autoFixComplexCategoryMappings']))
        ttr_apply_complex_scenarios((int) $product_id, $complexScenarios);

    if (!empty($tools_settings_file['autoAddParentCategories']))
        ttr_add_parent_categories((int) $product_id);

    if (!empty($tools_settings_file['autoDecodeHtmlEntities']))
        ttr_decode_product_entities((int) $product_id);

    if (!empty($tools_settings_file['autoFixMissingThumbnail'])) {
        $thumb = get_post_thumbnail_id((int) $product_id);
        if (!$thumb && function_exists('ttr_promote_first_gallery_image'))
            ttr_promote_first_gallery_image((int) $product_id);
    }

    if (!empty($tools_settings_file['autoFixSmallImage'])) {
        if (function_exists('ttr_pad_product_image') && function_exists('ttr_product_batch_test_get_settings')) {
            $thumb_id = (int) get_post_thumbnail_id((int) $product_id);
            if ($thumb_id) {
                $file = get_attached_file($thumb_id);
                if ($file && file_exists($file) && strpos($file, '_ttr_padded_') === false) {
                    $batch_settings = ttr_product_batch_test_get_settings();
                    $min_dim = intval($batch_settings['minimumImageDimensions'] ?? 300);
                    $size    = @getimagesize($file);
                    if ($size && max($size[0], $size[1]) < $min_dim) {
                        ttr_pad_product_image((int) $product_id, $thumb_id);
                    }
                }
            }
        }
    }
}, 10, 3);

// ── Fix Simple Category Mappings ──────────────────────────────────────────────

function fix_categoryMappings(int $product_id, array $mappings): bool {
    static $running = false;
    if ($running)
        return false;

    $assigned = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);
    if (is_wp_error($assigned) || empty($assigned)) return false;

    $terms_to_add    = [];
    $terms_to_remove = [];

    foreach ($mappings as $map) {
        $old_slug = $map['from'];
        $new_slug = $map['to'];

        if (!in_array($old_slug, $assigned, true)) continue;

        $new_term = get_term_by('slug', $new_slug, 'product_cat');
        if (!$new_term || is_wp_error($new_term)) continue;

        $terms_to_add[] = $new_term->term_id;

        $old_term = get_term_by('slug', $old_slug, 'product_cat');
        if ($old_term && !is_wp_error($old_term)) {
            $terms_to_remove[] = $old_term->term_id;
        }
    }

    if (empty($terms_to_add)) return false;

    $running = true;

    $current_ids = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'ids']);
    if (is_wp_error($current_ids)) $current_ids = [];

    $updated_ids = array_unique(
        array_diff(
            array_merge($current_ids, $terms_to_add),
            $terms_to_remove
        )
    );

    wp_set_post_terms($product_id, $updated_ids, 'product_cat');
    $running = false;

    return true;
}

add_action('set_object_terms', function($object_id, $terms, $tt_ids, $taxonomy) use (&$settings, &$tools_settings_file) {
    // Static running guard prevents infinite loop when ttr_add_parent_categories
    // itself calls wp_set_post_terms, which would re-fire this hook.
    static $running = false;
    if ($running)
        return;

    if (
        $taxonomy !== 'product_cat'
         || get_post_type($object_id) !== 'product'
         || !empty($settings['disableAllAutoFixTools'])
         || function_exists('ttr_is_product_blacklisted') && ttr_is_product_blacklisted(ttr_fixers_blacklist_path(), (int) $object_id)
    )
        return;

    $running = true;
    if (!empty($tools_settings_file['autoAddParentCategories']))
        ttr_add_parent_categories((int) $object_id);
    $running = false;
}, 20, 4);

/*
    Force WooCommerce single product page to use padded image if one exists in gallery.
    Falls back to original featured image if no padded version found.
*/
add_action('wp_footer', function() {
    if ( ! is_product() ) { return; }
    ?>
    <script>
    function ttrSwapIfOversized() {
        var mainImg = document.querySelector('.woocommerce-product-gallery__image img');
        var thumbs  = document.querySelectorAll('.flex-control-thumbs li img');

        if (!mainImg || thumbs.length < 2)
            return false;

        for(let x = 0; x < thumbs.length; x++) {
            if(thumbs[x].currentSrc.includes("_ttr_padded_")) {
                thumbs[x].click();
                return true;
            }
        }
        return false;
    }

    var ttrAttempts = 0;
    var ttrInterval = setInterval(function() {
        ttrAttempts++;
        if (ttrSwapIfOversized() || ttrAttempts > 20) {
            clearInterval(ttrInterval);
        }
    }, 200);
    </script>
    <?php
}, 20);
