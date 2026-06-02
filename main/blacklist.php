<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * TTR Blacklist Library
 * Shared functions for reading/writing the testers, fixers, and images blacklists.
 * All three lists are stored in wp-content/uploads/testaroo/ (see main/storage.php).
 */

// ── Path helpers are defined in main/storage.php ─────────────────────────────
// ttr_testers_blacklist_path(), ttr_fixers_blacklist_path(), ttr_images_blacklist_path()

// ── Generic read/write ── 

function ttr_read_blacklist(string $path): array {
    if (!file_exists($path)) return [];
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

function ttr_write_blacklist(string $path, array $list): bool {
    return file_put_contents($path, json_encode(array_values($list), JSON_PRETTY_PRINT)) !== false;
}

// ── Product blacklist helpers ── 

function ttr_blacklist_get_ids(string $path): array {
    return array_column(ttr_read_blacklist($path), 'product_id');
}

function ttr_is_product_blacklisted(string $path, int $product_id): bool {
    return in_array($product_id, ttr_blacklist_get_ids($path), true);
}

function ttr_blacklist_add_product(string $path, int $product_id, string $reason = ''): bool {
    $list = ttr_read_blacklist($path);

    // Avoid duplicates — update reason if already present
    foreach ($list as &$entry) {
        if ((int) $entry['product_id'] === $product_id) {
            $entry['reason'] = $reason;
            return ttr_write_blacklist($path, $list);
        }
    }
    unset($entry);

    $product        = function_exists('wc_get_product') ? wc_get_product($product_id) : null;
    $product_name   = $product ? $product->get_name() : 'Unknown Product';
    $thumbnail_id   = $product ? $product->get_image_id() : 0;
    $thumbnail_url  = $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'thumbnail') : '';

    $list[] = [
        'product_id'    => $product_id,
        'product_name'  => $product_name,
        'thumbnail_url' => $thumbnail_url ?: '',
        'reason'        => $reason,
    ];

    return ttr_write_blacklist($path, $list);
}

function ttr_blacklist_remove_product(string $path, int $product_id): bool {
    $list = ttr_read_blacklist($path);
    $list = array_filter($list, function($e) use ($product_id) { return (int) $e['product_id'] !== $product_id; });
    return ttr_write_blacklist($path, $list);
}

// ── Images blacklist helpers ── 

function ttr_images_blacklist_get_ids(): array {
    return array_column(
        array_filter(ttr_read_blacklist(ttr_images_blacklist_path()), fn($e) => empty($e['type'])),
        'attachment_id'
    );
}

function ttr_images_blacklist_get_patterns(): array {
    return array_column(
        array_filter(ttr_read_blacklist(ttr_images_blacklist_path()), fn($e) => ($e['type'] ?? '') === 'pattern'),
        null
    );
}

function ttr_is_image_blacklisted(int $attachment_id): bool {
    if (in_array($attachment_id, ttr_images_blacklist_get_ids(), true)) return true;

    $patterns = ttr_images_blacklist_get_patterns();
    if (empty($patterns)) return false;

    $url  = wp_get_attachment_url($attachment_id) ?: '';
    $file = get_attached_file($attachment_id) ?: '';
    $name = basename($file ?: $url);

    foreach ($patterns as $entry) {
        $pattern = $entry['pattern'] ?? '';
        if ($pattern === '') continue;
        if (stripos($url, $pattern) !== false || stripos($name, $pattern) !== false) {
            return true;
        }
    }
    return false;
}

function ttr_is_url_pattern_blacklisted(string $url): bool {
    $patterns = ttr_images_blacklist_get_patterns();
    if (empty($patterns)) return false;
    $name = basename($url);
    foreach ($patterns as $entry) {
        $pattern = $entry['pattern'] ?? '';
        if ($pattern === '' ) continue;
        if (stripos($url, $pattern) !== false || stripos($name, $pattern) !== false) {
            return true;
        }
    }
    return false;
}

function ttr_images_blacklist_add(int $attachment_id, string $reason = ''): bool {
    $path = ttr_images_blacklist_path();
    $list = ttr_read_blacklist($path);

    foreach ($list as &$entry) {
        if (empty($entry['type']) && (int) $entry['attachment_id'] === $attachment_id) {
            $entry['reason'] = $reason;
            return ttr_write_blacklist($path, $list);
        }
    }
    unset($entry);

    $list[] = [
        'attachment_id' => $attachment_id,
        'url'           => wp_get_attachment_url($attachment_id) ?: '',
        'reason'        => $reason,
    ];

    return ttr_write_blacklist($path, $list);
}

