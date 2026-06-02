<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action('wp_ajax_ttr_save_category_conversion_simple', function () {
    check_ajax_referer('ttr_nonce', 'nonce');

    if (!current_user_can('manage_options')) {
        wp_die( esc_html__( 'Unauthorized', 'testaroo' ) );
    }

    $batch_size = 100;
    $offset     = isset($_POST['offset']) ? intval($_POST['offset']) : 0;

    $fixers_settings = ttr_get_tools_settings();

    $mappings = $fixers_settings['fixSimpleCategoryMappings'] ?? [];

    if (empty($mappings)) {
        wp_send_json_error('No category mappings configured. Please add mappings in the Fix The Woo tab.');
    }

    global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $product_ids = $wpdb->get_col($wpdb->prepare("
        SELECT ID FROM {$wpdb->posts}
        WHERE post_type = 'product'
        AND post_status IN ('publish','private','draft','pending')
        ORDER BY ID
        LIMIT %d OFFSET %d
    ", $batch_size, $offset));

    $productsProcessed = count($product_ids);
    $productsUpdated   = 0;
    $updatedProductsData = [];

    $fixers_blacklisted_ids = ttr_blacklist_get_ids(ttr_fixers_blacklist_path());
    foreach ($product_ids as $product_id) {
        if (in_array((int) $product_id, $fixers_blacklisted_ids, true)) continue;
        $wasUpdated = fix_categoryMappings((int) $product_id, $mappings);

        if (!$wasUpdated) {
            continue;
        }

        $product      = wc_get_product($product_id);
        $product_name = $product ? $product->get_name() : 'Unknown Product';

        $updatedProductsData[] = [
            'product_id'   => $product_id,
            'product_name' => $product_name,
        ];

        $productsUpdated++;
    }

    wp_send_json_success([
        'done'                => count($product_ids) < $batch_size,
        'next_offset'         => $offset + $batch_size,
        'productsProcessed'   => $productsProcessed,
        'productsUpdated'     => $productsUpdated,
        'updatedProductsData' => $updatedProductsData,
    ]);
});