<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_testaroo') {
        return;
    }

    wp_enqueue_style(
        'qa_tools-css',
        plugin_dir_url(__FILE__) . 'qa_tools.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'qa_tools.css')
    );

    wp_enqueue_script(
        'qa_tools-js',
        plugin_dir_url(__FILE__) . 'qa_tools.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'qa_tools.js'),
        true
    );
});

function get_qa_tools_html() {
    ?>  
        <!-- <div>
            <button class='luhn-cc-generate'>Generate Credit Card Number</button><span>Generates a Luhn algorithm card number for QA UI validation of checkout forms, and development checkout testing.</span>
            <details open style="margin-bottom:24px;">
                <summary>Add JS Method To Playwright</summary>
                <code>//TODO: Javascript method for CC generation here.</code>
            </details>
        </div> -->
        <div>Work in progress. Coming soon!</div>
    <?php
}


/**
 * Generate a QA/testing credit card number that passes the Luhn check.
 *
 * Supported types:
 * - visa
 * - mastercard
 * - amex
 * - discover
 *
 */
function generate_test_card_number($type = 'visa')
{
    $type = strtolower(trim($type));

    // Card prefixes and lengths
    $cardData = [
        'visa' => [
            'prefixes' => ['4'],
            'length'   => 16,
        ],
        'mastercard' => [
            'prefixes' => ['51', '52', '53', '54', '55'],
            'length'   => 16,
        ],
        'amex' => [
            'prefixes' => ['34', '37'],
            'length'   => 15,
        ],
        'discover' => [
            'prefixes' => ['6011'],
            'length'   => 16,
        ],
    ];

    if (!isset($cardData[$type])) {
        return false;
    }

    $prefixes = $cardData[$type]['prefixes'];
    $length   = $cardData[$type]['length'];

    // Pick random prefix
    $prefix = $prefixes[array_rand($prefixes)];

    // Build partial card number
    $number = $prefix;

    while (strlen($number) < ($length - 1)) {
        $number .= wp_rand(0, 9);
    }

    // Append valid Luhn check digit
    $number .= calculate_luhn_check_digit($number);

    return $number;
}

/**
 * Calculate the Luhn check digit.
 */
function calculate_luhn_check_digit($number)
{
    $sum = 0;
    $alt = true;

    for ($i = strlen($number) - 1; $i >= 0; $i--) {
        $n = intval($number[$i]);

        if ($alt) {
            $n *= 2;

            if ($n > 9) {
                $n -= 9;
            }
        }

        $sum += $n;
        $alt = !$alt;
    }

    return (10 - ($sum % 10)) % 10;
}
