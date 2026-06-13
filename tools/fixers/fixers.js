const elConvertSimpleCategoriesWrapper  = () => document.getElementById('convert-simple-categories-wrapper');
const elConvertComplexCategoriesWrapper = () => document.getElementById('convert-complex-categories-wrapper');

// ============================================================
// Tab initializers — called after lazy-load completes
// ============================================================

function initFixersTab() {
    const fs = ToolsSettingsManager.getSettings();

    // If both managers are populated (seeded from TTR.* at boot), initialize immediately.
    // Otherwise kick off AJAX loads and wait — this is the fallback for edge cases only.
    if (Object.keys(fs).length > 0) {
        FixSimpleCategoryMappings.init(fs.fixSimpleCategoryMappings ?? []);
        FixComplexCategoryMappings.init(fs.fixComplexCategoryMappings ?? []);
        AutoFixSimpleCategoryMappings.init(fs.autoFixSimpleCategoryMappings ?? false);
        AutoFixComplexCategoryMappings.init(fs.autoFixComplexCategoryMappings ?? false);
        AutoAddParentCategories.init(fs.autoAddParentCategories ?? false);
        AutoDecodeHtmlEntities.init(fs.autoDecodeHtmlEntities ?? false);
    } else {
        Promise.all([ToolsSettingsManager.loadSettings()]).then(() => {
            const fs2 = ToolsSettingsManager.getSettings();
            FixSimpleCategoryMappings.init(fs2.fixSimpleCategoryMappings ?? []);
            FixComplexCategoryMappings.init(fs2.fixComplexCategoryMappings ?? []);
            AutoFixSimpleCategoryMappings.init(fs2.autoFixSimpleCategoryMappings ?? false);
            AutoFixComplexCategoryMappings.init(fs2.autoFixComplexCategoryMappings ?? false);
            AutoAddParentCategories.init(fs2.autoAddParentCategories ?? false);
            AutoDecodeHtmlEntities.init(fs2.autoDecodeHtmlEntities ?? false);
        });
    }
}

