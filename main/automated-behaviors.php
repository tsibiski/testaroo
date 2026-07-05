<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ── Guards ────────────────────────────────────────────────────────────────────

function ttr_auto_behaviors_should_run( int $product_id ): bool {
    $settings = ttr_get_settings();
    if ( ! empty( $settings['disableAllAutoFixTools'] ) ) return false;
    if ( function_exists( 'ttr_is_product_blacklisted' ) &&
         ttr_is_product_blacklisted( ttr_fixers_blacklist_path(), $product_id ) ) return false;
    return true;
}

// ── Shared re-entrancy guard, keyed by product ID ───────────────────────────────
//
// All of our fixers call wp_set_post_terms() / wp_update_post(), which re-fire the
// same events we hook (set_object_terms, save_post). Without a per-product guard we
// would either recurse or run the whole suite several times per save. This lets both
// entry points (the WooCommerce CRUD hooks and set_object_terms) share one lock.

function ttr_auto_is_running( int $product_id, ?bool $set = null ): bool {
    static $active = [];
    if ( $set === true )  { $active[ $product_id ] = true; return true; }
    if ( $set === false ) { unset( $active[ $product_id ] ); return false; }
    return ! empty( $active[ $product_id ] );
}

// ── Full fix runner (categories + images + entities) ────────────────────────────

function ttr_run_auto_fixes( int $product_id ): void {
    if ( ttr_auto_is_running( $product_id ) ) return;
    ttr_auto_is_running( $product_id, true );

    try {
        $ts = ttr_get_tools_settings();

        $simpleMappings   = $ts['fixSimpleCategoryMappings']  ?? [];
        $complexScenarios = $ts['fixComplexCategoryMappings'] ?? [];

        if ( ! empty( $ts['autoFixSimpleCategoryMappings'] ) )
            fix_categoryMappings( $product_id, $simpleMappings );

        if ( ! empty( $ts['autoFixComplexCategoryMappings'] ) )
            ttr_apply_complex_scenarios( $product_id, $complexScenarios );

        if ( ! empty( $ts['autoAddParentCategories'] ) )
            ttr_add_parent_categories( $product_id );

        if ( ! empty( $ts['autoDecodeHtmlEntities'] ) )
            ttr_decode_product_entities( $product_id );

        if ( ! empty( $ts['autoFixMissingThumbnail'] ) ) {
            $thumb = get_post_thumbnail_id( $product_id );
            if ( ! $thumb && function_exists( 'ttr_promote_first_gallery_image' ) )
                ttr_promote_first_gallery_image( $product_id );
        }

        if ( ! empty( $ts['autoFixSmallImage'] ) ) {
            if ( function_exists( 'ttr_pad_product_image' ) && function_exists( 'ttr_product_batch_test_get_settings' ) ) {
                $thumb_id = (int) get_post_thumbnail_id( $product_id );
                if ( $thumb_id ) {
                    $file = get_attached_file( $thumb_id );
                    if ( $file && file_exists( $file ) && strpos( $file, '_ttr_padded_' ) === false ) {
                        $batch_settings = ttr_product_batch_test_get_settings();
                        $min_dim        = intval( $batch_settings['minimumImageDimensions'] ?? 300 );
                        $size           = @getimagesize( $file );
                        if ( $size && max( $size[0], $size[1] ) < $min_dim ) {
                            ttr_pad_product_image( $product_id, $thumb_id );
                        }
                    }
                }
            }
        }
    } finally {
        ttr_auto_is_running( $product_id, false );
    }
}

// ── Category-only runner (for term-only edits: Quick Edit, bulk actions) ─────────
//
// Fired from set_object_terms so that edits which only touch product_cat and never
// call $product->save() (Quick Edit, the "Categories" bulk action, direct
// wp_set_post_terms) still get converted. Lightweight: term operations only.