function ttr_images_blacklist_add_pattern(string $pattern, string $reason = ''): bool {
    $path = ttr_images_blacklist_path();
    $list = ttr_read_blacklist($path);

    foreach ($list as &$entry) {
        if (($entry['type'] ?? '') === 'pattern' && $entry['pattern'] === $pattern) {
            $entry['reason'] = $reason;
            return ttr_write_blacklist($path, $list);
        }
    }
    unset($entry);

    $list[] = [
        'type'    => 'pattern',
        'pattern' => $pattern,
        'reason'  => $reason,
    ];

    return ttr_write_blacklist($path, $list);
}

function ttr_images_blacklist_remove_pattern(string $pattern): bool {
    $path = ttr_images_blacklist_path();
    $list = ttr_read_blacklist($path);
    $list = array_filter($list, function($e) use ($pattern) {
        return !(($e['type'] ?? '') === 'pattern' && $e['pattern'] === $pattern);
    });
    return ttr_write_blacklist($path, $list);
}

function ttr_images_blacklist_remove(int $attachment_id): bool {
    $path = ttr_images_blacklist_path();
    $list = ttr_read_blacklist($path);
    $list = array_filter($list, function($e) use ($attachment_id) {
        return !empty($e['type']) || (int) $e['attachment_id'] !== $attachment_id;
    });
    return ttr_write_blacklist($path, $list);
}

add_action('wp_ajax_ttr_blacklist_get_product_info', function() {
    ttr_ajax_security_check();
    $product_id = (int) ($_POST['product_id'] ?? 0);
    if (!$product_id) { wp_send_json_error(['message' => 'No product ID provided.']); return; }

    if (!function_exists('wc_get_product')) { wp_send_json_error(['message' => 'WooCommerce not available.']); return; }
    $product = wc_get_product($product_id);
    if (!$product) { wp_send_json_error(['message' => 'Product not found.']); return; }

    $thumbnail_id  = $product->get_image_id();
    $thumbnail_url = $thumbnail_id ? wp_get_attachment_image_url($thumbnail_id, 'thumbnail') : '';

    wp_send_json_success([
        'product_id'    => $product_id,
        'product_name'  => $product->get_name(),
        'thumbnail_url' => $thumbnail_url ?: '',
        'edit_url'      => admin_url("post.php?post={$product_id}&action=edit"),
    ]);
});

// ── AJAX: add product to a blacklist ──

add_action('wp_ajax_ttr_blacklist_add_product', function() {
    ttr_ajax_security_check();
    $list_type  = sanitize_key(wp_unslash($_POST['list_type']) ?? '');
    $product_id = (int) (wp_unslash($_POST['product_id']) ?? 0);
    $reason     = sanitize_text_field(wp_unslash($_POST['reason']) ?? '');

    if (!$product_id) { wp_send_json_error(['message' => 'No product ID.']); return; }

    $path = $list_type === 'fixers' ? ttr_fixers_blacklist_path() : ttr_testers_blacklist_path();
    $ok   = ttr_blacklist_add_product($path, $product_id, $reason);
    $ok ? wp_send_json_success() : wp_send_json_error(['message' => 'Could not write blacklist file.']);
});

// ── AJAX: remove product from a blacklist ──

add_action('wp_ajax_ttr_blacklist_remove_product', function() {
    ttr_ajax_security_check();
    $list_type  = sanitize_key(wp_unslash($_POST['list_type']) ?? '');
    $product_id = (int) (wp_unslash($_POST['product_id']) ?? 0);

    if (!$product_id) { wp_send_json_error(['message' => 'No product ID.']); return; }

    $path = $list_type === 'fixers' ? ttr_fixers_blacklist_path() : ttr_testers_blacklist_path();
    $ok   = ttr_blacklist_remove_product($path, $product_id);
    $ok ? wp_send_json_success() : wp_send_json_error(['message' => 'Could not write blacklist file.']);
});

// ── AJAX: get both blacklists (for main page UI ──

add_action('wp_ajax_ttr_blacklist_get_all', function() {
    ttr_ajax_security_check();
    wp_send_json_success([
        'testers' => ttr_read_blacklist(ttr_testers_blacklist_path()),
        'fixers'  => ttr_read_blacklist(ttr_fixers_blacklist_path()),
        'images'  => ttr_read_blacklist(ttr_images_blacklist_path()),
    ]);
});

