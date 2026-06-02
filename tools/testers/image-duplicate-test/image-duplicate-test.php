<?php
if (!defined('ABSPATH')) {
    exit;
}

// ── WP_Filesystem bootstrap ───────────────────────────────────────────────────
// Called once here so all functions below can use $wp_filesystem directly.

function ttw_idt_fs(): WP_Filesystem_Base {
    global $wp_filesystem;
    if ( empty( $wp_filesystem ) ) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        WP_Filesystem();
    }
    return $wp_filesystem;
}

// ── File path helpers ──────────────────────────────────────────────────────────

function ttw_idt_load_state(): array {
    $path = ttw_idt_state_path();
    if ( ! file_exists( $path ) ) return [];
    $raw = ttw_idt_fs()->get_contents( $path );
    return $raw ? ( json_decode( $raw, true ) ?? [] ) : [];
}
function ttw_idt_save_state( array $state ): void {
    ttw_idt_fs()->put_contents( ttw_idt_state_path(), json_encode( $state ), FS_CHMOD_FILE );
}
function ttw_idt_clear_state(): void {
    $path = ttw_idt_state_path();
    if ( file_exists( $path ) ) wp_delete_file( $path );
}

function ttw_idt_load_results(): array {
    $path = ttw_idt_results_path();
    if ( ! file_exists( $path ) ) return [];
    $raw = ttw_idt_fs()->get_contents( $path );
    return $raw ? ( json_decode( $raw, true ) ?? [] ) : [];
}
function ttw_idt_save_results( array $results ): void {
    ttw_idt_fs()->put_contents( ttw_idt_results_path(), json_encode( $results ), FS_CHMOD_FILE );
}

// ── Deep-use cache — attachment IDs confirmed in-use outside products ──────────

function ttw_idt_load_cache(): array {
    $path = ttw_idt_cache_path();
    if ( ! file_exists( $path ) ) return [];
    $raw = ttw_idt_fs()->get_contents( $path );
    return $raw ? ( json_decode( $raw, true ) ?? [] ) : [];
}
function ttw_idt_save_cache( array $cache ): void {
    ttw_idt_fs()->put_contents( ttw_idt_cache_path(), json_encode( $cache ), FS_CHMOD_FILE );
}
function ttw_idt_is_cached( int $att_id ): bool {
    $cache = ttw_idt_load_cache();
    return isset( $cache[(string) $att_id] );
}
function ttw_idt_add_to_cache( int $att_id, array $references ): void {
    $cache = ttw_idt_load_cache();
    $cache[(string) $att_id] = [
        'attachment_id' => $att_id,
        'added_at'      => gmdate( 'Y-m-d H:i:s' ),
        'references'    => $references,
    ];
    ttw_idt_save_cache( $cache );
}

function ttw_idt_find_existing_zips(): array {
    $uploads = wp_upload_dir();
    $files   = glob( $uploads['basedir'] . '/deleted_unused_product_images_*.zip' ) ?: [];
    $result  = [];
    foreach ( $files as $path ) {
        $name     = basename( $path );
        $result[] = [
            'zip_name' => $name,
            'zip_url'  => $uploads['baseurl'] . '/' . $name,
            'size_mb'  => round( filesize( $path ) / 1048576, 1 ),
        ];
    }
    return $result;
}

// ── Enqueue + localize saved results ──────────────────────────────────────────

add_action('admin_enqueue_scripts', function ( $hook ) {
    if ( $hook !== 'toplevel_page_test-the-woo' ) return;

    wp_enqueue_style(
        'image-duplicate-test-css',
        plugin_dir_url( __FILE__ ) . 'image-duplicate-test.css',
        [],
        filemtime( plugin_dir_path( __FILE__ ) . 'image-duplicate-test.css' )
    );
    wp_enqueue_script(
        'image-duplicate-test-js',
        plugin_dir_url( __FILE__ ) . 'image-duplicate-test.js',
        [],
        filemtime( plugin_dir_path( __FILE__ ) . 'image-duplicate-test.js' ),
        true
    );

    wp_localize_script( 'image-duplicate-test-js', 'IDT', [
        'savedResults' => ttw_idt_load_results(),
        'cacheCount'   => count( ttw_idt_load_cache() ),
        'scanStatus'   => ttw_idt_get_scan_status(),
        'existingZips' => ttw_idt_find_existing_zips(),
    ]);
});

// ── SCAN STATUS — tells JS what is resumable on page load ─────────────────────