// ===========================
// Simple Category Mappings
// ===========================
const FixSimpleCategoryMappings = (() => {

    // --- Selectors ---
    const newCategoryInputSel = '.new-setting-mapping .settings-category-mapping-input-category-to-update';
    const newDesiredInputSel  = '.new-setting-mapping .settings-category-mapping-input-desired-category';
    const addNewButtonSel     = '.new-setting-mapping .add-mapping-button';
    const existingRegionSel   = '#simple-existing-scenarios-region';
    const displaySettingsRegionSel   = '#convert-simple-categories-wrapper';

    // --- Init from loaded settings ---

    function init(mappings) {
        waitForElementToExist(displaySettingsRegionSel).then((el) => {
            let region = el.querySelector(existingRegionSel);
            region.innerHTML = ''; // clear any placeholder rows
            mappings.forEach((mapping, index) => renderExistingRow(mapping, index, region));
            document.querySelector(addNewButtonSel).addEventListener('click', handleAdd);
        });
    }

    // --- Render an existing mapping row ---

    function renderExistingRow(mapping, index, container) {
        const row = document.createElement('div');
        row.className = 'existing-setting-mapping';
        row.dataset.index = index;

        row.innerHTML = `
            <input class="settings-category-mapping-input-category-to-update"
                   placeholder="Category slug to change"
                   value="${escapeAttr(mapping.from)}">
            <span class="settings-category-mapping-arrow">⇨</span>
            <input class="settings-category-mapping-input-desired-category"
                   placeholder="Your desired category slug"
                   value="${escapeAttr(mapping.to)}">
            <button class="update-mapping-button">Update</button>
            <button class="delete-mapping-button">Delete</button>
        `;

        row.querySelector('.update-mapping-button').addEventListener('click', () => handleUpdate(row, index));
        row.querySelector('.delete-mapping-button').addEventListener('click', () => handleDelete(row, index));

        container.appendChild(row);
    }

    // --- Handlers ---

    function handleAdd() {
        const fromInput = document.querySelector(newCategoryInputSel);
        const toInput   = document.querySelector(newDesiredInputSel);
        const from      = fromInput.value.trim();
        const to        = toInput.value.trim();

        if (!from || !to) {
            alert('Please fill in both category slug fields.');
            return;
        }

        // Always re-fetch from server before mutating — never trust stale in-memory state
        fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'ttr_get_tools_settings', nonce: TTR.nonce }),
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) { alert('Failed to load current settings.'); return; }

            const currentMappings = data.data.fixSimpleCategoryMappings ?? [];
            const updated = [...currentMappings, { from, to }];

            ToolsSettingsManager.saveSetting('fixSimpleCategoryMappings', updated).then(success => {
                if (!success) return;
                const index = updated.length - 1;
                renderExistingRow({ from, to }, index, document.querySelector(existingRegionSel));
                fromInput.value = '';
                toInput.value   = '';
            });
        });
    }

    function handleUpdate(row, index) {
        const from = row.querySelector('.settings-category-mapping-input-category-to-update').value.trim();
        const to   = row.querySelector('.settings-category-mapping-input-desired-category').value.trim();

        if (!from || !to) {
            alert('Please fill in both category slug fields.');
            return;
        }

        // Re-fetch from server before mutating
        fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'ttr_get_tools_settings', nonce: TTR.nonce }),
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) { alert('Failed to load current settings.'); return; }

            const currentMappings = [...(data.data.fixSimpleCategoryMappings ?? [])];
            currentMappings[index] = { from, to };

            ToolsSettingsManager.saveSetting('fixSimpleCategoryMappings', currentMappings).then(success => {
                if (!success) return;
                showInlineConfirm(row.querySelector('.update-mapping-button'), 'Updated!');
            });
        });
    }

    function handleDelete(row, index) {
        if (!confirm('Remove this category mapping?')) return;

        // Re-fetch from server before mutating
        fetch(TTR.ajaxUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'ttr_get_tools_settings', nonce: TTR.nonce }),
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) { alert('Failed to load current settings.'); return; }

            const currentMappings = [...(data.data.fixSimpleCategoryMappings ?? [])];
            currentMappings.splice(index, 1);

            ToolsSettingsManager.saveSetting('fixSimpleCategoryMappings', currentMappings).then(success => {
                if (!success) return;
                row.remove();
                reIndexRows();
            });
        });
    }

    // --- Re-index rows after a deletion ---

    function reIndexRows() {
        document.querySelector(existingRegionSel).querySelectorAll('.existing-setting-mapping').forEach((row, i) => {
            row.dataset.index = i;
            row.querySelector('.update-mapping-button').onclick = () => handleUpdate(row, i);
            row.querySelector('.delete-mapping-button').onclick = () => handleDelete(row, i);
        });
    }

    return { init };
})();