// ── AJAX: add image to images blacklist ──

add_action('wp_ajax_ttr_images_blacklist_add', function() {
    ttr_ajax_security_check();
    $attachment_id = (int) (wp_unslash($_POST['attachment_id']) ?? 0);
    $reason        = sanitize_text_field(wp_unslash($_POST['reason']) ?? '');
    if (!$attachment_id) { wp_send_json_error(['message' => 'No attachment ID.']); return; }
    $ok = ttr_images_blacklist_add($attachment_id, $reason);
    $ok ? wp_send_json_success() : wp_send_json_error(['message' => 'Could not write images blacklist.']);
});

// ── AJAX: remove image from images blacklist ──

add_action('wp_ajax_ttr_images_blacklist_remove', function() {
    ttr_ajax_security_check();
    $attachment_id = (int) (wp_unslash($_POST['attachment_id']) ?? 0);
    if (!$attachment_id) { wp_send_json_error(['message' => 'No attachment ID.']); return; }
    $ok = ttr_images_blacklist_remove($attachment_id);
    $ok ? wp_send_json_success() : wp_send_json_error(['message' => 'Could not write images blacklist.']);
});

// ── AJAX: add partial image name pattern to images blacklist ──

add_action('wp_ajax_ttr_images_blacklist_add_pattern', function() {
    ttr_ajax_security_check();
    $pattern = sanitize_text_field(wp_unslash($_POST['pattern']) ?? '');
    $reason  = sanitize_text_field(wp_unslash($_POST['reason']) ?? '');
    if (empty($pattern)) { wp_send_json_error(['message' => 'No pattern provided.']); return; }
    $ok = ttr_images_blacklist_add_pattern($pattern, $reason);
    $ok ? wp_send_json_success(['pattern' => $pattern]) : wp_send_json_error(['message' => 'Could not write images blacklist.']);
});

// ── AJAX: remove partial image name pattern from images blacklist ──

add_action('wp_ajax_ttr_images_blacklist_remove_pattern', function() {
    ttr_ajax_security_check();
    $pattern = sanitize_text_field(wp_unslash($_POST['pattern'] ?? ''));
    if (empty($pattern)) { wp_send_json_error(['message' => 'No pattern provided.']); return; }
    $ok = ttr_images_blacklist_remove_pattern($pattern);
    $ok ? wp_send_json_success() : wp_send_json_error(['message' => 'Could not write images blacklist.']);
});

// ── WooCommerce product page meta box ──

add_action('add_meta_boxes', function() {
    add_meta_box(
        'ttr_product_options',
        'Testaroo Options',
        'ttr_render_product_meta_box',
        'product',
        'side',
        'default'
    );
});

function ttr_render_product_meta_box($post) {
    $product_id      = (int) $post->ID;
    $in_testers      = ttr_is_product_blacklisted(ttr_testers_blacklist_path(), $product_id);
    $in_fixers       = ttr_is_product_blacklisted(ttr_fixers_blacklist_path(),  $product_id);

    // Get existing reasons
    $testers_reason = '';
    $fixers_reason  = '';
    if ($in_testers) {
        foreach (ttr_read_blacklist(ttr_testers_blacklist_path()) as $e) {
            if ((int) $e['product_id'] === $product_id) { $testers_reason = $e['reason']; break; }
        }
    }
    if ($in_fixers) {
        foreach (ttr_read_blacklist(ttr_fixers_blacklist_path()) as $e) {
            if ((int) $e['product_id'] === $product_id) { $fixers_reason = $e['reason']; break; }
        }
    }
    wp_nonce_field('ttr_product_meta_box', 'ttr_product_meta_nonce');
    ?>
    <div style="font-family:'DM Mono',monospace;font-size:12px;">
        <details>
            <summary style="cursor:pointer;color:#c9a84c;letter-spacing:1px;font-size:11px;text-transform:uppercase;margin-bottom:8px;">
                Testaroo Options
            </summary>
            <div style="margin-top:10px;display:flex;flex-direction:column;gap:12px;">
                <label style="display:flex;align-items:flex-start;gap:8px;">
                    <input type="checkbox" name="ttr_ignore_testers" id="ttr_ignore_testers" value="1" <?php checked($in_testers); ?> style="margin-top:2px;flex-shrink:0;">
                    <span>Ignore in Tester scans</span>
                </label>
                <div id="ttr_testers_reason_wrap" style="<?php echo $in_testers ? '' : 'display:none;'; ?>padding-left:22px;">
                    <input type="text" name="ttr_testers_reason" placeholder="Optional reason…" value="<?php echo esc_attr($testers_reason); ?>" style="width:100%;font-size:11px;background:#111;color:#fff;border:1px solid #444;padding:4px 6px;">
                </div>
                <label style="display:flex;align-items:flex-start;gap:8px;">
                    <input type="checkbox" name="ttr_ignore_fixers" id="ttr_ignore_fixers" value="1" <?php checked($in_fixers); ?> style="margin-top:2px;flex-shrink:0;">
                    <span>Ignore in Fixer scans</span>
                </label>
                <div id="ttr_fixers_reason_wrap" style="<?php echo $in_fixers ? '' : 'display:none;'; ?>padding-left:22px;">
                    <input type="text" name="ttr_fixers_reason" placeholder="Optional reason…" value="<?php echo esc_attr($fixers_reason); ?>" style="width:100%;font-size:11px;background:#111;color:#fff;border:1px solid #444;padding:4px 6px;">
                </div>
            </div>
        </details>
    </div>
    <script>
    (function() {
        var tCb = document.getElementById('ttr_ignore_testers');
        var fCb = document.getElementById('ttr_ignore_fixers');
        if (tCb) tCb.addEventListener('change', function() {
            document.getElementById('ttr_testers_reason_wrap').style.display = this.checked ? '' : 'none';
        });
        if (fCb) fCb.addEventListener('change', function() {
            document.getElementById('ttr_fixers_reason_wrap').style.display = this.checked ? '' : 'none';
        });
    })();
    </script>
    <?php
}