function ttw_idt_get_scan_status(): array {
    $state   = ttw_idt_load_state();
    $results = ttw_idt_load_results();

    $deep_offset = 0;
    $deep_total  = 0;
    if ( ! empty( $results['unused_images'] ) ) {
        $deep_total = count( $results['unused_images'] );
        foreach ( $results['unused_images'] as $i => $img ) {
            if ( ! ( $img['deep_checked'] ?? false ) ) {
                $deep_offset = $i;
                break;
            }
            $deep_offset = $i + 1;
        }
    }

    $phase4_interrupted = $deep_total > 0 && $deep_offset < $deep_total;

    return [
        'state_exists'       => ! empty( $state ),
        'phase'              => $state['phase']          ?? null,
        'att_processed'      => $state['att_processed']  ?? 0,
        'att_total'          => $state['att_total']      ?? 0,
        'prod_processed'     => $state['prod_processed'] ?? 0,
        'prod_total'         => $state['prod_total']     ?? 0,
        'results_exist'      => ! empty( $results ),
        'phase4_interrupted' => $phase4_interrupted,
        'deep_offset'        => $deep_offset,
        'deep_total'         => $deep_total,
    ];
}

// ── PHASE 1 — Hash a batch of attachments ────────────────────────────────────

add_action('wp_ajax_ttw_idt_scan_attachments', function () {
    ttw_ajax_security_check();
    $offset     = max( 0, intval(  wp_unslash($_POST['offset'])     ?? 0 ) );
    $batch_size = max( 1, intval(  wp_unslash($_POST['batch_size']) ?? 50 ) );

    $all_ids = get_posts([
        'post_type'      => 'attachment',
        'post_mime_type' => ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
        'post_status'    => 'inherit',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ]);

    $total = count( $all_ids );
    $batch = array_slice( $all_ids, $offset, $batch_size );

    $state      = ( $offset === 0 ) ? [] : ttw_idt_load_state();
    $hash_map   = $state['hash_map']   ?? [];
    $id_to_hash = $state['id_to_hash'] ?? [];

    foreach ( $batch as $att_id ) {
        $file = get_attached_file( $att_id );
        if ( ! $file || ! file_exists( $file ) ) continue;
        if ( ttw_is_image_blacklisted( $att_id ) ) continue;
        $hash = md5_file( $file );
        if ( $hash === false ) continue;
        $hash_map[$hash][]   = (int) $att_id;
        $id_to_hash[$att_id] = $hash;
    }

    $processed = $offset + count( $batch );

    $state['hash_map']      = $hash_map;
    $state['id_to_hash']    = $id_to_hash;
    $state['phase']         = ( $processed >= $total ) ? 2 : 1;
    $state['att_processed'] = $processed;
    $state['att_total']     = $total;
    ttw_idt_save_state( $state );

    wp_send_json_success([
        'done'      => $processed >= $total,
        'processed' => $processed,
        'total'     => $total,
    ]);
});

// ── PHASE 2 — Read a batch of products' image maps ────────────────────────────

add_action('wp_ajax_ttw_idt_scan_products', function () {
    ttw_ajax_security_check();
    $offset     = max( 0, intval( wp_unslash($_POST['offset'])     ?? 0 ) );
    $batch_size = max( 1, intval( wp_unslash($_POST['batch_size']) ?? 50 ) );

    $all_product_ids = get_posts([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'fields'         => 'ids',
        'orderby'        => 'ID',
        'order'          => 'ASC',
    ]);

    $total = count( $all_product_ids );
    $batch = array_slice( $all_product_ids, $offset, $batch_size );

    $state                  = ttw_idt_load_state();
    $product_image_map      = $state['product_image_map']      ?? [];
    $attachment_to_products = $state['attachment_to_products'] ?? [];

    foreach ( $batch as $pid ) {
        $ids   = [];
        $thumb = (int) get_post_thumbnail_id( $pid );
        if ( $thumb ) $ids[] = $thumb;

        $gallery = get_post_meta( $pid, '_product_image_gallery', true );
        if ( ! empty( $gallery ) ) {
            foreach ( array_map( 'intval', explode( ',', $gallery ) ) as $gid ) {
                if ( $gid && ! in_array( $gid, $ids, true ) ) $ids[] = $gid;
            }
        }

        $product_image_map[(int) $pid] = $ids;
        foreach ( $ids as $att_id ) {
            $attachment_to_products[$att_id][] = (int) $pid;
        }
    }

    $processed = $offset + count( $batch );

    $state['product_image_map']      = $product_image_map;
    $state['attachment_to_products'] = $attachment_to_products;
    $state['phase']                  = ( $processed >= $total ) ? 3 : 2;
    $state['prod_processed']         = $processed;
    $state['prod_total']             = $total;
    ttw_idt_save_state( $state );

    wp_send_json_success([
        'done'      => $processed >= $total,
        'processed' => $processed,
        'total'     => $total,
    ]);
});

// ── PHASE 3 — Analyse and save results ───────────────────────────────────────

