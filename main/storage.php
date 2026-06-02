<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * TTR Storage Helpers
 *
 * Centralises all reads and writes so nothing ever touches the plugin directory.
 *
 * Settings      → wp_options  (ttr_settings, ttr_tools_settings)
 * Scan data     → wp-content/uploads/testaroo/  (guaranteed writable)
 */

// ── Option keys ── 

define( 'TTR_OPTION_SETTINGS',       'ttr_settings' );
define( 'TTR_OPTION_TOOLS_SETTINGS', 'ttr_tools_settings' );

// ── Settings (settings.json → wp_options) ── 

function ttr_get_settings(): array {
    return (array) get_option( TTR_OPTION_SETTINGS, [] );
}

function ttr_save_settings( array $settings ): bool {
    return update_option( TTR_OPTION_SETTINGS, $settings, false );
}

function ttr_get_setting( string $key, $default = null ) {
    return ttr_get_settings()[ $key ] ?? $default;
}

function ttr_save_setting_key( string $key, $value ): bool {
    $settings         = ttr_get_settings();
    $settings[ $key ] = $value;
    return ttr_save_settings( $settings );
}

// ── Tools settings (tools-settings.json → wp_options) ── 

function ttr_get_tools_settings(): array {
    return (array) get_option( TTR_OPTION_TOOLS_SETTINGS, [] );
}

function ttr_save_tools_settings( array $settings ): bool {
    return update_option( TTR_OPTION_TOOLS_SETTINGS, $settings, false );
}

function ttr_save_tools_setting_key( string $key, $value ): bool {
    $settings         = ttr_get_tools_settings();
    $settings[ $key ] = $value;
    return ttr_save_tools_settings( $settings );
}

// ── Upload directory for scan data ── 

function ttr_uploads_dir(): string {
    $dir = wp_upload_dir()['basedir'] . '/testaroo';
    if ( ! file_exists( $dir ) ) {
        wp_mkdir_p( $dir );
        file_put_contents( $dir . '/.htaccess', "deny from all\n" );
    }
    return $dir;
}

function ttr_uploads_path( string $filename ): string {
    return ttr_uploads_dir() . '/' . $filename;
}

// ── Blacklist paths (now in uploads) ── 

function ttr_testers_blacklist_path(): string {
    return ttr_uploads_path( 'testers-blacklist.json' );
}

function ttr_fixers_blacklist_path(): string {
    return ttr_uploads_path( 'fixers-blacklist.json' );
}

function ttr_images_blacklist_path(): string {
    return ttr_uploads_path( 'images-blacklist.json' );
}

// ── Batch test scan data paths ── 

function ttr_batch_results_path(): string {
    return ttr_uploads_path( 'product-batch-test-results.json' );
}

function ttr_batch_ignored_products_path(): string {
    return ttr_uploads_path( 'product-batch-test-ignore-products.json' );
}


// ── Image duplicate test paths ── 

function ttr_idt_state_path(): string {
    return ttr_uploads_path( 'idt-scan-state.json' );
}

function ttr_idt_results_path(): string {
    return ttr_uploads_path( 'idt-results.json' );
}

function ttr_idt_cache_path(): string {
    return ttr_uploads_path( 'idt-deep-use-cache.json' );
}