<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ============================================================
// AJAX handler — "Run Conversion" button
// ============================================================

add_action('wp_ajax_ttr_run_category_conversion_complex', function () {
    check_ajax_referer('ttr_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_die( esc_html__( 'Unauthorized', 'testaroo' ) );
    }

    $fixers_settings = ttr_get_tools_settings();

    $scenarios = $fixers_settings['fixComplexCategoryMappings'] ?? [];

    if (empty($scenarios)) {
        wp_send_json_error('No complex category scenarios configured. Please add scenarios in the Fix The Woo tab.');
        return;
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

    $productsProcessed   = count($product_ids);
    $productsUpdated     = 0;
    $updatedProductsData = [];

    $fixers_blacklisted_ids = ttr_blacklist_get_ids(ttr_fixers_blacklist_path());
    foreach ($product_ids as $product_id) {
        if (in_array((int) $product_id, $fixers_blacklisted_ids, true)) continue;
        $changed = ttr_apply_complex_scenarios((int) $product_id, $scenarios);
        if (!$changed) continue;

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
        'message'             => "Complex recategorization batch complete.",
        'productsProcessed'   => $productsProcessed,
        'productsUpdated'     => $productsUpdated,
        'updatedProductsData' => $updatedProductsData,
    ]);
});

// ============================================================
// Core engine
// ============================================================

/**
 * Run all complex scenarios against a single product.
 * Returns true if at least one change was made.
 */
function ttr_apply_complex_scenarios(int $product_id, array $scenarios): bool {
    $any_changed = false;
    foreach ($scenarios as $scenario) {
        if (!ttr_complex_scenario_matches($product_id, $scenario)) 
			continue;

        $changed = false;

        // ── 1. Remove all existing categories ───────────────────────────────
        if (!empty($scenario['remove_all_categories'])) {
            $current_slugs = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);
            if (!is_wp_error($current_slugs) && !empty($current_slugs)) {
                // Use the same proven one-by-one removal path as remove_category_slugs
                $scenario['remove_category_slugs'] = array_merge(
                    $current_slugs,
                    $scenario['remove_category_slugs'] ?? []
                );
            }
        }

        // ── 2. Remove specific category slugs ───────────────────────────────
        $slugs_to_remove = $scenario['remove_category_slugs'] ?? [];
        if (!empty($slugs_to_remove)) {
            $current_ids = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'ids']);
            if (is_wp_error($current_ids)) $current_ids = [];

            $ids_to_remove = [];
            foreach ($slugs_to_remove as $slug) {
                $term = get_term_by('slug', $slug, 'product_cat');
                if ($term && !is_wp_error($term)) $ids_to_remove[] = $term->term_id;
            }

            if (!empty($ids_to_remove)) {
                $new_ids = array_values(array_diff($current_ids, $ids_to_remove));
                wp_set_post_terms($product_id, $new_ids, 'product_cat');
                $changed = true;
            }
        }

        // ── 3. Apply one or more target categories ───────────────────────────
        $apply_slugs = $scenario['apply_category_slugs'] ?? [];
        foreach ($apply_slugs as $slug) {
            $applied = ttr_complex_apply_category($product_id, trim($slug));
            $changed = $changed || $applied;
        }

        $any_changed = $any_changed || $changed;
    }
    return $any_changed;
}

/**
 * Evaluate one scenario against one product.
 *
 * Logic:
 *   1. Categories ALWAYS required (exact or subset per exact_match flag).
 *   2. If ANY of title_contains / description_contains / attribute_checks are set,
 *      at least ONE of them must match (OR logic).
 *   3. If none of the text/attribute conditions are set, the scenario fires on
 *      category match alone.
 *
 * Scenario keys:
 *   matching_category_slugs  array    — slugs the product must have
 *   exact_match              bool     — true = no extra categories allowed
 *   apply_category_slugs     array    — slugs to add when rule fires (comma-sep in UI)
 *   remove_all_categories    bool     — strip all existing categories before applying
 *   remove_category_slugs    array    — specific slugs to remove before applying
 *   title_contains           string   — '' = skip
 *   description_contains     string   — '' = skip
 *   attribute_checks         array    — [{name, contains}, ...] all must match (AND)
 */
function ttr_complex_scenario_matches(int $product_id, array $scenario): bool {

    // ── 1. Category matching ────────────────────────────────────────────────

    $required_slugs = $scenario['matching_category_slugs'] ?? [];
    $product_terms  = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'slugs']);

    if (is_wp_error($product_terms)) return false;

    foreach ($required_slugs as $slug) {
        if (!in_array($slug, $product_terms, true)) return false;
    }

    if (!empty($scenario['exact_match'])) {
        if (!empty(array_diff($product_terms, $required_slugs))) return false;
    }

    // ── 2. Build the text/attribute conditions ──────────────────────────────

    $title_needle = strtolower($scenario['title_contains'] ?? '');
    $desc_needle  = strtolower($scenario['description_contains'] ?? '');

    // Support both new array format and legacy single object
    $attr_checks = [];
    if (!empty($scenario['attribute_checks']) && is_array($scenario['attribute_checks'])) {
        $attr_checks = $scenario['attribute_checks'];
    } elseif (!empty($scenario['attribute_check']) && is_array($scenario['attribute_check'])) {
        $attr_checks = [$scenario['attribute_check']]; // legacy shim
    }

    $has_conditions = $title_needle !== '' || $desc_needle !== '' || !empty($attr_checks);

    if (!$has_conditions) return true; // category match alone is sufficient

    // ── 3. AND across all conditions — every non-empty condition must match ──

    // Title check
    if ($title_needle !== '') {
        if (stripos(get_the_title($product_id), $title_needle) === false) return false;
    }

    // Description check
    if ($desc_needle !== '') {
        $post       = get_post($product_id);
        $full_desc  = $post ? $post->post_content : '';
        $short_desc = $post ? $post->post_excerpt  : '';
        if (
            stripos($full_desc,  $desc_needle) === false &&
            stripos($short_desc, $desc_needle) === false
        ) return false;
    }

    // Attribute checks — ALL must match (AND)
    foreach ($attr_checks as $attr) {
        $attr_name = $attr['name']     ?? '';
        $attr_val  = $attr['contains'] ?? '';
        if (empty($attr_name)) continue;

        $terms = wp_get_post_terms($product_id, $attr_name, ['fields' => 'names']);
        if (is_wp_error($terms) || empty($terms)) return false;

        $found = false;
        foreach ($terms as $term_name) {
            if (stripos($term_name, $attr_val) !== false) {
                $found = true;
                break;
            }
        }
        if (!$found) return false;
    }

    return true;
}

/**
 * Add the target category to a product (idempotent).
 * Returns true when a new category was actually added.
 */
function ttr_complex_apply_category(int $product_id, string $target_slug): bool {
    if (empty($target_slug)) 
		return false;

    $term = get_term_by('slug', $target_slug, 'product_cat');
    if (!$term || is_wp_error($term)) {
        wp_send_json_error("[TTR ComplexCategories] Category '{$target_slug}' not found — create it in WooCommerce first.");
        return false;
    }

    $current_ids = wp_get_post_terms($product_id, 'product_cat', ['fields' => 'ids']);
    if (is_wp_error($current_ids)) $current_ids = [];

    if (in_array($term->term_id, $current_ids, true)) return false;

    wp_set_post_terms($product_id, array_merge($current_ids, [$term->term_id]), 'product_cat');
    return true;
}