add_action('wp_ajax_ttw_idt_analyse', function () {
    ttw_ajax_security_check();
    $state = ttw_idt_load_state();
    if ( empty( $state ) ) {
        wp_send_json_error(['message' => 'Scan state missing or expired. Please run the scan again.']);
        return;
    }

    $hash_map               = $state['hash_map']               ?? [];
    $id_to_hash             = $state['id_to_hash']             ?? [];
    $product_image_map      = $state['product_image_map']      ?? [];
    $attachment_to_products = $state['attachment_to_products'] ?? [];

    global $wpdb;
    $all_pids      = array_keys( $product_image_map );
    $product_names = [];
    if ( ! empty( $all_pids ) ) {
        foreach ( array_chunk( $all_pids, 1000 ) as $chunk ) {
            $placeholders = implode( ',', array_fill( 0, count( $chunk ), '%d' ) );
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
            $rows = $wpdb->get_results(
                $wpdb->prepare( "SELECT ID, post_title FROM {$wpdb->posts} WHERE ID IN ($placeholders)", ...$chunk )
            );
            foreach ( $rows as $row ) {
                $product_names[(int) $row->ID] = $row->post_title;
            }
        }
    }
    $get_name = fn( int $pid ): string => $product_names[$pid] ?? "Product #{$pid}";

    $used = [];
    foreach ( $product_image_map as $att_ids ) {
        foreach ( $att_ids as $id ) $used[$id] = true;
    }

    // ── S1 — same product duplicates ──
    $s1 = [];
    foreach ( $product_image_map as $pid => $att_ids ) {
        $groups = [];
        foreach ( $att_ids as $id ) {
            if ( isset( $id_to_hash[$id] ) ) $groups[$id_to_hash[$id]][] = $id;
        }
        foreach ( $groups as $group ) {
            if ( count( $group ) <= 1 ) continue;
            sort( $group );
            $s1[] = [
                'type'         => 's1',
                'product_id'   => (int) $pid,
                'product_name' => $get_name( (int) $pid ),
                'kept_id'      => $group[0],
                'kept_url'     => wp_get_attachment_url( $group[0] ),
                'deleted_ids'  => array_slice( $group, 1 ),
                'fixed'        => false,
            ];
        }
    }

    // ── S2 — cross-product duplicates ──
    $s2 = [];
    foreach ( $hash_map as $hash => $att_ids ) {
        if ( count( $att_ids ) <= 1 ) continue;
        $pids_for_hash = [];
        foreach ( $att_ids as $id ) {
            foreach ( $attachment_to_products[$id] ?? [] as $pid ) {
                $pids_for_hash[$pid] = $pid;
            }
        }
        if ( count( $pids_for_hash ) <= 1 ) continue;

        sort( $att_ids );
        $kept_id  = $att_ids[0];
        $affected = [];
        foreach ( $pids_for_hash as $pid ) {
            $dup_id = null;
            foreach ( $product_image_map[$pid] ?? [] as $id ) {
                if ( isset( $id_to_hash[$id] ) && $id_to_hash[$id] === $hash && $id !== $kept_id ) {
                    $dup_id = $id;
                    break;
                }
            }
            $affected[] = [
                'product_id'        => (int) $pid,
                'product_name'      => $get_name( (int) $pid ),
                'old_attachment_id' => $dup_id,
                'edit_url'          => admin_url( "post.php?post={$pid}&action=edit" ),
            ];
        }
        $s2[] = [
            'type'              => 's2',
            'hash'              => $hash,
            'kept_id'           => $kept_id,
            'kept_url'          => wp_get_attachment_url( $kept_id ),
            'duplicate_ids'     => array_slice( $att_ids, 1 ),
            'affected_products' => $affected,
            'fixed'             => false,
        ];
    }

    // ── S3 — unused images ──
    $s3 = [];
    if ( empty( $_POST['skip_unused'] ) ) {
        foreach ( array_keys( $id_to_hash ) as $att_id ) {
            if ( isset( $used[$att_id] ) ) continue;
            $url  = wp_get_attachment_url( $att_id );
            $file = get_attached_file( $att_id );
            $s3[] = [
                'type'                 => 's3',
                'attachment_id'        => (int) $att_id,
                'url'                  => $url,
                'filename'             => $file ? basename( $file ) : basename( (string) $url ),
                'fixed'                => false,
                'deep_checked'         => false,
                'referenced_elsewhere' => false,
                'references'           => [],
            ];
        }
    }

    $results = [
        'scanned_at'               => gmdate( 'Y-m-d H:i:s' ),
        'duplicates_same_product'  => $s1,
        'duplicates_cross_product' => $s2,
        'unused_images'            => $s3,
    ];

    ttw_idt_save_results( $results );
    ttw_idt_clear_state();

    wp_send_json_success( $results );
});

// ── GET RESULTS ───────────────────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_get_results', function () {
    ttw_ajax_security_check();
    $results = ttw_idt_load_results();
    if ( empty( $results ) ) {
        wp_send_json_error(['message' => 'No results found.']);
        return;
    }
    wp_send_json_success( $results );
});

// ── PHASE 4 — Deep-check unused images against all site content ───────────────

