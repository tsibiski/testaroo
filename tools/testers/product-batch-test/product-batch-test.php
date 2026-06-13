<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_testaroo') {
        return;
    }

    wp_enqueue_style(
        'product-batch-test-css',
        plugin_dir_url(__FILE__) . 'product-batch-test.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'product-batch-test.css')
    );

    wp_enqueue_script(
        'product-batch-test-js',
        plugin_dir_url(__FILE__) . 'product-batch-test.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'product-batch-test.js'),
        true
    );
    
    $file_path   = ttr_batch_results_path();
    $jsonResults = [];
    if (file_exists($file_path)) {
        $lines       = file($file_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $jsonResults = array_map(function($line) { return json_decode($line, true); }, $lines);
    }
    
    $previousRunCount = (int) get_transient('testaroo_product_processed_count');
    $batch_settings    = ttr_product_batch_test_get_settings();

    wp_localize_script('product-batch-test-js', 'BATCH', [
        'results'                => array_values($jsonResults),
        'previousRunCount'       => $previousRunCount,
        'imageSizeDelimiter'     => $batch_settings['imageSizeDelimiter'] ?? '-',
        'minimumImageDimensions' => $batch_settings['minimumImageDimensions'] ?? '300',
    ]);
});

add_action('wp_ajax_testaroo_clear_file', function () {
    ttr_ajax_security_check();
    $file_path = ttr_batch_results_path();
    wp_mkdir_p( dirname( $file_path ) );
    global $wp_filesystem;
    if ( empty( $wp_filesystem ) ) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        WP_Filesystem();
    }
    $wp_filesystem->put_contents( $file_path, '', FS_CHMOD_FILE );
    set_transient('testaroo_product_processed_count', 0);
    wp_send_json(['status' => 'cleared']);
});

add_action('wp_ajax_testaroo_append_result', function () {
    ttr_ajax_security_check();
    $raw     = $_POST['data'] ?? '';
    $decoded = json_decode(stripslashes($raw), true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json(['status' => 'error', 'message' => 'Invalid JSON']);
        return;
    }

    $file_path = ttr_batch_results_path();
    wp_mkdir_p( dirname( $file_path ) );
    file_put_contents($file_path, json_encode($decoded) . "\n", FILE_APPEND | LOCK_EX);

    wp_send_json(['status' => 'saved']);
});