add_action('save_post_product', function($post_id) {
    $product_id = $post_id;
    if (!isset($_POST['ttr_product_meta_nonce'])) 
		return;
    if (!wp_verify_nonce($_POST['ttr_product_meta_nonce'], 'ttr_product_meta_box')) 
		return;
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) 
		return;
    if (!current_user_can('edit_post', $product_id)) 
		return;

    $ignore_testers = !empty($_POST['ttr_ignore_testers']);
    $ignore_fixers  = !empty($_POST['ttr_ignore_fixers']);
    $testers_reason = sanitize_text_field(wp_unslash($_POST['ttr_testers_reason']) ?? '');
    $fixers_reason  = sanitize_text_field(wp_unslash($_POST['ttr_fixers_reason'])  ?? '');

    $testers_path = ttr_testers_blacklist_path();
    $fixers_path  = ttr_fixers_blacklist_path();

    if ($ignore_testers) {
        ttr_blacklist_add_product($testers_path, $product_id, $testers_reason);
    } else {
        ttr_blacklist_remove_product($testers_path, $product_id);
    }

    if ($ignore_fixers) {
        ttr_blacklist_add_product($fixers_path, $product_id, $fixers_reason);
    } else {
        ttr_blacklist_remove_product($fixers_path, $product_id);
    }
}, 5); // priority 5 — runs before automated-behaviors (priority 10/20)

// ── AJAX: resolve image URL to attachment ID ──

add_action('wp_ajax_ttr_resolve_image_attachment', function() {
    ttr_ajax_security_check();
    $input = sanitize_text_field(wp_unslash($_POST['input'] ?? ''));
    if (empty($input)) { wp_send_json_error(['message' => 'No input provided.']); return; }

    // If it's numeric, treat as attachment ID directly
    if (is_numeric($input)) {
        $att_id = (int) $input;
        $url    = wp_get_attachment_url($att_id);
        if (!$url) { wp_send_json_error(['message' => 'No attachment found with ID ' . $att_id . '.']); return; }
        wp_send_json_success(['attachment_id' => $att_id, 'url' => $url]);
        return;
    }

    // Otherwise try to resolve URL → attachment ID
    $att_id = attachment_url_to_postid($input);

    // attachment_url_to_postid can miss scaled/resized variants — try stripping size suffix
    if (!$att_id) {
        $cleaned = preg_replace('/-\d+x\d+(\.[a-z]+)$/i', '$1', $input);
        if ($cleaned !== $input) {
            $att_id = attachment_url_to_postid($cleaned);
        }
    }

    if (!$att_id) {
        wp_send_json_error(['message' => 'Could not find a media attachment matching that URL. Try using the attachment ID directly.']);
        return;
    }

    wp_send_json_success([
        'attachment_id' => $att_id,
        'url'           => wp_get_attachment_url($att_id),
    ]);
});