// ===========================
// Complex Category Mappings
// ===========================
const FixComplexCategoryMappings = (() => {

    const wrapperSel      = '#convert-complex-categories-wrapper';
    const existingRegionSel = '#complex-existing-scenarios-region';
    const addBtnSel       = '#complex-add-scenario-button';

    // ── Field selectors inside the "new scenario" form ──────────────────────
    const newFieldSel = (name) => `#complex-new-scenario [data-field="${name}"]`;

    // ── Init ─────────────────────────────────────────────────────────────────

    function init(scenarios) {
        waitForElementToExist(wrapperSel).then((wrapper) => {
            injectUI(wrapper);

            const region = wrapper.querySelector(existingRegionSel);
            region.innerHTML = '';
            (scenarios || []).forEach((s, i) => renderScenarioRow(s, i, region));

            wrapper.querySelector(addBtnSel).addEventListener('click', handleAdd);
        });
    }

    // ── Build the scenario form HTML (injected once) ─────────────────────────

    function injectUI(wrapper) {
        // Replace the placeholder simple-mapping markup with scenario fields
        const foldout = wrapper.querySelector('.settings-foldout');
        if (!foldout) return;

        foldout.querySelector('summary').textContent = 'Complex Category Scenarios';

        foldout.querySelector('.settings-foldout-region').innerHTML = `
            <div id="complex-new-scenario" class="complex-scenario-form">
                <h4 style="margin:0 0 8px">New Scenario</h4>
                ${scenarioFieldsHTML()}
                <button id="complex-add-scenario-button" class="add-mapping-button" style="margin-top:8px;">
                    Add Scenario
                </button>
            </div>
            <hr style="border-color:#444;margin:12px 0;"/>
            <div id="complex-existing-scenarios-region"></div>
        `;

        bindAddAttrButton(foldout.querySelector('#complex-new-scenario'));
    }

    function scenarioFieldsHTML() {
        return `
            <div class="complex-scenario-fields">
                <div class="complex-scenario-field">
                    <div>Mapping Name <span>(label only)</span></div>
                    <input data-field="description" class="complex-field" placeholder="e.g. Solar Lights Category Mapping" />
                </div>
                <div class="complex-scenario-field">
                    <div>Matching category slugs <span>(comma-separated)</span></div>
                    <input data-field="matching_category_slugs" class="complex-field" placeholder="e.g. outdoor-lights, solar-garden-lights" />
                </div>
                <div class="complex-scenario-field" style="display:flex;align-items:center;gap:6px;">
                    <input data-field="exact_match" type="checkbox" />
                    Exact match <span>(product must have ONLY these categories)</span>
                </div>
                <div class="complex-scenario-field">
                    <div>Apply category slugs <span>(comma-separated)</span></div>
                    <input data-field="apply_category_slugs" class="complex-field" placeholder="e.g. outdoor-lights, solar-garden-lights" />
                </div>
                <div class="complex-scenario-field" style="display:flex;align-items:center;gap:6px;">
                    <input data-field="remove_all_categories" type="checkbox" />
                    Remove ALL existing categories before applying <span>(clean slate)</span>
                </div>
                <div class="complex-scenario-field">
                    <div>Remove specific category slugs <span>(comma-separated, leave blank to skip)</span></div>
                    <input data-field="remove_category_slugs" class="complex-field" placeholder="e.g. outdoor-lights, solar-garden-lights" />
                </div>
                <div class="complex-scenario-field">
                    <div>Title contains <span>(leave blank to skip)</span></div>
                    <input data-field="title_contains" class="complex-field" placeholder="e.g. solar" />
                </div>
                <div class="complex-scenario-field">
                    <div>Description contains <span>(leave blank to skip)</span></div>
                    <input data-field="description_contains" class="complex-field" placeholder="e.g. solar" />
                </div>
                <div class="complex-scenario-field complex-attributes-section">
                    <div class="complex-attributes-header">
                        Attributes <span>(any one matching is enough — OR logic)</span>
                        <button type="button" class="complex-add-attr-button">+ Add Attribute</button>
                    </div>
                    <div class="complex-attributes-list"></div>
                </div>
            </div>
        `;
    }

    function attributeRowHTML(name, contains) {
        return `
            <div class="complex-attr-row">
                <input data-attr-field="name" class="complex-field" placeholder="e.g. pa_light-type" value="${escapeAttr(name ?? '')}" />
                <span class="complex-attr-sep">contains</span>
                <input data-attr-field="contains" class="complex-field" placeholder="e.g. solar" value="${escapeAttr(contains ?? '')}" />
                <button type="button" class="complex-remove-attr-button">✕</button>
            </div>
        `;
    }

    function addAttributeRow(container, name, contains) {
        const list = container.querySelector('.complex-attributes-list');
        if (!list) return;
        const div = document.createElement('div');
        div.innerHTML = attributeRowHTML(name, contains);
        const row = div.firstElementChild;
        row.querySelector('.complex-remove-attr-button').addEventListener('click', () => row.remove());
        list.appendChild(row);
    }

    function bindAddAttrButton(container) {
        container.querySelector('.complex-add-attr-button')?.addEventListener('click', () => {
            addAttributeRow(container, '', '');
        });
    }

    // ── Read a scenario object out of a container's data-field inputs ────────

    function readScenario(container) {
        const get     = (name) => (container.querySelector(`[data-field="${name}"]`)?.value ?? '');
        const checked = (name) => container.querySelector(`[data-field="${name}"]`)?.checked ?? false;

        const slugsRaw = get('matching_category_slugs');
        const slugs    = slugsRaw ? slugsRaw.split(',').map(s => screen).filter(Boolean) : [];

        // Read all attribute rows
        const attrRows = container.querySelectorAll('.complex-attr-row');
        const attrChecks = [];
        attrRows.forEach(row => {
            const name     = (row.querySelector('[data-attr-field="name"]')?.value ?? '');
            const contains = (row.querySelector('[data-attr-field="contains"]')?.value ?? '');
            if (name || contains) attrChecks.push({ name, contains });
        });

        const applyRaw  = get('apply_category_slugs');
        const applySlugs = applyRaw ? applyRaw.split(',').map(s => s).filter(Boolean) : [];

        const removeRaw  = get('remove_category_slugs');
        const removeSlugs = removeRaw ? removeRaw.split(',').map(s => s).filter(Boolean) : [];

        return {
            description              : get('description'),
            matching_category_slugs  : slugs,
            exact_match              : checked('exact_match'),
            apply_category_slugs     : applySlugs,
            remove_all_categories    : checked('remove_all_categories'),
            remove_category_slugs    : removeSlugs,
            title_contains           : get('title_contains'),
            description_contains     : get('description_contains'),
            attribute_checks         : attrChecks,
        };
    }

    // ── Populate a container's data-field inputs from a scenario object ──────

    function populateScenario(container, scenario) {
        const set = (name, val) => {
            const el = container.querySelector(`[data-field="${name}"]`);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!val;
            else el.value = val ?? '';
        };

        set('description',             scenario.description            ?? '');
        set('matching_category_slugs', (scenario.matching_category_slugs ?? []).join(', '));
        set('exact_match',             scenario.exact_match            ?? false);

        // Support legacy single apply_category_slug
        const applySlugs = scenario.apply_category_slugs?.length
            ? scenario.apply_category_slugs
            : (scenario.apply_category_slug ? [scenario.apply_category_slug] : []);
        set('apply_category_slugs',    applySlugs.join(', '));

        set('remove_all_categories',   scenario.remove_all_categories  ?? false);
        set('remove_category_slugs',   (scenario.remove_category_slugs ?? []).join(', '));
        set('title_contains',          scenario.title_contains         ?? '');
        set('description_contains',    scenario.description_contains   ?? '');

        // Support both new array format and legacy single attribute_check
        const attrs = scenario.attribute_checks?.length
            ? scenario.attribute_checks
            : (scenario.attribute_check ? [scenario.attribute_check] : []);

        attrs.forEach(a => addAttributeRow(container, a.name ?? '', a.contains ?? ''));
    }

    // ── Render one existing scenario row ────────────────────────────────────

    function renderScenarioRow(scenario, index, container) {
        const row = document.createElement('div');
        row.className = 'complex-scenario-row';
        row.dataset.index = index;

        const label = scenario.description || (scenario.apply_category_slugs?.join(', ')) || scenario.apply_category_slug || `Scenario #${index + 1}`;

        row.innerHTML = `
            <details class="complex-scenario-details">
                <summary class="complex-scenario-summary">
                    <span class="complex-scenario-label">${escapeAttr(label)}</span>
                    <button class="delete-mapping-button" style="margin-left:auto;">Delete</button>
                </summary>
                <div class="complex-scenario-body">
                    ${scenarioFieldsHTML()}
                    <button class="update-mapping-button" style="margin-top:8px;">Save Changes</button>
                </div>
            </details>
        `;

        populateScenario(row, scenario);
        bindAddAttrButton(row);

        row.querySelector('.update-mapping-button').addEventListener('click', () => handleUpdate(row, index));
        row.querySelector('.delete-mapping-button').addEventListener('click', (e) => {
            e.stopPropagation(); // don't toggle the <details>
            handleDelete(row, index);
        });

        container.appendChild(row);
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    function handleAdd() {
        const formEl      = document.querySelector('#complex-new-scenario');
        const newScenario = readScenario(formEl);

        if (!newScenario.apply_category_slugs?.length && !newScenario.remove_all_categories && !newScenario.remove_category_slugs?.length) {
            alert('Please fill in "Apply category slugs", or configure at least one removal option.');
            return;
        }

        fetchAndMutate(scenarios => [...scenarios, newScenario], (updated) => {
            const index  = updated.length - 1;
            const region = document.querySelector(existingRegionSel);
            renderScenarioRow(newScenario, index, region);
            // Clear new-scenario form
            formEl.querySelectorAll('.complex-field').forEach(el => el.value = '');
            formEl.querySelector('[data-field="exact_match"]').checked = false;
            formEl.querySelector('[data-field="remove_all_categories"]').checked = false;
            formEl.querySelector('.complex-attributes-list').innerHTML = '';
        });
    }

    function handleUpdate(row, index) {
        const updated_scenario = readScenario(row);

        if (!updated_scenario.apply_category_slugs?.length && !updated_scenario.remove_all_categories && !updated_scenario.remove_category_slugs?.length) {
            alert('Please fill in "Apply category slugs", or configure at least one removal option.');
            return;
        }

        fetchAndMutate(
            scenarios => {
                const copy = [...scenarios];
                copy[index] = updated_scenario;
                return copy;
            },
            () => {
                // Update the summary label
                const label = updated_scenario.description || updated_scenario.apply_category_slugs?.join(', ') || `Scenario #${index + 1}`;
                const summarySpan = row.querySelector('.complex-scenario-label');
                if (summarySpan) summarySpan.textContent = label;
                showInlineConfirm(row.querySelector('.update-mapping-button'), 'Saved!');
            }
        );
    }

    function handleDelete(row, index) {
        if (!confirm('Remove this scenario?')) return;

        fetchAndMutate(
            scenarios => {
                const copy = [...scenarios];
                copy.splice(index, 1);
                return copy;
            },
            () => {
                row.remove();
                reIndexRows();
            }
        );
    }

    // ── Re-fetch → mutate → save → callback ──────────────────────────────────

    function fetchAndMutate(mutateFn, onSuccess) {
        // Always read from the live ToolsSettingsManager so we have the latest
        // saved state — TTR.toolsSettings is only the page-load snapshot and
        // goes stale after the first save.
        const current = ToolsSettingsManager.getSettings().fixComplexCategoryMappings ?? [];
        const updated = mutateFn(current);

        ToolsSettingsManager.saveSetting('fixComplexCategoryMappings', updated).then(success => {
            if (!success) return;
            // Keep TTR.toolsSettings in sync so other code reading it stays current
            if (TTR.toolsSettings) TTR.toolsSettings.fixComplexCategoryMappings = updated;
            if (onSuccess) onSuccess(updated);
        });
    }

    // ── Re-index rows after a deletion ───────────────────────────────────────

    function reIndexRows() {
        document.querySelectorAll(`${existingRegionSel} .complex-scenario-row`).forEach((row, i) => {
            row.dataset.index = i;
            row.querySelector('.update-mapping-button').onclick = () => handleUpdate(row, i);
            row.querySelector('.delete-mapping-button').onclick = (e) => {
                e.stopPropagation();
                handleDelete(row, i);
            };
        });
    }

    return { init };
})();

// ============================================================
// Auto-Fix Simple Category Mappings Checkbox Setting
// ============================================================

const AutoFixSimpleCategoryMappings = (() => {

    const checkboxSel = '#auto-fix-simple-categories-checkbox';

    function init(value) {
        waitForElementToExist(checkboxSel).then((el) => {
            el.checked = value;
            el.addEventListener('change', handleChange);
        });
    }

    function handleChange(e) {
         ToolsSettingsManager.saveSetting('autoFixSimpleCategoryMappings', e.target.checked);
    }

    return { init };
})();

// ============================================================
// Auto-Fix Complex Category Mappings Checkbox Setting
// ============================================================

const AutoFixComplexCategoryMappings = (() => {

    const checkboxSel = '#auto-fix-complex-categories-checkbox';

    function init(value) {
        waitForElementToExist(checkboxSel).then((el) => {
            el.checked = value;
            el.addEventListener('change', handleChange);
        });
    }

    function handleChange(e) {
         ToolsSettingsManager.saveSetting('autoFixComplexCategoryMappings', e.target.checked);
    }

    return { init };
})();

// ============================================================
// Auto-Add Parent Categories Checkbox Setting
// ============================================================

const AutoAddParentCategories = (() => {

    const checkboxSel = '#auto-add-parent-categories-checkbox';

    function init(value) {
        waitForElementToExist(checkboxSel).then((el) => {
            el.checked = value;
            el.addEventListener('change', handleChange);
        });
    }

    function handleChange(e) {
         ToolsSettingsManager.saveSetting('autoAddParentCategories', e.target.checked);
    }

    return { init };
})();

// ============================================================
// Auto-Decode HTML Entities Checkbox Setting
// ============================================================

const AutoDecodeHtmlEntities = (() => {

    const checkboxSel = '#auto-decode-html-entities-checkbox';

    function init(value) {
        waitForElementToExist(checkboxSel).then((el) => {
            el.checked = value;
            el.addEventListener('change', handleChange);
        });
    }

    function handleChange(e) {
         ToolsSettingsManager.saveSetting('autoDecodeHtmlEntities', e.target.checked);
    }

    return { init };
})();