add_action('wp_ajax_ttw_idt_deep_check_unused', function () {
    ttw_ajax_security_check();
    global $wpdb;

    $offset     = max( 0, intval( isset( $_POST['offset'] )     ? wp_unslash( $_POST['offset'] )     : 0 ) );
    $batch_size = max( 1, intval( isset( $_POST['batch_size'] ) ? wp_unslash( $_POST['batch_size'] ) : 25 ) );

    $results = ttw_idt_load_results();
    if ( empty( $results ) || empty( $results['unused_images'] ) ) {
        wp_send_json_error(['message' => 'No results to deep-check.']);
        return;
    }

    $unused = &$results['unused_images'];
    $total  = count( $unused );
    $batch  = array_slice( $unused, $offset, $batch_size, true );

    foreach ( $batch as $idx => $item ) {
        $att_id  = (int) $item['attachment_id'];
        $att_url = wp_get_attachment_url( $att_id ) ?: '';

        if ( strpos( $att_url, '_ttw_padded_' ) !== false ) {
            $unused[$idx]['deep_checked']         = true;
            $unused[$idx]['referenced_elsewhere'] = true;
            $unused[$idx]['references']           = [['source' => 'ttw', 'note' => 'TTW-generated padded image — excluded from deletion']];
            continue;
        }

        if ( ttw_idt_is_cached( $att_id ) ) {
            $cached = ttw_idt_load_cache()[(string) $att_id];
            $unused[$idx]['deep_checked']         = true;
            $unused[$idx]['referenced_elsewhere'] = true;
            $unused[$idx]['references']           = array_merge(
                $cached['references'] ?? [],
                [['source' => 'cache', 'note' => 'Previously confirmed in-use (cached)']]
            );
            continue;
        }

        $references = [];

        // ── A) Scan post_content ──
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $content_hits = $wpdb->get_results( $wpdb->prepare(
            "SELECT ID, post_title, post_type, post_status
             FROM {$wpdb->posts}
             WHERE post_status NOT IN ('trash','auto-draft','inherit')
               AND (
                   post_content LIKE %s
                   OR post_content LIKE %s
               )
             LIMIT 10",
            '%wp-image-' . $att_id . '%',
            '%' . $wpdb->esc_like( $att_url ) . '%'
        ) );

        foreach ( $content_hits as $hit ) {
            $references[] = [
                'source' => 'post_content',
                'type'   => $hit->post_type,
                'id'     => (int) $hit->ID,
                'title'  => $hit->post_title,
                'status' => $hit->post_status,
            ];
        }

        // ── B) Scan wp_postmeta ──
        // Search by attachment ID, full URL, and bare filename so we catch
        // Elementor (_elementor_data stores full URLs), WPBakery, custom fields, etc.
        $att_basename_b = basename( get_attached_file( $att_id ) ?: '' );
        $meta_seen      = [];

        $meta_sub_searches = array_filter( [ (string) $att_id, $att_url, $att_basename_b ] );
        foreach ( $meta_sub_searches as $meta_term ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $hits = $wpdb->get_results( $wpdb->prepare(
                "SELECT pm.post_id, pm.meta_key, p.post_title, p.post_type
                 FROM {$wpdb->postmeta} pm
                 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_value LIKE %s
                   AND pm.meta_key NOT IN ('_thumbnail_id','_product_image_gallery','_wp_attachment_metadata','_wp_attached_file')
                   AND p.post_type != 'attachment'
                   AND p.post_status NOT IN ('trash','auto-draft')
                 LIMIT 10",
                '%' . $wpdb->esc_like( $meta_term ) . '%'
            ) );
            foreach ( $hits as $hit ) {
                $dedup_key = $hit->post_id . '|' . $hit->meta_key;
                if ( isset( $meta_seen[ $dedup_key ] ) ) continue;
                $meta_seen[ $dedup_key ] = true;
                $references[] = [
                    'source'     => 'postmeta',
                    'meta_key'   => $hit->meta_key,
                    'type'       => $hit->post_type,
                    'id'         => (int) $hit->post_id,
                    'title'      => $hit->post_title,
                    'matched_by' => $meta_term === (string) $att_id ? 'id' : ( $meta_term === $att_url ? 'url' : 'filename' ),
                ];
            }
            if ( count( $references ) >= 15 ) break;
        }

        // ── C) Scan wp_options ──
        // Search by ID, URL, and filename. Include underscore-prefixed options
        // (e.g. _elementor_css, theme_mods) which commonly store image references.
        $options_seen    = [];
        $option_searches = array_filter( [ (string) $att_id, $att_url, $att_basename_b ] );
        foreach ( $option_searches as $opt_term ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $option_hits = $wpdb->get_results( $wpdb->prepare(
                "SELECT option_name
                 FROM {$wpdb->options}
                 WHERE option_value LIKE %s
                   AND option_name NOT IN ('cron','rewrite_rules','oembed_fetch_error')
                 LIMIT 5",
                '%' . $wpdb->esc_like( $opt_term ) . '%'
            ) );
            foreach ( $option_hits as $hit ) {
                if ( isset( $options_seen[ $hit->option_name ] ) ) continue;
                $options_seen[ $hit->option_name ] = true;
                $references[] = [
                    'source'      => 'options',
                    'option_name' => $hit->option_name,
                    'matched_by'  => $opt_term === (string) $att_id ? 'id' : ( $opt_term === $att_url ? 'url' : 'filename' ),
                ];
            }
            if ( count( $references ) >= 15 ) break;
        }

        // ── D) Scan filesystem — theme + plugin CSS/HTML files ──
        // Scans theme directories and plugin directories.
        // wp-includes and wp-admin are excluded (core files never reference user uploads).
        // ABSPATH root is excluded to avoid scanning core WP files redundantly.
        $att_basename = basename( get_attached_file( $att_id ) ?: '' );
        $search_terms = array_filter( [$att_url, $att_basename] );

        $scan_dirs = array_unique( array_filter( [
            get_template_directory(),
            get_stylesheet_directory(),
            WP_PLUGIN_DIR,
        ], 'is_dir' ) );

        // Hard time budget: stop filesystem scanning 3 seconds before PHP's
        // max_execution_time to ensure we always return valid JSON.
        $php_max    = (int) ini_get('max_execution_time');
        $time_limit = $php_max > 0 ? $php_max - 3 : 27;
        $scan_start = microtime( true );
        $timed_out  = false;

        // Use WordPress-aware path references for core directory exclusions.
        // WPINC is the WordPress constant for the wp-includes folder name.
        // wp-admin has no dedicated constant so we derive it from ABSPATH.
        $core_includes_dir = trailingslashit( ABSPATH . WPINC );
        $core_admin_dir    = trailingslashit( ABSPATH . 'wp-admin' );

        foreach ( $scan_dirs as $scan_dir ) {
            if ( $timed_out ) break;
            if ( ! is_dir( $scan_dir ) ) continue;
            try {
                $iter = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator( $scan_dir, RecursiveDirectoryIterator::SKIP_DOTS ),
                    RecursiveIteratorIterator::LEAVES_ONLY
                );
                foreach ( $iter as $file ) {
                    if ( ( microtime( true ) - $scan_start ) >= $time_limit ) {
                        $timed_out = true;
                        break;
                    }

                    if ( ! $file->isFile() ) continue;
                    $ext = strtolower( $file->getExtension() );
                    if ( ! in_array( $ext, ['css', 'html', 'htm', 'php'], true ) ) continue;

                    $filepath = $file->getPathname();
                    if ( strpos( $filepath, $core_includes_dir ) !== false ) continue;
                    if ( strpos( $filepath, $core_admin_dir )    !== false ) continue;

                    $file_content = @file_get_contents( $filepath );
                    if ( $file_content === false ) continue;

                    foreach ( $search_terms as $term ) {
                        if ( strpos( $file_content, $term ) !== false ) {
                            $references[] = [
                                'source'  => 'filesystem',
                                'file'    => str_replace( ABSPATH, '', $filepath ),
                                'matched' => $term,
                            ];
                            break;
                        }
                    }

                    if ( count( $references ) >= 15 ) break;
                }
            } catch ( Exception $e ) {
                // Non-fatal — skip unreadable directories
            }
        }

        $unused[$idx]['deep_checked']         = true;
        $unused[$idx]['referenced_elsewhere'] = ! empty( $references );
        $unused[$idx]['references']           = $references;

        if ( ! empty( $references ) ) {
            ttw_idt_add_to_cache( $att_id, $references );
        }
    }

    ttw_idt_save_results( $results );

    $processed = $offset + count( $batch );
    wp_send_json_success([
        'done'      => $processed >= $total,
        'processed' => $processed,
        'total'     => $total,
    ]);
});