function ttr_run_auto_category_conversions( int $product_id ): void {
    if ( ttr_auto_is_running( $product_id ) ) return;
    ttr_auto_is_running( $product_id, true );

    try {
        $ts = ttr_get_tools_settings();

        if ( ! empty( $ts['autoFixSimpleCategoryMappings'] ) )
            fix_categoryMappings( $product_id, $ts['fixSimpleCategoryMappings'] ?? [] );

        if ( ! empty( $ts['autoFixComplexCategoryMappings'] ) )
            ttr_apply_complex_scenarios( $product_id, $ts['fixComplexCategoryMappings'] ?? [] );

        if ( ! empty( $ts['autoAddParentCategories'] ) )
            ttr_add_parent_categories( $product_id );
    } finally {
        ttr_auto_is_running( $product_id, false );
    }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
//
// IMPORTANT — why NOT save_post_product / woocommerce_process_product_meta:
//
//   In the WooCommerce CRUD path (REST API, block editor, CSV import, WP All Import,
//   and any programmatic $product->save()), category terms are written by the data
//   store AFTER wp_update_post() returns — i.e. AFTER save_post/save_post_product
//   fire. So a fixer hooked to save_post reads the OLD (or empty, for a new product)
//   category set, finds nothing to convert, and no-ops. WooCommerce then writes the
//   real categories, but the fixer has already run and will not run again.
//   woocommerce_process_product_meta only fires for the classic admin metabox, so it
//   misses REST/imports/new products entirely.
//
//   woocommerce_new_product / woocommerce_update_product fire at the very END of the
//   data-store create/update — after categories AND meta are committed — for EVERY
//   save path (classic editor, block editor, REST, CSV import, programmatic). That is
//   the only place the just-saved categories are guaranteed to be readable.

add_action( 'woocommerce_new_product',    'ttr_auto_on_product_crud', 20 );
add_action( 'woocommerce_update_product', 'ttr_auto_on_product_crud', 20 );

function ttr_auto_on_product_crud( $product_id ): void {
    $product_id = (int) $product_id;
    if ( ! ttr_auto_behaviors_should_run( $product_id ) ) return;
    ttr_run_auto_fixes( $product_id );
}

// Catches attribute-only meta writes that don't go through $product->save().
add_action( 'updated_post_meta', function( $meta_id, $product_id, $meta_key ) {
    if ( $meta_key !== '_product_attributes' ) return;
    if ( get_post_type( (int) $product_id ) !== 'product' ) return;
    if ( ! ttr_auto_behaviors_should_run( (int) $product_id ) ) return;
    ttr_run_auto_fixes( (int) $product_id );
}, 10, 3 );

// Catches term-only edits (Quick Edit, bulk "Categories" action, direct term writes).
add_action( 'set_object_terms', function( $object_id, $terms, $tt_ids, $taxonomy ) {
    if ( $taxonomy !== 'product_cat' ) return;
    if ( get_post_type( $object_id ) !== 'product' ) return;
    if ( ! ttr_auto_behaviors_should_run( (int) $object_id ) ) return;

    // ttr_auto_is_running() inside the runner prevents recursion when our own
    // wp_set_post_terms() calls re-fire this same hook.
    ttr_run_auto_category_conversions( (int) $object_id );
}, 20, 4 );

// ── Fix Simple Category Mappings ──────────────────────────────────────────────

function fix_categoryMappings( int $product_id, array $mappings ): bool {
    static $running = false;
    if ( $running )
        return false;

    $assigned = wp_get_post_terms( $product_id, 'product_cat', ['fields' => 'slugs'] );
    if ( is_wp_error( $assigned ) || empty( $assigned ) ) return false;

    $terms_to_add    = [];
    $terms_to_remove = [];

    foreach ( $mappings as $map ) {
        $old_slug = $map['from'];
        $new_slug = $map['to'];

        if ( ! in_array( $old_slug, $assigned, true ) ) continue;

        $new_term = get_term_by( 'slug', $new_slug, 'product_cat' );
        if ( ! $new_term || is_wp_error( $new_term ) ) continue;

        $terms_to_add[] = $new_term->term_id;

        $old_term = get_term_by( 'slug', $old_slug, 'product_cat' );
        if ( $old_term && ! is_wp_error( $old_term ) ) {
            $terms_to_remove[] = $old_term->term_id;
        }
    }

    if ( empty( $terms_to_add ) ) return false;

    $running = true;

    $current_ids = wp_get_post_terms( $product_id, 'product_cat', ['fields' => 'ids'] );
    if ( is_wp_error( $current_ids ) ) $current_ids = [];

    $updated_ids = array_unique(
        array_diff(
            array_merge( $current_ids, $terms_to_add ),
            $terms_to_remove
        )
    );

    wp_set_post_terms( $product_id, $updated_ids, 'product_cat' );
    $running = false;

    return true;
}

/*
    Force WooCommerce single product page to use padded image if one exists in gallery.
    Falls back to original featured image if no padded version found.
*/
add_action( 'wp_footer', function() {
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
}, 20 );