<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
    exit;
}

// Remove transients
delete_transient( 'testaroo_product_processed_count' );