add_action('wp_ajax_testaroo_remove_result', function () {
    ttr_ajax_security_check();
    $product_id = intval($_POST['product_id'] ?? 0);

    if (!$product_id) {
        wp_send_json(['status' => 'error', 'message' => 'Missing product_id']);
        return;
    }

    $file_path = ttr_batch_results_path();

    if (!file_exists($file_path)) {
        wp_send_json(['status' => 'ok']);
        return;
    }

    $lines   = file($file_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $updated = array_filter($lines, function ($line) use ($product_id) {
        $obj = json_decode($line, true);
        return isset($obj['product_id']) && (int) $obj['product_id'] !== $product_id;
    });

    wp_mkdir_p( dirname( $file_path ) );
    file_put_contents($file_path, implode("\n", $updated) . (count($updated) ? "\n" : ""), LOCK_EX);

    wp_send_json(['status' => 'ok']);
});

function ttr_product_batch_test_get_settings() {
    $defaults = [
        'imageSizeDelimiter'     => '-',
        'minimumImageDimensions' => 300,
    ];
    $settings = ttr_get_tools_settings();
    if (!is_array($settings)) {
        return $defaults;
    }
    return array_merge($defaults, $settings);
}

function ttr_product_batch_test_get_ignored_products() {
    $file_path = ttr_batch_ignored_products_path();

    if (!file_exists($file_path)) {
        file_put_contents($file_path, json_encode([]));
    }

    $ignored = json_decode(file_get_contents($file_path), true);

    return is_array($ignored) ? array_map('intval', $ignored) : [];
}

add_action('wp_ajax_ttr_find_product_images', function () {
    ttr_ajax_security_check();
    $product_name = sanitize_text_field(wp_unslash($_POST['product_name']));

    // Accept optional filtered domain list from the front end
    $raw_domains    = isset($_POST['search_domains']) ? json_decode(stripslashes($_POST['search_domains']), true) : null;
    $search_domains = (is_array($raw_domains) && !empty($raw_domains)) ? array_map('sanitize_text_field', $raw_domains) : null;

    if (!empty($product_name)) {
        $result = ttr_find_product_images($product_name, $search_domains);
        // If result is an error envelope, pass it through directly
        if (isset($result['status']) && $result['status'] === 'error') {
            wp_send_json_success($result);
            return;
        }
        wp_send_json_success([
            'status' => 'success',
            'images' => $result,
            'message' => 'Successful search. See images for results.'
        ]);
    }
    
    wp_send_json([
      'status' => 'error', 
      'message' => 'Product title cannot be an empty string.'
    ]);    
});

function ttr_find_product_images($product_name, $override_domains = null)
{
    // Load API key and search sites from options
    $settings = ttr_get_settings();

    $api_key = $settings['tavilyApiKey'] ?? '';
    if (empty($api_key)) {
        return ['status' => 'error', 'images' => [], 'message' => 'No Tavily API key configured. Please add your API key in the Testaroo Info tab under Store & API Settings.'];
    }

    // Default domain list from settings; empty = search entire web
    // searchSites is [{url, category}] — extract just the url values for Tavily
    $raw_sites = $settings['searchSites'] ?? [];
    $default_domains = array_values(array_filter(array_map(function($s) {
        return is_array($s) ? ($s['url'] ?? '') : (is_string($s) ? $s : '');
    }, $raw_sites)));

    // Caller may pass a filtered list; fall back to settings list
    $domains = (!empty($override_domains) && is_array($override_domains))
        ? $override_domains
        : $default_domains;

    $response = wp_remote_post('https://api.tavily.com/search',
        [
            'timeout' => 60,
            'headers' => [
                'Content-Type' => 'application/json'
            ],
            'body' => wp_json_encode([
                'api_key'        => $api_key,
                'query'          => $product_name,
                'search_depth'   => 'basic',
                'include_images' => true,
                'max_results'    => 10,
                'include_domains' => $domains
            ])
        ]
    );

    if (is_wp_error($response)) {
        wp_send_json([
            'status'  => 'error',
            'message' => $response->get_error_message()
        ]);
    }

    $body = json_decode(
        wp_remote_retrieve_body($response),
        true
    );

    if (empty($body['images'])) {
        return [];
    }

    $images = [];
    foreach ($body['images'] as $image_url) {
        $head = wp_remote_head($image_url, [
            'timeout'     => 5,
            'redirection' => 3,
        ]);

        if (is_wp_error($head)) {
            continue;
        }

        $code = wp_remote_retrieve_response_code($head);
        if ($code !== 200) {
            continue;
        }

        $images[] = ['url' => $image_url];
        if(count($images) >= 10)
            break; //We limit to 10 for a single search.
    }

    return $images;
}

/* 
    Validate a user-supplied image URL and return it in the same shape as ttr_find_product_images,
    so the front end can treat it identically to a single-result search.
*/
add_action('wp_ajax_ttr_preview_url_image', function () {
    ttr_ajax_security_check();
    $image_url = esc_url_raw(wp_unslash($_POST['image_url'] ?? ''));

    if (empty($image_url)) {
        wp_send_json_success([
            'status' => 'error',
            'images' => [],
            'message' => 'No URL provided.',
        ]);
        return;
    }

    // HEAD request to confirm the URL is reachable and is an image content-type
    $head = wp_remote_head($image_url, [
        'timeout'     => 10,
        'redirection' => 5,
    ]);

    if (is_wp_error($head)) {
        wp_send_json_success([
            'status' => 'error',
            'images' => [],
            'message' => 'Could not reach that URL: ' . $head->get_error_message(),
        ]);
        return;
    }

    $code         = wp_remote_retrieve_response_code($head);
    $content_type = wp_remote_retrieve_header($head, 'content-type');

    if ($code !== 200) {
        wp_send_json_success([
            'status' => 'error',
            'images' => [],
            'message' => 'URL returned HTTP ' . $code . '.',
        ]);
        return;
    }

    if (!str_contains($content_type, 'image/')) {
        wp_send_json_success([
            'status' => 'error',
            'images' => [],
            'message' => 'URL does not appear to point to an image (Content-Type: ' . esc_html($content_type) . ').',
        ]);
        return;
    }

    // Valid — return in the same envelope as ttr_find_product_images
    wp_send_json_success([
        'status' => 'success',
        'images' => [['url' => $image_url]],
        'message' => 'URL image ready for preview.',
    ]);
});

add_action('wp_ajax_ttr_apply_product_image', 'ttr_apply_product_image');
function ttr_apply_product_image()
{
    ttr_ajax_security_check();
    $product_id = intval($_POST['product_id']);
    $image_url = esc_url_raw($_POST['image_url']);
    if (!$product_id || !$image_url) {
        wp_send_json_error([
            'message' => 'You MUST provide both a product id and image url.'
        ]);
    }
    
    $attachment_id = ttr_download_image($image_url, $product_id);
    if (is_wp_error($attachment_id)) {
        wp_send_json_error(['message' => 
        'TTR WP_Error code: ' . $attachment_id->get_error_code() . 
        ' -- TTR WP_Error message: ' . $attachment_id->get_error_message() .
        ' -- TTR WP_Error data: ' . print_r($attachment_id->get_error_data(), true)
        ]);
        return false;
    }
    
    if ($attachment_id === false || $attachment_id === 0 || empty($attachment_id)) {
        wp_send_json_error(['message' => 'Image import failed. ID: ' . var_export($attachment_id, true)]);
    }

    $existing_thumb = get_post_thumbnail_id($product_id);

    if (!$existing_thumb) {
        // No thumbnail yet — set this as the featured image.
        set_post_thumbnail($product_id, $attachment_id);
        wp_send_json_success(['message' => 'Product image updated.']);
    } else {
        // Thumbnail already set — append to gallery without touching it.
        $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
        $gallery_ids = $gallery_raw ? array_filter(array_map('intval', explode(',', $gallery_raw))) : [];

        if (in_array((int) $attachment_id, $gallery_ids, true)) {
            wp_send_json_success(['message' => 'Image is already in the product gallery.']);
        }

        $gallery_ids[] = (int) $attachment_id;
        update_post_meta($product_id, '_product_image_gallery', implode(',', array_unique($gallery_ids)));
        wp_send_json_success(['message' => 'Image added to product gallery.']);
    }
}

function ttr_download_image($image_url, $product_id)
{
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    // Download to temp file first
    $tmp = download_url($image_url);
    if (is_wp_error($tmp)) {
        error_log('TTR download failed: ' . $tmp->get_error_message());
        return false;
    }

    // Check actual mime type from the downloaded file
    $mime = mime_content_type($tmp);
    $ext  = explode('/', $mime)[1]; // e.g. "jpeg"

    $file_array = [
        'name'     => 'product-image-' . $product_id . '.' . $ext,
        'tmp_name' => $tmp,
    ];

    $attachment_id = media_handle_sideload($file_array, $product_id);

    wp_delete_file($tmp); // clean up temp file

    if (is_wp_error($attachment_id)) {
        error_log('TTR sideload failed: ' . $attachment_id->get_error_message());
        return false;
    }

    return $attachment_id;
}

add_action('wp_ajax_ttr_save_product_batch_settings', function () {
    ttr_ajax_security_check();

    $settings                           = ttr_get_tools_settings();
    $settings['imageSizeDelimiter']     = sanitize_text_field($_POST['delimiter'] ?? '-');
    $settings['minimumImageDimensions'] = max(1, intval($_POST['minimum_size'] ?? 300));

    ttr_save_tools_settings($settings);
    wp_send_json_success($settings);
});

add_action('wp_ajax_ttr_save_ignored_products', function () {
    ttr_ajax_security_check();
    $file_path = ttr_batch_ignored_products_path();

    $raw = sanitize_textarea_field($_POST['product_ids'] ?? '');

    $ids = array_filter(array_map('intval', preg_split('/[,\s]+/', $raw)));

    file_put_contents($file_path, json_encode(array_values(array_unique($ids)), JSON_PRETTY_PRINT));

    wp_send_json_success($ids);
});


/* 
    Test that all products have proper categories, valid images/links, and are storing the correct permalink.
*/
add_action('wp_ajax_testaroo_batch', function () {
    ttr_ajax_security_check();

    $settings = ttr_product_batch_test_get_settings();
    $blacklisted_ids = ttr_blacklist_get_ids(ttr_testers_blacklist_path());

    $offset = intval($_POST['offset'] ?? 0);
    $limit  = intval($_POST['limit']  ?? 10);

    $products = get_posts([
        'post_type'      => 'product',
        'post_status'    => 'publish',
        'posts_per_page' => $limit,
        'offset'         => $offset,
        'fields'         => 'ids',
    ]);

    if (!empty($blacklisted_ids)) {
        $products = array_values(array_filter($products, function ($product_id) use ($blacklisted_ids) {
            return !in_array((int) $product_id, $blacklisted_ids, true);
        }));
    }

    $results = [];

    foreach ($products as $product_id) {

        $product      = wc_get_product($product_id);
        $product_name = $product ? $product->get_name() : 'Unknown Product';

        // Category check
        $terms               = get_the_terms($product_id, 'product_cat');
        $hasOnlyUncategorized = false;
        $hasNoCategory        = false;

        if (empty($terms) || is_wp_error($terms)) {
            $hasNoCategory = true;
        } else {
            $realCategories = array_filter($terms, fn($t) => strtolower($t->name) !== 'uncategorized');
            $hasOnlyUncategorized = empty($realCategories);
        }

        // Image validation
        $brokenImages      = [];
        $thumb_id          = get_post_thumbnail_id($product_id);
        $hasNoProductImage = !$thumb_id;
        $image_ids         = [];
        
        if ($thumb_id) {
            $image_ids[] = $thumb_id;
        }
        
        $gallery = get_post_meta($product_id, '_product_image_gallery', true);
        if (!empty($gallery)) {
            $image_ids = array_merge($image_ids, array_filter(array_map('intval', explode(',', $gallery))));
        }

        // Detect: thumbnail missing but gallery images exist
        $galleryIds = (!empty($gallery))
            ? array_filter(array_map('intval', explode(',', $gallery)))
            : [];
        $hasGalleryImageAvailable = $hasNoProductImage && !empty($galleryIds);
        $firstGalleryImageId      = $hasGalleryImageAvailable ? reset($galleryIds) : null;
        
        foreach ($image_ids as $img_id) {
            $file = get_attached_file($img_id);
            if (!$file || !file_exists($file)) {
                $url = wp_get_attachment_url($img_id);
                if ($url) {
                    $brokenImages[] = ['url' => $url];
                }
                // If $url is false, the attachment post row is gone entirely —
                // skip it silently rather than storing false as the URL.
            }
        }
        
        // Only check the first image a user would see — featured image, or first gallery image if none
        $first_visible_image_id = $thumb_id ?: (explode(',', $gallery)[0] ?? null);
        
        $tooSmallImages = [];
        if ($first_visible_image_id) {
            $img_id = $first_visible_image_id;
            $file   = get_attached_file($img_id);
            if (!$file || !file_exists($file)) continue;
        
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        
            // SVGs are vector — never too small, skip entirely
            if ($ext === 'svg') 
                continue;
            
            //Unsupported file ext.
            if ($ext !== 'jpg' && $ext !== 'png' && $ext !== 'gif' && $ext !== 'webp' && $ext !== 'bmp') 
                continue;
        
            $size = getimagesize($file);
            if (!$size) 
                continue;
            
            if (max($size[0], $size[1]) < intval($settings['minimumImageDimensions'])) {
            
                // Skip high-DPI images — a small pixel count can be intentional
                // if the image was authored at 2x/retina resolution (≥144 DPI).
                // getimagesize() returns DPI info in index 0 of the 'channels' area;
                // use exif_read_data() for reliable DPI on jpg, and imagecreate inspection
                // for png. We check both width == height (square) as an additional signal.
                $skipDueToHighDpi = false;

                if ($ext === 'jpg' || $ext === 'jpeg') {
                    if (function_exists('exif_read_data')) {
                        $exif = @exif_read_data($file);
                        $xDpi = $exif['XResolution'] ?? null;
                        $yDpi = $exif['YResolution'] ?? null;
                        // EXIF resolution is often stored as a fraction string e.g. "144/1"
                        $parseDpi = function($val) {
                            if (!$val) return 0;
                            if (str_contains((string)$val, '/')) {
                                [$n, $d] = explode('/', $val);
                                return $d ? (float)$n / (float)$d : 0;
                            }
                            return (float)$val;
                        };
                        if ($parseDpi($xDpi) >= 144 && $parseDpi($yDpi) >= 144) {
                            $skipDueToHighDpi = true;
                        }
                    }
                } elseif ($ext === 'png') {
                    // PNG stores resolution in pHYs chunk — imageresolution() reads it (PHP 8.0+)
                    if (function_exists('imageresolution')) {
                        $img = @imagecreatefrompng($file);
                        if ($img) {
                            $res = imageresolution($img);
                            imagedestroy($img);
                            // imageresolution() returns [x_dpi, y_dpi]
                            if (is_array($res) && $res[0] >= 144 && $res[1] >= 144) {
                                $skipDueToHighDpi = true;
                            }
                        }
                    }
                }
            
                if ($skipDueToHighDpi) 
                    continue;
        
                // Check if a padded variant already exists in the gallery or as featured image.
                // Use attachment metadata (same logic as the pad handler) rather than glob(),
                // because the padded file may live in a different upload month/year folder.
                $all_ids_for_product   = array_merge($image_ids, [(int) get_post_thumbnail_id($product_id)]);
                $paddedExists          = false;
                foreach ($all_ids_for_product as $check_id) {
                    if (!$check_id) continue;
                    $check_file = get_attached_file((int) $check_id);
                    if ($check_file && strpos($check_file, '_ttr_padded_') !== false) {
                        $paddedExists = true;
                        break;
                    }
                }
                if ($paddedExists) 
                    continue;
        
                $tooSmallImages[] = [
                    'url'           => wp_get_attachment_url($img_id),
                    'attachment_id' => (int) $img_id,
                    'width'         => $size[0],
                    'height'        => $size[1],
                ];
            }
        }
    
        // Collect all product attributes for the image search modal
        $product_attributes = [];
        if ($product) {
            foreach ($product->get_attributes() as $attribute) {
                $attr_name = $attribute->get_name();
                if ($attribute->is_taxonomy()) {
                    $label  = wc_attribute_label($attr_name);
                    $terms  = wc_get_product_terms($product_id, $attr_name, ['fields' => 'names']);
                    $values = is_array($terms) ? array_values(array_filter($terms, 'strlen')) : [];
                } else {
                    // Custom attributes: label is the raw name, options may be
                    // an array of strings or a single pipe-delimited string
                    $label = $attr_name;
                    $raw   = $attribute->get_options();
                    if (is_array($raw)) {
                        $values = [];
                        foreach ($raw as $opt) {
                            foreach (explode('|', $opt) as $part) {
                                $part = trim($part);
                                if ($part !== '') $values[] = $part;
                            }
                        }
                    } elseif (is_string($raw) && $raw !== '') {
                        $values = array_values(array_filter(array_map('trim', explode('|', $raw)), 'strlen'));
                    } else {
                        $values = [];
                    }
                }
                // Include even if values are empty so the label is still visible
                $product_attributes[] = [
                    'label'  => $label,
                    'values' => $values,
                ];
            }
        }

        $results[] = [
            'product_id'             => $product_id,
            'product_name'           => $product_name,
            'has_no_category'        => $hasNoCategory,
            'has_only_uncategorized' => $hasOnlyUncategorized,
            'has_no_product_image'      => $hasNoProductImage,
            'has_gallery_image_available' => $hasGalleryImageAvailable,
            'first_gallery_image_id'      => $firstGalleryImageId,
            'too_small_images'       => $tooSmallImages,
            'url_broken_images'      => $brokenImages,
            'url_product_shop'       => get_permalink($product_id),
            'product_attributes'     => $product_attributes,
        ];
    }

    $total = wp_count_posts('product')->publish;
    set_transient('testaroo_product_processed_count', $offset + count($products));

    wp_send_json([
        'batch_size' => count($products),
        'offset'     => $offset,
        'total'      => $total,
        'results'    => $results,
    ], 200, JSON_INVALID_UTF8_SUBSTITUTE);
});


add_action('wp_ajax_testaroo_ignore_product', function () {
    ttr_ajax_security_check();
    $product_id = intval($_POST['product_id'] ?? 0);

    if (!$product_id) {
        wp_send_json(['status' => 'error', 'message' => 'Invalid product ID']);
        return;
    }

    $file_path = ttr_batch_ignored_products_path();
    $ignored = ttr_product_batch_test_get_ignored_products();

    if (!in_array($product_id, $ignored, true)) {
        $ignored[] = $product_id;
    }

    file_put_contents($file_path, json_encode(array_values($ignored), JSON_PRETTY_PRINT));

    wp_send_json(['status' => 'success']);
});

/*
    Attempts a fix on a broken image.
    This cannot solve a completely missing image.
    It searches the DB for incorrectly-located images containing the partial image name, sans content cut off by provided character (which is meant to indicate the beginning of some image size indicated in the name).
*/
add_action('wp_ajax_testaroo_try_fix_image', function () {
    ttr_ajax_security_check();
    $product_id = intval($_POST['product_id'] ?? 0);
    $image_url  = $_POST['image_url'] ?? '';

    if (!$product_id || !$image_url) {
        wp_send_json(['status' => 'error', 'message' => 'Invalid input']);
        return;
    }

    
    $settings = ttr_product_batch_test_get_settings();
    $size_delimiter = $settings['imageSizeDelimiter'] ?? '-';

    
    $filename    = basename(wp_parse_url($image_url, PHP_URL_PATH));
    $base        = preg_replace('/' . preg_quote($size_delimiter, '/') . '\d+x\d+(?=\.[^.]+$)/', '', $filename);
    $full_name   = pathinfo($base, PATHINFO_FILENAME);
    $name_no_ext = $full_name ?: pathinfo($filename, PATHINFO_FILENAME);
    
    $uploads_dir = wp_upload_dir();
    $base_path   = $uploads_dir['basedir'];
    $found_file  = null;

    $year_dirs = array_filter(scandir($base_path), function ($entry) use ($base_path) {
        return is_dir($base_path . '/' . $entry) && preg_match('/^\d{4}$/', $entry);
    });

    foreach ($year_dirs as $year) {
        $year_path  = $base_path . '/' . $year;
        $month_dirs = array_filter(scandir($year_path), function ($entry) use ($year_path) {
            return is_dir($year_path . '/' . $entry) && preg_match('/^\d{2}$/', $entry);
        });

        foreach ($month_dirs as $month) {
            $month_path = $year_path . '/' . $month;
            foreach (scandir($month_path) as $fname) {
                if (in_array($fname, ['.', '..'])) continue;

                // Skip thumbnail-sized variants and any .bak files
                if (preg_match('/-\d+x\d+\./', $fname)) continue;
                if (str_contains($fname, '.bak')) continue;

                $fname_no_ext = pathinfo($fname, PATHINFO_FILENAME);
                if (preg_match('/^' . preg_quote($name_no_ext, '/') . '(-|$)/i', $fname_no_ext)) {
                    $found_file = $month_path . '/' . $fname;
                    break 3;
                }
            }
        }
    }

    if (!$found_file) {
        $errorMsg = "File not found on disk";
        if(isset($name_no_ext) && !empty($name_no_ext) && $name_no_ext != "undefined")
            $errorMsg = $errorMsg . ': ' . $name_no_ext;
        wp_send_json(['status' => 'error', 'message' => $errorMsg]);
        return;
    }

    $relative_path = str_replace($base_path . '/', '', $found_file);

    // Resolve attachment ID reliably — check meta first, then guid as fallback
    global $wpdb;
    $attachment_id = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT post_id FROM {$wpdb->postmeta}
         WHERE meta_key = '_wp_attached_file' AND meta_value = %s
         LIMIT 1",
        $relative_path
    ));

    if (!$attachment_id) {
        $file_url      = $uploads_dir['baseurl'] . '/' . $relative_path;
        $attachment_id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE guid = %s AND post_type = 'attachment'
             LIMIT 1",
            $file_url
        ));
    }

    // Check for duplicates before creating anything
    $gallery     = get_post_meta($product_id, '_product_image_gallery', true);
    $gallery_ids = $gallery ? array_map('intval', explode(',', $gallery)) : [];
    $thumb_id    = (int) get_post_thumbnail_id($product_id);

    if ($attachment_id && ($thumb_id === $attachment_id || in_array($attachment_id, $gallery_ids))) {
        wp_send_json([
            'status'        => 'skipped',
            'message'       => 'Image already re-attached to product',
            'attachment_id' => $attachment_id,
            'file'          => $found_file,
        ]);
        return;
    }

    // Create attachment only if it doesn't exist at all
    if (!$attachment_id || !file_exists(get_attached_file($attachment_id))) {
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $filetype   = wp_check_filetype($found_file);
        $attachment = [
            'post_mime_type' => $filetype['type'],
            'post_title'     => sanitize_file_name(pathinfo($found_file, PATHINFO_FILENAME)),
            'post_content'   => '',
            'post_status'    => 'inherit',
        ];

        $attachment_id = wp_insert_attachment($attachment, $found_file, $product_id);
        if (is_wp_error($attachment_id)) {
            wp_send_json(['status' => 'error', 'message' => 'Failed to create attachment: ' . $attachment_id->get_error_message()]);
            return;
        }

        $metadata = wp_generate_attachment_metadata($attachment_id, $found_file);
        wp_update_attachment_metadata($attachment_id, $metadata);
    }

    // Clean up broken featured image if present
    $old_thumb_id = get_post_thumbnail_id($product_id);
    if ($old_thumb_id && $old_thumb_id != $attachment_id) {
        $old_file = get_attached_file($old_thumb_id);
        if (!$old_file || !file_exists($old_file)) {
            delete_post_thumbnail($product_id);
            wp_delete_attachment($old_thumb_id, true);
        }
    }

    set_post_thumbnail($product_id, $attachment_id);

    $gallery_ids = array_unique(array_merge($gallery_ids, [$attachment_id]));
    update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));

    wc_delete_product_transients($product_id);
    clean_post_cache($product_id);

    wp_send_json([
        'status'        => 'success',
        'message'       => 'Fixed image for product ',
        'attachment_id' => $attachment_id,
        'file'          => $found_file,
    ]);
});