// ── DELETE SINGLE UNUSED IMAGE ────────────────────────────────────────────────

add_action('wp_ajax_ttw_delete_single_unused_image', function () {
    ttw_ajax_security_check();
    $att_id = isset( $_POST['attachment_id'] ) ? intval( wp_unslash( $_POST['attachment_id'] ) ) : 0;
    if ( ! $att_id ) { wp_send_json_error(['message' => 'Missing attachment_id']); return; }

    $still_used = get_posts([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'fields'         => 'ids',
        'posts_per_page' => 1,
        'meta_query'     => ['relation' => 'OR',
            ['key' => '_thumbnail_id',         'value' => $att_id,          'compare' => '='],
            ['key' => '_product_image_gallery', 'value' => (string) $att_id, 'compare' => 'LIKE'],
        ],
    ]);
    if ( ! empty( $still_used ) ) {
        wp_send_json_error(['message' => 'Image is still in use by a product.']);
        return;
    }

    $uploads     = wp_upload_dir();
    $archive_dir = $uploads['basedir'] . '/deleted_unused_product_images';
    if ( ! file_exists( $archive_dir ) ) wp_mkdir_p( $archive_dir );

    $file = get_attached_file( $att_id );
    if ( $file && file_exists( $file ) ) {
        // Preserve the original uploads sub-folder structure (e.g. 2026/05/image.png)
        $relative = ltrim( str_replace( $uploads['basedir'], '', $file ), '/' );
        $dest     = $archive_dir . '/' . $relative;
        wp_mkdir_p( dirname( $dest ) );
        if ( file_exists( $dest ) ) {
            $info = pathinfo( $dest );
            $dest = $info['dirname'] . '/' . $att_id . '_' . $info['basename'];
        }
        ttw_idt_fs()->move( $file, $dest );
    }
    wp_trash_post( $att_id );
    wp_send_json_success(['moved' => [$att_id]]);
});

