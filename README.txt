=== Testaroo ===
Contributors: tsibiski
Tags: woocommerce, products, testing, categories, images
Requires at least: 5.9
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0
License: GPL-3.0
License URI: https://www.gnu.org/licenses/gpl-3.0.html

WooCommerce product integrity testing tool. Scan, detect, and fix product data problems across your entire catalog.

== Description ==

Testaroo (TTR) is a powerful suite of testing and fixing tools for WooCommerce.

Scan your products and images for a litany of possible problems. Have you ever encountered any of these issues?

* Products have missing images
* Products have no thumbnail, but have gallery images
* Products have broken image links
* Products have deeply nested child categories, but you'd like them to have all parent categories as well
* Products have duplicated images on the same product, or across multiple products
* Product images are too small and are stretched in bizarre ways by WooCommerce product pages
* Your uploads are bloated by unused images that need to be identified and cleaned up
* You import product data from 3rd party vendors, running into the following issues:
  * Categories are poorly handled or just don't match your way of organizing them
  * No categories are applied at all, or products get imported with only an "Uncategorized" category
  * Third party imports override manual product data changes during updates
  * Encoded HTML entities make it into your product data, which won't match the terms customers search with

If you answered yes to any one of those problems, TTR has your solution. Scan your inventory, see the problems explicitly, and fix them manually or in bulk.

= Testers =

Two tools are at your disposal here, with powerful and granular approaches to fixing the problems they report.

**Image Duplicate Test**

When you scan your product database for duplicates, images duplicated on the same product are displayed in one table. Remove the duplicates on a product-by-product basis, or in bulk with a single click.

Identical images used across two or more products are also surfaced. Handle them by product or in bulk — all products using an identical image file will be pointed to the same canonical image, and the redundant copies deleted.

Unused images are detected and moved to a staging folder. At the end of the scan, your plugins, code, HTML, CSS, and post meta are checked for references to these "unused" images. Confirmed references are stored in a Deep-Use Cache so they are skipped in this and future scans. Images confirmed to have no references at all are deletable individually or in bulk. A backup ZIP of deleted images is created for safekeeping before anything is permanently removed.

**Product Batch Test**

The Product Batch Run scan finds products with broken image links, missing images, images that are too small to serve as hero images, and more.

When an image reference is broken, click a button to automatically search the database for the image in case files were programmatically rearranged without updating product references. If the image is gone entirely, remove the broken link and use the built-in image search tool to find a replacement on the web. Leverage product attributes to craft an effective search query, browse results, and attach a selected image directly to the product — all without leaving the page.

This tool also reports uncategorized products and products assigned only to "Uncategorized", so you know exactly what is falling outside the categorization ecosystem you've built.

Results can be filtered by error type — only want to see products with broken images, or only uncategorized ones? Select a filter and the table updates instantly, without losing any of the detail reported for each product.

= Fixers =

The Fixers tab provides automated tools for correcting category and product data issues across your entire catalog, either on demand or automatically whenever products are saved.

**Add Parent Categories**

Automatically walks the category hierarchy for each product and ensures all ancestor categories are assigned. For example, if a product is in "Solar Garden Lights" which lives under "Outdoor Lights" → "Lighting", the product will be given all three categories — not just the deepest one. This is essential for keeping breadcrumb navigation, layered navigation filters, and category landing pages accurate.

**Simple Category Mappings**

Defines a list of one-to-one category slug replacements. When a product is found to have a source slug (e.g. `sconce-lights`), it is remapped to your preferred slug (e.g. `wall-mounted-lights`). This is ideal for cleaning up category slugs that arrived from a vendor feed and don't match your site's taxonomy.

Mappings are managed from the Fixers tab UI — add, update, or delete entries without touching any files. Changes take effect immediately on the next save or manual run.

**Complex Category Mappings**

Provides scenario-based category assignment for situations that a simple one-to-one remap cannot handle. Each scenario defines matching category slugs, optional keyword filters on product title or description, optional product attribute conditions, and the category to apply when all conditions are met.

This allows highly targeted remapping, such as "if a product is in `outdoor-lights` and its title contains `solar`, add it to `solar-garden-lights`." Scenarios are stacked and all matching ones are applied in order. Fully managed from the UI with no file editing required.

**Decode HTML Entities**

Automatically replaces encoded HTML entities (e.g. `&amp;`, `&#39;`, `&quot;`) with their true character equivalents in product titles and descriptions. Products imported from third-party feeds frequently contain these artifacts, which cause mismatches in customer searches.

**Auto-Fix Behaviors**

Each fixer can be toggled to run automatically whenever a product is saved in WooCommerce, keeping your catalog clean without requiring manual intervention.

== Requirements ==

WooCommerce is needed for all "Fixers tools", and the Batch Run Test "Testers" tool. Additionally, phases 1-3 of the Duplicate & Unused Image Check tool also report on WooCommerce products. However, phase 4 of 4 of this tool checks for ANY unused images, wherever it may be in the system, meaning that WooCommerce is not a dependency for this check. Also, future Playwright related tools do not have a dependency on WooCommerce.

== External services ==

This plugin OPTIONALLY connects to an API, https://tavily.com/. It is only used in the Batch Run Test to find product images online for products lacking any images.

It is a free service (up to 1000 api calls a month per api key) that Testaroo leverages to take your provided product search term, returning up to 10 images to present to you. You may then select one or more images to automatically attach to your product. It is just a great simplification of the process of finding product images, and is only used by and only required for the "Find Product Image" search tool, accessible from product errors reported by the Batch Test Run tool.

== Installation ==

1. Upload the `testaroo` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress plugin screen.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Navigate to **Testaroo** in the WordPress admin menu.
4. To use the image search feature, add a free Tavily API key under the **Info** tab → **Store & API Settings**.

== Frequently Asked Questions ==

= Does this plugin modify my products automatically? =

Only if you enable the auto-fix toggles in the Fixers tab. All automated behaviors are opt-in and can be disabled globally with a single setting.

= Is it safe to run on a large catalog? =

Yes. All batch operations run in paginated chunks to avoid server timeouts and memory issues.

= What happens to deleted images? =

Before any image is permanently deleted, a backup ZIP archive is created in your uploads folder. Nothing is removed without a safety copy first.

= Does this plugin work without WooCommerce? =

No. Testaroo requires WooCommerce to be installed and active.

== Screenshots ==

1. Product Batch Test — scan results showing broken images, missing thumbnails, and uncategorized products.
2. Image Duplicate & Unused Finder — duplicate and unused image detection with bulk fix options.
3. Simple Category Mappings — one-to-one slug remapping UI.
4. Complex Category Mappings — scenario-based category assignment with title, description, and attribute conditions.
5. Settings — global auto-fix toggles and Tavily API key configuration.

== Changelog ==

= 1.0 =
* Initial public release.

== Upgrade Notice ==

= 1.0 =
Initial release.