/*
    Removes a broken image reference from a product's featured image and/or gallery.
    Called when a fix attempt returns "File not found on disk" and the user wants
    to clean up the dangling reference rather than leave it broken.
    Accepts either an image_url (matched by filename) or a direct attachment_id.
*/
add_action('wp_ajax_ttr_remove_broken_image_reference', function () {
    ttr_ajax_security_check();
    $product_id    = intval($_POST['product_id']    ?? 0);
    $image_url     = esc_url_raw($_POST['image_url'] ?? '');
    $attachment_id = intval($_POST['attachment_id'] ?? 0);

    if (!$product_id || (!$image_url && !$attachment_id)) {
        wp_send_json(['status' => 'error', 'message' => 'Invalid input']);
        return;
    }

    // Resolve attachment_id from URL if not passed directly
    if (!$attachment_id && $image_url) {
        global $wpdb;
        $filename      = basename(wp_parse_url($image_url, PHP_URL_PATH));
        $attachment_id = (int) $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta}
             WHERE meta_key = '_wp_attached_file'
             AND meta_value LIKE %s
             LIMIT 1",
            '%' . $wpdb->esc_like($filename)
        ));
    }

    $removed     = false;
    $thumb_id    = (int) get_post_thumbnail_id($product_id);
    $gallery_raw = get_post_meta($product_id, '_product_image_gallery', true);
    $gallery_ids = $gallery_raw ? array_map('intval', explode(',', $gallery_raw)) : [];

    // Remove from featured image if it matches
    if ($attachment_id && $thumb_id === $attachment_id) {
        delete_post_thumbnail($product_id);
        $removed = true;
    } elseif (!$attachment_id && $thumb_id) {
        // No attachment ID resolved — check if the thumbnail file is actually missing
        $thumb_file = get_attached_file($thumb_id);
        if (!$thumb_file || !file_exists($thumb_file)) {
            delete_post_thumbnail($product_id);
            $removed = true;
        }
    }

    // Remove from gallery
    $new_gallery = array_values(array_filter(
        $gallery_ids,
        function ($id) use ($attachment_id) {
            if ($attachment_id) return $id !== $attachment_id;
            // No attachment ID — remove any gallery entry whose file is missing
            $file = get_attached_file($id);
            return $file && file_exists($file);
        }
    ));

    if (count($new_gallery) !== count($gallery_ids)) {
        update_post_meta($product_id, '_product_image_gallery', implode(',', $new_gallery));
        $removed = true;
    }

    wc_delete_product_transients($product_id);
    clean_post_cache($product_id);

    wp_send_json([
        'status'  => $removed ? 'success' : 'skipped',
        'message' => $removed
            ? 'Broken reference removed from product.'
            : 'No broken reference found on this product (may already be clean).',
    ]);
});
/*    
    Creates a dynamically-sized white canvas with the original image placed at its
    NATIVE resolution, centered. No scaling — just whitespace around it.
    The original image stays as the featured image (for catalog/shop pages).
    The padded version is added to the gallery and shown on the single product page
    via the woocommerce_product_get_image_id filter in the main plugin file.
*/
add_action('wp_ajax_testaroo_upscale_image', function () {
    ttr_ajax_security_check();
    $product_id    = intval($_POST['product_id']    ?? 0);
    $attachment_id = intval($_POST['attachment_id'] ?? 0);
 
    if (!$product_id || !$attachment_id) {
        wp_send_json(['status' => 'error', 'message' => 'Invalid input']);
        return;
    }
 
    $file = get_attached_file($attachment_id);
    if (!$file || !file_exists($file)) {
        wp_send_json(['status' => 'error', 'message' => 'Source file not found on disk']);
        return;
    }
 
    // SVGs are vector — GD cannot load them and they never need padding
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    if ($ext === 'svg') {
        wp_send_json(['status' => 'error', 'message' => 'SVG images are vector format and do not need padding']);
        return;
    }
 
    $size = getimagesize($file);
    if (!$size) {
        wp_send_json(['status' => 'error', 'message' => 'Could not read image dimensions']);
        return;
    }
 
    $orig_w = $size[0];
    $orig_h = $size[1];
    $type   = $size[2]; // IMAGETYPE_* constant
 
    $settings = ttr_product_batch_test_get_settings();

    // Dynamically determine canvas size based on original image dimensions
    // Rule: pad to ~2.75x the largest dimension, but never hit 800 (WooCommerce crop trigger)
    // Minimum $settings['minimumImageDimensions'], maximum 1200
    $largest_dim = max($orig_w, $orig_h);
    $target_size = $largest_dim * 2.75;
    $target_size = max($settings['minimumImageDimensions'], min(1200, $target_size));
 
    // Never land on 800 — WooCommerce trims whitespace at exactly this size
    // Nudge up to 900 if we land in the 750-850 danger zone
    if ($target_size >= 750 && $target_size <= 850) {
        $target_size = 900;
    }
 
    $target_size = (int) $target_size;
 
    // If image is already larger than the canvas on both dimensions, nothing to do
    if ($orig_w >= $target_size && $orig_h >= $target_size) {
        wp_send_json(['status' => 'error', 'message' => "Image is already {$orig_w}x{$orig_h} — no padding needed"]);
        return;
    }
 
    // Check if a padded version already exists in the gallery or as featured image
    // Do this BEFORE any file operations
    $existing_gallery = get_post_meta($product_id, '_product_image_gallery', true);
    $existing_ids     = $existing_gallery ? array_map('intval', explode(',', $existing_gallery)) : [];
    $existing_ids[]   = (int) get_post_thumbnail_id($product_id);
 
    foreach ($existing_ids as $existing_id) {
        if (!$existing_id) continue;
        $existing_file = get_attached_file($existing_id);
        if ($existing_file && strpos($existing_file, '_ttr_padded_') !== false) {
            wp_send_json([
                'status'  => 'skipped',
                'message' => 'A padded version already exists for this product. Revert it first before running again.',
                'url'     => wp_get_attachment_url($existing_id),
            ]);
            return;
        }
    }
 
    // Load source image — supports jpg/jpeg, png, gif, webp, bmp, avif
    if ($type === IMAGETYPE_JPEG) {
        $source = imagecreatefromjpeg($file);
    } elseif ($type === IMAGETYPE_PNG) {
        $source = imagecreatefrompng($file);
    } elseif ($type === IMAGETYPE_GIF) {
        $source = imagecreatefromgif($file); // animated GIFs lose animation, only first frame used
    } elseif ($type === IMAGETYPE_WEBP) {
        $source = imagecreatefromwebp($file);
    } elseif ($type === IMAGETYPE_BMP) {
        $source = imagecreatefrombmp($file);
    } else {
        wp_send_json(['status' => 'error', 'message' => 'Unsupported image type — supported formats: jpg, png, gif, webp, bmp']);
        return;
    }
 
    if (!$source) {
        wp_send_json(['status' => 'error', 'message' => 'GD library failed to load the image']);
        return;
    }
 
    // Create square canvas at target size
    $canvas = imagecreatetruecolor($target_size, $target_size);
    if (!$canvas) {
        imagedestroy($source);
        wp_send_json(['status' => 'error', 'message' => 'GD failed to create output canvas']);
        return;
    }
 
    // Fill canvas — transparent for PNG/GIF/WEBP, white for JPG/BMP
    if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_GIF || $type === IMAGETYPE_WEBP) {
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 255, 255, 255, 0);
        imagefill($canvas, 0, 0, $transparent);
        imagealphablending($canvas, true);
    } else {
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
    }
 
    // No scaling — place image at native resolution, centered on canvas
    // All remaining space becomes whitespace
    $dest_x = (int) round(($target_size - $orig_w) / 2);
    $dest_y = (int) round(($target_size - $orig_h) / 2);
 
    imagecopyresampled($canvas, $source, $dest_x, $dest_y, 0, 0, $orig_w, $orig_h, $orig_w, $orig_h);
    imagedestroy($source);
 
    // Always save output as PNG
    $pathinfo     = pathinfo($file);
    $new_filename = $pathinfo['filename'] . '_ttr_padded_' . $target_size . 'x' . $target_size . '.png';
    $new_filepath = $pathinfo['dirname'] . '/' . $new_filename;
 
    $saved = imagepng($canvas, $new_filepath);
    imagedestroy($canvas);
 
    if (!$saved) {
        wp_send_json(['status' => 'error', 'message' => 'Failed to write padded image to disk']);
        return;
    }
 
    // Register the new file as a WordPress media attachment
    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
 
    $filetype   = wp_check_filetype($new_filepath);
    $attachment = [
        'post_mime_type' => $filetype['type'],
        'post_title'     => sanitize_file_name($pathinfo['filename']) . ' (padded)',
        'post_content'   => '',
        'post_status'    => 'inherit',
    ];
 
    $new_attachment_id = wp_insert_attachment($attachment, $new_filepath, $product_id);
    if (is_wp_error($new_attachment_id)) {
        wp_send_json(['status' => 'error', 'message' => 'Failed to register attachment: ' . $new_attachment_id->get_error_message()]);
        return;
    }
 
    // Generate all WordPress/WooCommerce thumbnail sizes from the new full-size image
    $metadata = wp_generate_attachment_metadata($new_attachment_id, $new_filepath);
    wp_update_attachment_metadata($new_attachment_id, $metadata);
 
    // Add padded image to gallery — do NOT replace featured image
    // The original stays as featured image for catalog/shop page thumbnails
    // The woocommerce_product_get_image_id filter in the main plugin swaps to
    // the padded version on single product pages only
    $gallery     = get_post_meta($product_id, '_product_image_gallery', true);
    $gallery_ids = $gallery ? array_map('intval', explode(',', $gallery)) : [];
    if (!in_array($new_attachment_id, $gallery_ids)) {
        $gallery_ids[] = $new_attachment_id;
    }
    update_post_meta($product_id, '_product_image_gallery', implode(',', $gallery_ids));
 
    // Clear all WooCommerce and WordPress caches for this product
    wc_delete_product_transients($product_id);
    clean_post_cache($product_id);
    clean_attachment_cache($new_attachment_id);
 
    wp_send_json([
        'status'        => 'success',
        'message'       => "Padded: original {$orig_w}x{$orig_h} centered on {$target_size}x{$target_size} canvas",
        'attachment_id' => $new_attachment_id,
        'url'           => wp_get_attachment_url($new_attachment_id),
        'edit_url'      => admin_url("post.php?post={$product_id}&action=edit"),
    ]);
});