// ── ADD SINGLE IMAGE TO DEEP-USE CACHE ───────────────────────────────────────

add_action('wp_ajax_ttw_idt_add_to_deep_cache', function () {
    ttw_ajax_security_check();
    $att_id = isset( $_POST['attachment_id'] ) ? intval( wp_unslash( $_POST['attachment_id'] ) ) : 0;
    if ( ! $att_id ) { wp_send_json_error(['message' => 'Missing attachment_id']); return; }
    ttw_idt_add_to_cache( $att_id, [['source' => 'manual', 'note' => 'Manually added to deep-use cache']] );
    wp_send_json_success(['count' => count( ttw_idt_load_cache() )]);
});

// ── GET DEEP-USE CACHE ENTRIES ────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_get_cache_stats', function () {
    ttw_ajax_security_check();
    $cache = ttw_idt_load_cache();
    wp_send_json_success([
        'count'   => count( $cache ),
        'entries' => array_values( $cache ),
    ]);
});

add_action('wp_ajax_ttw_idt_clear_cache', function () {
    ttw_ajax_security_check();
    $path = ttw_idt_cache_path();
    if ( file_exists( $path ) ) wp_delete_file( $path );
    wp_send_json_success(['message' => 'Deep-use cache cleared.']);
});

add_action('wp_ajax_ttw_idt_remove_from_cache', function () {
    ttw_ajax_security_check();
    $att_id = isset( $_POST['attachment_id'] ) ? intval( wp_unslash( $_POST['attachment_id'] ) ) : 0;
    if ( ! $att_id ) { wp_send_json_error(['message' => 'Missing attachment_id']); return; }
    $cache = ttw_idt_load_cache();
    unset( $cache[(string) $att_id] );
    ttw_idt_save_cache( $cache );
    wp_send_json_success();
});

// ── MARK RESULT FIXED ─────────────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_mark_fixed', function () {
    ttw_ajax_security_check();
    $type = isset( $_POST['type'] ) ? sanitize_text_field( wp_unslash( $_POST['type'] ) ) : '';
    $key  = isset( $_POST['key'] )  ? sanitize_text_field( wp_unslash( $_POST['key'] ) )  : '';

    if ( ! $type || ! $key ) {
        wp_send_json_error(['message' => 'Missing type or key']);
        return;
    }

    $results = ttw_idt_load_results();
    if ( empty( $results ) ) {
        wp_send_json_success(); return;
    }

    $map = [
        's1' => ['section' => 'duplicates_same_product',  'field' => 'product_id'],
        's2' => ['section' => 'duplicates_cross_product', 'field' => 'hash'],
        's3' => ['section' => 'unused_images',            'field' => 'attachment_id'],
    ];

    if ( ! isset( $map[$type] ) ) {
        wp_send_json_error(['message' => 'Invalid type']); return;
    }

    $section = $map[$type]['section'];
    $field   = $map[$type]['field'];

    $results[$section] = array_values( array_filter(
        $results[$section] ?? [],
        fn( $item ) => (string) ( $item[$field] ?? '' ) !== (string) $key
    ) );

    ttw_idt_save_results( $results );
    wp_send_json_success();
});

// ── CLEAR ALL RESULTS ─────────────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_clear_results', function () {
    ttw_ajax_security_check();
    $path = ttw_idt_results_path();
    if ( file_exists( $path ) ) wp_delete_file( $path );
    wp_send_json_success();
});

// ── FIX SAME-PRODUCT DUPLICATES (S1) ─────────────────────────────────────────

