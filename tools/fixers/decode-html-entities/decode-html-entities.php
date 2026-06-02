<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action('wp_ajax_ttr_decode_html_entities', function () {
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
    $checked_count    = 0;
    $updated_count    = 0;
    $updated_products = [];

    $fixers_blacklisted_ids = ttr_blacklist_get_ids(ttr_fixers_blacklist_path());
    foreach ($product_ids as $product_id) {
        if (in_array((int) $product_id, $fixers_blacklisted_ids, true)) continue;
        $checked_count++;
        $result = ttr_decode_product_entities((int) $product_id);
        if ($result === false) continue;

        $updated_count++;
        $updated_products[] = [
            'product_id'   => $product_id,
            'product_name' => $result['product_name'],
            'fields'       => $result['fields'],
        ];
    }

    wp_send_json_success([
        'done'             => count($product_ids) < $batch_size,
        'next_offset'      => $offset + $batch_size,
        'checked_count'    => $checked_count,
        'updated_count'    => $updated_count,
        'updated_products' => $updated_products,
    ]);
});

function ttr_decode_product_entities(int $product_id) {
    $post = get_post($product_id);
    if (!$post) 
        return [ 'error' => "Invalid product ID" ];
    
    $decoded_title = html_entity_decode($post->post_title,   ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $decoded_short = html_entity_decode($post->post_excerpt, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $decoded_long  = html_entity_decode($post->post_content, ENT_QUOTES | ENT_HTML5, 'UTF-8');

    $title_changed = $decoded_title !== $post->post_title;
    $short_changed = $decoded_short !== $post->post_excerpt;
    $long_changed  = $decoded_long  !== $post->post_content;

    if (!$title_changed && !$short_changed && !$long_changed) return false;

    $update_data = ['ID' => $product_id];
    if ($title_changed) $update_data['post_title']   = $decoded_title;
    if ($short_changed) $update_data['post_excerpt'] = $decoded_short;
    if ($long_changed)  $update_data['post_content'] = $decoded_long;

    $result = wp_update_post($update_data, true);
    if (is_wp_error($result)) return false;

    return [
        'product_name' => $decoded_title ?: $post->post_title,
        'fields'       => array_values(array_filter([
            $title_changed ? 'title'      : null,
            $short_changed ? 'short desc' : null,
            $long_changed  ? 'long desc'  : null,
        ])),
    ];
}