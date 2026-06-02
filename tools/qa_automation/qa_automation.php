<?php
if (!defined('ABSPATH')) {
    exit;
}

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_testaroo') {
        return;
    }

    wp_enqueue_style(
        'qa_automation-css',
        plugin_dir_url(__FILE__) . 'qa_automation.css',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'qa_automation.css')
    );

    wp_enqueue_script(
        'qa_automation-js',
        plugin_dir_url(__FILE__) . 'qa_automation.js',
        [],
        filemtime(plugin_dir_path(__FILE__) . 'qa_automation.js'),
        true
    );
});

function get_qa_automation_html() {
    ?>
        <div>Work in progress. Coming soon! Please message us about your interest in this feature, and what you would like to see from it. This will help to prioritize its development.</div>
        <br/><br/><br/>
        <div><strong>The plan for the Playwright tool currently is:</strong></div><br/>
        <ul style='margin: 5px 0 5px 20px;'>
            <li>- Offer a place for your UI automation tests to be created and stored</li>
            <li>- Offer integration with an external source like Github (strongly desirable for versioning)</li>
            <li>- Simplify the process of deploying code changes for less technical folks by uploading the current working copy and deploying it to the repo for the user</li>
            <li>- Easy way to download the test suite and quickly launch tests from a user's desktop with zero technical knowledge needed</li>
            <li>- Insert logic in the framework that uploads the results to Testaroo for easy access of test run reports (and storage of all runs and reports)</li>
            <li>- Offer integratable API tools from the QA Tools section that quickly add functionality to your tests - like a Luhn Credit Card generator that allows you to test UI validation of checkout forms etc.</li>
            <li>- These QA tools can be used directly from the plugin, or inserted into the test suite with no technical knowledge needed</li>
            <li>- Integration with AI and/or test recording software to easily make tests with minimal effort or UI testing experience</li>
        </ul>
    <?php
}