add_action('wp_ajax_ttw_fix_same_product_duplicates', function () {
    ttw_ajax_security_check();
    $product_id  = isset( $_POST['product_id'] )  ? intval( wp_unslash( $_POST['product_id'] ) )  : 0;
    $kept_id     = isset( $_POST['kept_id'] )      ? intval( wp_unslash( $_POST['kept_id'] ) )      : 0;
    $deleted_ids = array_map( 'intval', json_decode( stripslashes( $_POST['deleted_ids'] ?? '[]' ), true ) );

    if ( ! $product_id || ! $kept_id || empty( $deleted_ids ) ) {
        wp_send_json_error(['message' => 'Invalid input']); return;
    }

    $thumb_id    = (int) get_post_thumbnail_id( $product_id );
    $gallery_raw = get_post_meta( $product_id, '_product_image_gallery', true );
    $gallery_ids = $gallery_raw ? array_map( 'intval', explode( ',', $gallery_raw ) ) : [];

    foreach ( $deleted_ids as $del_id ) {
        if ( $thumb_id === $del_id ) set_post_thumbnail( $product_id, $kept_id );
        $gallery_ids = array_values( array_filter( $gallery_ids, fn( $id ) => $id !== $del_id ) );
        $other = get_posts([
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'fields'         => 'ids',
            'posts_per_page' => 1,
            'meta_query'     => ['relation' => 'OR',
                ['key' => '_thumbnail_id',         'value' => $del_id,          'compare' => '='],
                ['key' => '_product_image_gallery', 'value' => (string) $del_id, 'compare' => 'LIKE'],
            ],
        ]);
        if ( empty( $other ) ) wp_delete_attachment( $del_id, true );
    }

    if ( $thumb_id !== $kept_id && ! in_array( $kept_id, $gallery_ids, true ) ) $gallery_ids[] = $kept_id;
    update_post_meta( $product_id, '_product_image_gallery', implode( ',', array_filter( $gallery_ids ) ) );
    wc_delete_product_transients( $product_id );
    clean_post_cache( $product_id );

    wp_send_json_success(['message' => 'Duplicates removed from product.']);
});

// ── FIX CROSS-PRODUCT DUPLICATES (S2) ────────────────────────────────────────

add_action('wp_ajax_ttw_fix_cross_product_duplicates', function () {
    ttw_ajax_security_check();
    $kept_id           = isset( $_POST['kept_id'] )           ? intval( wp_unslash( $_POST['kept_id'] ) )                                                   : 0;
    $duplicate_ids     = array_map( 'intval', json_decode( stripslashes( isset( $_POST['duplicate_ids'] )     ? wp_unslash( $_POST['duplicate_ids'] )     : '[]' ), true ) );
    $affected_products = json_decode( stripslashes( isset( $_POST['affected_products'] ) ? wp_unslash( $_POST['affected_products'] ) : '[]' ), true );

    if ( ! $kept_id || empty( $affected_products ) ) {
        wp_send_json_error(['message' => 'Invalid input']); return;
    }

    foreach ( $affected_products as $info ) {
        $pid        = intval( $info['product_id']        ?? 0 );
        $old_att_id = intval( $info['old_attachment_id'] ?? 0 );
        if ( ! $pid ) continue;

        $thumb_id = (int) get_post_thumbnail_id( $pid );
        if ( $old_att_id && $thumb_id === $old_att_id ) set_post_thumbnail( $pid, $kept_id );
        elseif ( ! $thumb_id ) set_post_thumbnail( $pid, $kept_id );

        $gallery_raw = get_post_meta( $pid, '_product_image_gallery', true );
        $gallery_ids = $gallery_raw ? array_map( 'intval', explode( ',', $gallery_raw ) ) : [];
        $gallery_ids = array_values( array_filter( $gallery_ids, fn( $id ) => ! in_array( $id, $duplicate_ids, true ) ) );
        if ( ! in_array( $kept_id, $gallery_ids, true ) && $thumb_id !== $kept_id ) $gallery_ids[] = $kept_id;
        update_post_meta( $pid, '_product_image_gallery', implode( ',', array_filter( $gallery_ids ) ) );
        wc_delete_product_transients( $pid );
        clean_post_cache( $pid );
    }

    foreach ( $duplicate_ids as $del_id ) {
        if ( $del_id !== $kept_id ) wp_delete_attachment( $del_id, true );
    }

    wp_send_json_success(['message' => 'Cross-product duplicates resolved.']);
});

// ── DELETE UNUSED IMAGES (S3) ─────────────────────────────────────────────────