// ── Upload edited image (base64 PNG) and set as product thumbnail ──
add_action('wp_ajax_ttr_upload_edited_image', function() {
    ttr_ajax_security_check();
    $product_id = (int) ($_POST['product_id'] ?? 0);
    $image_data = $_POST['image_data'] ?? '';

    if (!$product_id || empty($image_data)) {
        wp_send_json_error(['message' => 'Missing product ID or image data.']);
        return;
    }

    // Decode base64 PNG
    $decoded = base64_decode($image_data);
    if (!$decoded) {
        wp_send_json_error(['message' => 'Invalid image data.']);
        return;
    }

    // Write to a temp file
    $upload_dir = wp_upload_dir();
    $filename   = 'ttr-edited-' . $product_id . '-' . time() . '.png';
    $temp_path  = $upload_dir['path'] . '/' . $filename;

    if (file_put_contents($temp_path, $decoded) === false) {
        wp_send_json_error(['message' => 'Could not write temp file.']);
        return;
    }

    // Sideload into WP media library
    $file_array = [
        'name'     => $filename,
        'tmp_name' => $temp_path,
    ];

    require_once ABSPATH . 'wp-admin/includes/image.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';

    $attachment_id = media_handle_sideload($file_array, $product_id);

    // Clean up temp file if it still exists
    if (file_exists($temp_path)) 
		wp_delete_file($temp_path);

    if (is_wp_error($attachment_id)) {
        wp_send_json_error(['message' => $attachment_id->get_error_message()]);
        return;
    }

    // Set as product thumbnail
    set_post_thumbnail($product_id, $attachment_id);

    wp_send_json_success([
        'attachment_id' => $attachment_id,
        'url'           => wp_get_attachment_url($attachment_id),
    ]);
});

