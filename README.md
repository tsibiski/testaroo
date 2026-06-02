# This is Testaroo

But there's a lot more here than testing to do...

First and foremost, Testaroo (TTR) is a powerful suite of testing and fixing tools for WooCommerce.

Scan your products and images for a litany of possible problems. Have you ever encountered any of these issues?

- Products have missing images
- Products have no thumbnail, but have gallery images
- Products have broken image links
- Products have deeply nested child categories, but you'd like them to have all parent categories as well
- Products have duplicated images on the same product, or across multiple products
- Product images are too small and are stretched in bizarre ways by WooCommerce product pages
- Your uploads are bloated by unused images that need to be identified and cleaned up
- You import product data from 3rd party vendors, running into the following issues:
    - Categories are poorly handled or just don't match your way of organizing them
    - No categories are applied at all, or products get imported with only an "Uncategorized" category
    - Third party imports override manual product data changes during updates
    - Encoded HTML entities make it into your product data, which won't match the terms customers search with

If you answered yes to any one of those problems, TTR has your solution. Scan your inventory, see the problems explicitly, and fix them manually or in bulk.

## Testers

Two tools are at your disposal here, with powerful and granular approaches to fixing the problems they report.

### Image Duplicate Test

When you scan your product database for duplicates, images duplicated on the same product are displayed in one table. Remove the duplicates on a product-by-product basis, or in bulk with a single click.

Identical images used across two or more products are also surfaced. Handle them by product or in bulk — all products using an identical image file will be pointed to the same canonical image, and the redundant copies deleted.

Unused images are detected and moved to a staging folder. At the end of the scan, your plugins, code, HTML, CSS, and post meta are checked for references to these "unused" images. Confirmed references are stored in a Deep-Use Cache so they are skipped in this and future scans. Images confirmed to have no references at all are deletable individually or in bulk. A backup ZIP of deleted images is created for safekeeping before anything is permanently removed.

### Product Batch Test

The Product Batch Run scan finds products with broken image links, missing images, images that are too small to serve as hero images, and more.

When an image reference is broken, click a button to automatically search the database for the image in case files were programmatically rearranged without updating product references. If the image is gone entirely, remove the broken link and use the built-in image search tool to find a replacement on the web. Leverage product attributes to craft an effective search query, browse results, and attach a selected image directly to the product — all without leaving the page.

This tool also reports uncategorized products and products assigned only to "Uncategorized", so you know exactly what is falling outside the categorization ecosystem you've built. From there, the Fixers tools can resolve those problems automatically.

Results can be filtered by error type — only want to see products with broken images, or only uncategorized ones? Select a filter and the table updates instantly, without losing any of the detail reported for each product.

## Fixers

The Fixers tab provides automated tools for correcting category and product data issues across your entire catalog, either on demand or automatically whenever products are saved.

### Add Parent Categories

Automatically walks the category hierarchy for each product and ensures all ancestor categories are assigned. For example, if a product is in "Solar Garden Lights" which lives under "Outdoor Lights" → "Lighting", the product will be given all three categories — not just the deepest one. This is essential for keeping breadcrumb navigation, layered navigation filters, and category landing pages accurate.

### Simple Category Mappings

Defines a list of one-to-one category slug replacements. When a product is found to have a source slug (e.g. `sconce-lights`), it is remapped to your preferred slug (e.g. `wall-mounted-lights`). This is ideal for cleaning up category slugs that arrived from a vendor feed and don't match your site's taxonomy.

Mappings are managed from the Fixers tab UI — add, update, or delete entries without touching any files. Changes take effect immediately on the next save or manual run.

### Complex Category Mappings

Provides scenario-based category assignment for situations that a simple one-to-one remap cannot handle. Each scenario defines:

- **Matching category slugs** — the product must currently belong to one (or all) of these categories
- **Exact match** — optionally require that the product belongs *only* to those categories, with no others
- **Title contains / Description contains** — optional keyword filters on the product name or description
- **Attribute checks** — optional product attribute conditions (e.g. `pa_light-type` contains `solar`)
- **Apply category slug** — the category to add when all conditions are met

This allows highly targeted remapping, such as "if a product is in `outdoor-lights` and its title contains `solar`, add it to `solar-garden-lights`." Scenarios are stacked and all matching ones are applied in order.

Like simple mappings, scenarios are fully managed from the UI with no file editing required.

### Decode HTML Entities

Automatically replaces encoded HTML entities (e.g. `&amp;`, `&#39;`, `&quot;`) with their true character equivalents in product titles and descriptions. Products imported from third-party feeds frequently contain these artifacts, which cause mismatches in searches that make customers finding products nearly impossible.

### Auto-Fix Behaviors

Each fixer can be toggled to run automatically whenever a product is saved in WooCommerce, keeping your catalog clean without requiring manual intervention. These toggles are controlled from the Fixers tab and stored in the shared tools settings.

## Coming In The Future - Based On Interest

### Playwright Tests

Playwright testing tools will be integrated to ease the process of writing JavaScript Playwright tests and running them locally or in the cloud directly from the WordPress admin.

### QA Tools

Various tools to make QA easier, integrated directly with Playwright Tests. An example is a credit card number generator using the Luhn Algorithm — for quick access to a card number that passes UI validation checks during checkout QA testing.