add_action('wp_ajax_ttw_delete_unused_images', function () {
    ttw_ajax_security_check();
    $attachment_ids = array_map( 'intval', json_decode( wp_unslash( $_POST['attachment_ids'] ?? '[]' ), true ) );

    if ( empty( $attachment_ids ) ) {
        wp_send_json_error(['message' => 'No attachment IDs provided']); return;
    }

    $uploads     = wp_upload_dir();
    $archive_dir = $uploads['basedir'] . '/deleted_unused_product_images';
    if ( ! file_exists( $archive_dir ) ) wp_mkdir_p( $archive_dir );

    $moved = $skipped = [];

    foreach ( $attachment_ids as $att_id ) {
        $still_used = get_posts([
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'fields'         => 'ids',
            'posts_per_page' => 1,
            'meta_query'     => ['relation' => 'OR',
                ['key' => '_thumbnail_id',         'value' => $att_id,           'compare' => '='],
                ['key' => '_product_image_gallery', 'value' => (string) $att_id, 'compare' => 'LIKE'],
            ],
        ]);
        if ( ! empty( $still_used ) ) { $skipped[] = $att_id; continue; }

        $file = get_attached_file( $att_id );
        if ( $file && file_exists( $file ) ) {
            // Preserve the original uploads sub-folder structure (e.g. 2026/05/image.png)
            $relative = ltrim( str_replace( $uploads['basedir'], '', $file ), '/' );
            $dest     = $archive_dir . '/' . $relative;
            wp_mkdir_p( dirname( $dest ) );
            if ( file_exists( $dest ) ) {
                $info = pathinfo( $dest );
                $dest = $info['dirname'] . '/' . $att_id . '_' . $info['basename'];
            }
            ttw_idt_fs()->move( $file, $dest );
        }
        wp_trash_post( $att_id );
        $moved[] = $att_id;
    }

    wp_send_json_success([
        'moved'   => $moved,
        'skipped' => $skipped,
        'message' => count( $moved ) . ' image(s) moved to archive. ' .
                     count( $skipped ) . ' skipped (still in use).',
    ]);
});

// ── ZIP ARCHIVE ───────────────────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_zip_archive', function () {
    ttw_ajax_security_check();
    ob_start();

    if ( ! class_exists( 'ZipArchive' ) ) {
        ob_end_clean();
        wp_send_json_error(['message' => 'ZipArchive PHP extension is not available on this server.']);
        return;
    }

    $uploads     = wp_upload_dir();
    $archive_dir = $uploads['basedir'] . '/deleted_unused_product_images';

    if ( ! file_exists( $archive_dir ) || count( scandir( $archive_dir ) ) <= 2 ) {
        ob_end_clean();
        wp_send_json_error(['message' => 'Archive folder is empty or does not exist.']);
        return;
    }

    $zip_name = 'deleted_unused_product_images_' . gmdate( 'Y-m-d_H-i-s' ) . '.zip';
    $zip_path = $uploads['basedir'] . '/' . $zip_name;
    $zip_url  = $uploads['baseurl'] . '/' . $zip_name;

    $zip = new ZipArchive();
    if ( $zip->open( $zip_path, ZipArchive::CREATE | ZipArchive::OVERWRITE ) !== true ) {
        ob_end_clean();
        wp_send_json_error(['message' => 'Could not create zip file.']);
        return;
    }

    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator( $archive_dir, RecursiveDirectoryIterator::SKIP_DOTS )
    );

    foreach ( $files as $file ) {
        if ( $file->isFile() ) {
            // Store with path relative to archive_dir so folder structure is preserved in the zip
            $relative_in_zip = substr( $file->getPathname(), strlen( $archive_dir ) + 1 );
            $zip->addFile( $file->getPathname(), $relative_in_zip );
        }
    }

    $zip->close();

    // Delete the archive folder now that it's safely zipped
    $dir_files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator( $archive_dir, RecursiveDirectoryIterator::SKIP_DOTS ),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ( $dir_files as $f ) {
        $f->isDir() ? ttw_idt_fs()->rmdir( $f->getPathname(), true ) : wp_delete_file( $f->getPathname() );
    }
    ttw_idt_fs()->rmdir( $archive_dir, true );

    ob_end_clean();
    wp_send_json_success([
        'zip_url'  => $zip_url,
        'zip_path' => $zip_path,
        'zip_name' => $zip_name,
        'message'  => 'Zip created and archive folder deleted.',
    ]);
});

// ── DELETE ZIP ────────────────────────────────────────────────────────────────

add_action('wp_ajax_ttw_idt_delete_zip', function () {
    ttw_ajax_security_check();
    ob_start();
    $zip_name = isset( $_POST['zip_name'] ) ? sanitize_file_name( wp_unslash( $_POST['zip_name'] ) ) : '';

    if ( ! $zip_name || ! str_ends_with( $zip_name, '.zip' ) ) {
        ob_end_clean();
        wp_send_json_error(['message' => 'Invalid zip filename.']);
        return;
    }

    $uploads  = wp_upload_dir();
    $zip_path = $uploads['basedir'] . '/' . $zip_name;

    if ( ! str_starts_with( basename( $zip_name ), 'deleted_unused_product_images_' ) ) {
        ob_end_clean();
        wp_send_json_error(['message' => 'Not a recognised backup zip.']);
        return;
    }

    if ( ! file_exists( $zip_path ) ) {
        ob_end_clean();
        wp_send_json_success(['message' => 'File already removed.']);
        return;
    }

    wp_delete_file( $zip_path );
    ob_end_clean();
    wp_send_json_success(['message' => 'Backup zip deleted.']);
});