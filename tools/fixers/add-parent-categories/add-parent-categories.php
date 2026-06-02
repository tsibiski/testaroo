<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action('wp_ajax_ttr_add_parent_categories', function () {
    check_ajax_referer('ttr_nonce', 'nonce');
    if (!current_user_can('manage_woocommerce')) {
        wp_send_json_error('Unauthorized', 403);
    }
    $batch_size = 100;
    $offset     = isset($_POST['offset']) ? intval($_POST['offset']) : 0;
    global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
    $product_ids = $wpdb->get_col($wpdb->prepare("
        SELECT ID FROM {$wpdb->posts}
        WHERE post_type = 'product'
        AND post_status IN ('publish','private','draft','pending')
        ORDER BY ID
        LIMIT %d OFFSET %d
    ", $batch_size, $offset));
    $updated_count              = 0;
    $checked_count              = 0;
    $totalCategoriesAdded_count = 0;
    $fixers_blacklisted_ids = ttr_blacklist_get_ids(ttr_fixers_blacklist_path());
    foreach ($product_ids as $product_id) {
        if (in_array((int) $product_id, $fixers_blacklisted_ids, true)) continue;
        $checked_count++;
        $added = ttr_add_parent_categories((int) $product_id);
        if ($added > 0) {
            $updated_count++;
            $totalCategoriesAdded_count += $added;
        }
    }
    wp_send_json_success([
        'done'                       => count($product_ids) < $batch_size,
        'next_offset'                => $offset + $batch_size,
        'checked_count'              => $checked_count,
        'updated_count'              => $updated_count,
        'totalCategoriesAdded_count' => $totalCategoriesAdded_count,
    ]);
});

function ttr_add_parent_categories(int $product_id): int {
    $assigned_terms = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'ids']);
    if (is_wp_error($assigned_terms) || empty($assigned_terms)) return 0;

    $assigned_terms   = array_map('intval', $assigned_terms);
    $ancestors_to_add = [];

    foreach ($assigned_terms as $term_id) {
        clean_term_cache($term_id, 'product_cat');
        $ancestors = get_ancestors($term_id, 'product_cat', 'taxonomy');
        foreach ($ancestors as $ancestor_id) {
            $ancestors_to_add[] = (int) $ancestor_id;
        }
    }

    $new_terms = array_unique(array_merge($assigned_terms, $ancestors_to_add));

    // Remove 'uncategorized' if there are other real categories
    $uncategorized = get_term_by('slug', 'uncategorized', 'product_cat');
    if ($uncategorized && !is_wp_error($uncategorized)) {
        $real_terms = array_diff($new_terms, [$uncategorized->term_id]);
        if (!empty($real_terms)) {
            $new_terms = array_values($real_terms);
        }
    }

    $added   = array_diff($new_terms, $assigned_terms);
    $removed = array_diff($assigned_terms, $new_terms);

    if (empty($added) && empty($removed)) return 0;

    $result = wp_set_post_terms($product_id, $new_terms, 'product_cat');
    return is_wp_error($result) ? 0 : count($added);
}