// ── Proxy an external image through WP for canvas editing (no CORS issues) ───
add_action('wp_ajax_ttr_proxy_image_for_editor', function() {
    ttr_ajax_security_check();
    $image_url = esc_url_raw(wp_unslash($_POST['image_url'] ?? ''));
    if (empty($image_url)) {
        wp_send_json_error(['message' => 'No URL provided.']);
        return;
    }

    $response = wp_remote_get($image_url, [
        'timeout'   => 15,
        'sslverify' => false,
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error(['message' => 'Could not fetch image: ' . $response->get_error_message()]);
        return;
    }

    $code = wp_remote_retrieve_response_code($response);
    if ($code !== 200) {
        wp_send_json_error(['message' => 'Image server returned HTTP ' . $code]);
        return;
    }

    $body         = wp_remote_retrieve_body($response);
    $content_type = wp_remote_retrieve_header($response, 'content-type');

    // Strip any charset suffix (e.g. "image/jpeg; charset=...")
    $mime = strtok($content_type, ';');
    if (strpos($mime, 'image/') !== 0) {
        wp_send_json_error(['message' => 'URL does not point to an image (type: ' . esc_html($content_type) . ')']);
        return;
    }

    wp_send_json_success([
        'data_url' => 'data:' . $mime . ';base64,' . base64_encode($body),
    ]);
});

// ── Promote first gallery image to product thumbnail ──────────────────────────
add_action('wp_ajax_ttr_promote_gallery_image', function() {
    ttr_ajax_security_check();
    $product_id    = (int) ($_POST['product_id']    ?? 0);
    $attachment_id = (int) ($_POST['attachment_id'] ?? 0);

    if (!$product_id || !$attachment_id) {
        wp_send_json_error(['message' => 'Missing product or attachment ID.']);
        return;
    }

    // Verify the attachment actually belongs to this product's gallery
    $gallery     = get_post_meta($product_id, '_product_image_gallery', true);
    $gallery_ids = $gallery ? array_map('intval', explode(',', $gallery)) : [];

    if (!in_array($attachment_id, $gallery_ids, true)) {
        wp_send_json_error(['message' => 'Attachment is not in this product\'s gallery.']);
        return;
    }

    set_post_thumbnail($product_id, $attachment_id);
    $thumb_url = wp_get_attachment_image_url($attachment_id, 'thumbnail');

    wp_send_json_success([
        'message'   => 'Gallery image promoted to product thumbnail.',
        'thumb_url' => $thumb_url,
    ]);
});

add_action('wp_ajax_testaroo_get_results', function () {
    ttr_ajax_security_check();
    $file_path   = ttr_batch_results_path();
    $jsonResults = [];
    if (file_exists($file_path)) {
        $lines       = file($file_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $jsonResults = array_map(function($line) { return json_decode($line, true); }, $lines);
        $jsonResults = array_values(array_filter($jsonResults));
    }
    wp_send_json_success(['results' => $jsonResults]);
});