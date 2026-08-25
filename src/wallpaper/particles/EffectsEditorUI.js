import { openSidebarSubmenu, setSubmenuDirty, showNotification, createSlider } from "/src/core/ui.js";
import { t, translateDOM } from "/src/core/i18n.js";
import { getSettings, saveSettings } from "/src/core/storageHandler.js";
import { Icons, renderIcons } from "/src/core/icon.js";
import { DYNAMIC_EFFECTS, STATIC_EFFECTS, ALL_EFFECTS } from "./registry.js";
import { EffectsEngine } from "./EffectsEngine.js";

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ==========================================
// EFFECTS EDITOR UI — 2-block stacked, Submenu-based
// ==========================================
export class EffectsEditorUI {
    constructor(engine) {
        this.engine = engine;
        this.isDirty = false;
        this.workingState = null;
        this.columnLists = {};
        this._closeDropdown = null;
    }

    initialize() {
        const editBtn = document.getElementById("edit_particles_settings");
        if (editBtn) {
            editBtn.addEventListener("mousedown", () => this.openEditor());
        }
    }

    openEditor() {
        const template = document.getElementById("tpl_particles_settings");
        if (!template) return;

        const saved = getSettings().particles || { enabled: true, dynamicEnabled: false, staticEnabled: false, dynamic: [], static: [] };
        this.workingState = JSON.parse(JSON.stringify({
            dynamic: saved.dynamic || [],
            static: saved.static || [],
            dynamicEnabled: saved.dynamicEnabled === true,
            staticEnabled: saved.staticEnabled === true,
        }));
        this.isDirty = false;
        this.columnLists = {};
        this.columns = {};

        this.clone = template.content.cloneNode(true);
        translateDOM(this.clone);

        const columnsContainer = this.clone.querySelector("#particles_columns");
        if (columnsContainer) {
            columnsContainer.innerHTML = "";
            columnsContainer.appendChild(this._buildColumn("dynamic", "particles.wallpaper_layer"));
            columnsContainer.appendChild(this._buildColumn("static", "particles.screen_layer"));
        }

        const btnClearAll = this.clone.querySelector("#btn_clear_all");
        if (btnClearAll) {
            btnClearAll.addEventListener("mousedown", () => this._handleReset());
        }

        const btnSave = this.clone.querySelector("#btn_save");
        if (btnSave) {
            btnSave.addEventListener("mousedown", () => this._handleSave());
        }

        const windowTitle = t("sp.wallpaper_customization.particles_settings");
        openSidebarSubmenu(windowTitle, this.clone, {
            width: "500px",
            canPreview: true,
            isDirty: () => this.isDirty,
            onCancel: () => {
                if (this.isDirty) {
                    const savedData = getSettings().particles || { enabled: true, dynamicEnabled: false, staticEnabled: false, dynamic: [], static: [] };
                    this.engine.loadState(savedData);
                    this.isDirty = false;
                    setSubmenuDirty(false);
                }

                if (this._closeDropdown) {
                    document.removeEventListener("mousedown", this._closeDropdown);
                    this._closeDropdown = null;
                }
            }
        });

        // Close dropdowns when clicking outside
        if (this._closeDropdown) document.removeEventListener("mousedown", this._closeDropdown);
        this._closeDropdown = (e) => {
            if (!e.target.closest(".dropdown_wrapper")) {
                document.querySelectorAll(".dropdown.opening").forEach(d => {
                    d.classList.remove("opening");
                    setTimeout(() => {
                        d.classList.remove("active", "open_upwards");
                    }, 200);
                });
                document.querySelectorAll(".dropdown_button.btn_active").forEach(b => b.classList.remove("btn_active"));
            }
        };
        document.addEventListener("mousedown", this._closeDropdown);
    }

    // ── UI Building ──────────────────────────────

    _buildColumn(layer, i18nKey) {
        const col = document.createElement("div");
        col.className = "effects_column";

        const title = document.createElement("h4");
        title.className = "effects_column_title";
        title.setAttribute("data-i18n", i18nKey);
        title.textContent = t(i18nKey);

        const list = document.createElement("div");
        list.className = "effects_list";
        this.columnLists[layer] = list;

        col.append(title, this._buildAddArea(layer, list), list);
        this._refreshList(layer);

        return col;
    }

    _buildAddArea(layer, list) {
        const area = document.createElement("div");
        area.className = "dropdown_wrapper";

        const btn = document.createElement("button");
        btn.className = "dropdown_button";

        const iconI = document.createElement("i");
        iconI.setAttribute("data-icon", "plus");

        const textSpan = document.createElement("span");
        textSpan.className = "selected_value";
        textSpan.setAttribute("data-i18n", "particles.add_effect");
        textSpan.textContent = t("particles.add_effect") || "Thêm hiệu ứng";

        const svgDiv = document.createElement("div");
        svgDiv.className = "sbsctsvg";
        svgDiv.innerHTML = Icons.chevronDown;

        btn.append(iconI, textSpan, svgDiv);
        renderIcons(btn);

        const dropdown = document.createElement("div");
        dropdown.className = "dropdown";

        const registry = layer === "static" ? STATIC_EFFECTS : DYNAMIC_EFFECTS;
        for (const [type] of Object.entries(registry)) {
            const item = document.createElement("button");
            item.className = "dropdown_item";
            item.textContent = t(`particles.${type}.label`) || type;
            item.onmousedown = (e) => {
                e.stopPropagation();
                this._addEffect(layer, type, list);
                dropdown.classList.remove("opening");
                setTimeout(() => {
                    dropdown.classList.remove("active", "open_upwards");
                }, 200);
                btn.classList.remove("btn_active");
            };
            dropdown.appendChild(item);
        }

        btn.onmousedown = (e) => {
            e.stopPropagation();
            const wasOpening = dropdown.classList.contains("opening");

            document.querySelectorAll(".dropdown.opening").forEach((sub) => {
                sub.classList.remove("opening");
                setTimeout(() => {
                    if (!sub.classList.contains("opening")) {
                        sub.classList.remove("active", "open_upwards");
                    }
                }, 200);
            });

            if (!wasOpening) {
                dropdown.classList.add("active");
                dropdown.offsetHeight; // Force reflow to trigger opening transition
                dropdown.classList.add("opening");
                btn.classList.add("btn_active");
            } else {
                dropdown.classList.remove("opening");
                setTimeout(() => {
                    dropdown.classList.remove("active", "open_upwards");
                }, 200);
                btn.classList.remove("btn_active");
            }
        };

        area.append(btn, dropdown);
        return area;
    }

    _buildEffectCard(effectData, layer) {
        const card = document.createElement("div");
        card.className = "effect_card";
        if (effectData.enabled === false) {
            card.classList.add("effect_disabled");
        }

        // Header row
        const header = document.createElement("div");
        header.className = "effect_card_header";

        const nameEl = document.createElement("span");
        nameEl.className = "effect_card_name";
        nameEl.textContent = t(`particles.${effectData.type}.label`) || effectData.type;

        // Individual effect toggle switch
        const toggleLabel = document.createElement("label");
        toggleLabel.className = "checkbox";
        toggleLabel.style.margin = "0 4px";
        toggleLabel.style.width = "auto";
        toggleLabel.style.flex = "none";

        const toggleInput = document.createElement("input");
        toggleInput.type = "checkbox";
        toggleInput.checked = effectData.enabled !== false;

        const track = document.createElement("div");
        track.className = "ts-track";
        track.style.width = "28px";
        track.style.height = "16px";
        track.style.borderRadius = "16px";

        const thumb = document.createElement("div");
        thumb.className = "ts-thumb";
        thumb.style.width = "10px";
        thumb.style.height = "10px";
        thumb.style.top = "2px";
        thumb.style.left = "2px";

        const updateToggleStyle = (checked) => {
            if (checked) {
                thumb.style.transform = "translateX(12px)";
                track.style.background = "rgba(255, 255, 255, 0.35)";
            } else {
                thumb.style.transform = "translateX(0px)";
                track.style.background = "rgba(255, 255, 255, 0.1)";
            }
        };

        updateToggleStyle(toggleInput.checked);

        toggleInput.onchange = (e) => {
            const newState = e.target.checked;
            effectData.enabled = newState;
            this.isDirty = true;
            setSubmenuDirty(true);
            updateToggleStyle(newState);
            if (newState) {
                this.engine.addEffect(effectData.id, layer, effectData.type, effectData.config);
                const arr = this.workingState[layer];
                this.engine.reorderLayers(layer, arr.map(w => w.id));
                card.classList.remove("effect_disabled");
            } else {
                this.engine.removeEffect(effectData.id, layer);
                card.classList.add("effect_disabled");
            }
        };

        track.appendChild(thumb);
        toggleLabel.append(toggleInput, track);

        const controls = document.createElement("div");
        controls.className = "effect_card_controls";

        const makeBtn = (content, handler) => {
            const b = document.createElement("button");
            b.innerHTML = content;
            b.onmousedown = (e) => {
                e.stopPropagation();
                handler(e);
            };
            return b;
        };

        const btnUp = makeBtn(Icons.particleUp, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx <= 0) return;
            [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
            this.engine.reorderEffect(effectData.id, layer, "up");
            this._refreshList(layer);
            this.isDirty = true;
            setSubmenuDirty(true);
        });

        const btnDown = makeBtn(Icons.particleDown, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx < 0 || idx >= arr.length - 1) return;
            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
            this.engine.reorderEffect(effectData.id, layer, "down");
            this._refreshList(layer);
            this.isDirty = true;
            setSubmenuDirty(true);
        });

        // Inline Drawer for Sliders
        const drawer = document.createElement("div");
        drawer.className = "effect_card_drawer";

        const drawerContent = document.createElement("div");
        drawerContent.className = "effect_card_drawer_content";

        const EffectClass = ALL_EFFECTS[effectData.type];
        const specs = EffectClass?.getSettingsSpec() || [];

        const sliders = {};
        specs.forEach(spec => {
            const initialVal = effectData.config[spec.key] ?? spec.defaultValue;
            const sliderComponent = createSlider({
                label: spec.label,
                min: spec.min,
                max: spec.max,
                step: spec.step,
                value: initialVal,
                defaultValue: spec.defaultValue ?? (EffectClass.DEFAULTS?.[spec.key]),
                unit: spec.unit,
                onChange: (val) => {
                    effectData.config[spec.key] = val;
                    this.engine.updateEffectConfig(effectData.id, layer, { [spec.key]: val });
                    this.isDirty = true;
                    setSubmenuDirty(true);
                }
            });
            drawerContent.appendChild(sliderComponent);
            sliders[spec.key] = sliderComponent;
        });

        // Action row inside drawer: Reset to Defaults
        const drawerActions = document.createElement("div");
        drawerActions.style.display = "flex";
        drawerActions.style.justifyContent = "flex-end";
        drawerActions.style.marginTop = "4px";

        const btnResetEffect = document.createElement("button");
        btnResetEffect.textContent = t("particles.btn_reset_effect");
        btnResetEffect.onmousedown = (e) => {
            e.stopPropagation();
            const defaults = { ...(EffectClass.DEFAULTS || {}) };

            for (const [key, val] of Object.entries(defaults)) {
                if (sliders[key]) {
                    sliders[key].value = val;
                }
                effectData.config[key] = val;
            }
            this.engine.updateEffectConfig(effectData.id, layer, defaults);
            this.isDirty = true;
            setSubmenuDirty(true);
            showNotification(t("particles.reset_success"), "success");
        };

        drawerActions.appendChild(btnResetEffect);
        drawerContent.appendChild(drawerActions);
        drawer.appendChild(drawerContent);

        // Gear icon button to toggle drawer expansion
        const btnSettings = makeBtn(Icons.particleSettings, () => {
            const isOpen = drawer.classList.toggle("open");
            if (isOpen) {
                btnSettings.classList.add("active");
            } else {
                btnSettings.classList.remove("active");
            }
        });

        const btnDelete = makeBtn(Icons.particleDelete, () => {
            const arr = this.workingState[layer];
            const idx = arr.findIndex(e => e.id === effectData.id);
            if (idx >= 0) arr.splice(idx, 1);
            this.engine.removeEffect(effectData.id, layer);
            this._refreshList(layer);
            this.isDirty = true;
            setSubmenuDirty(true);
        });

        controls.append(btnUp, btnDown, btnSettings, toggleLabel, btnDelete);
        header.append(nameEl, controls);
        card.append(header, drawer);

        return card;
    }

    // ── Actions ──────────────────────────────────

    _addEffect(layer, type, list) {
        const arr = this.workingState[layer];
        if (arr.length >= EffectsEngine.MAX_PER_LAYER) {
            showNotification(t("particles.max_effects_reached"), "warning");
            return;
        }
        if (arr.some(e => e.type === type)) {
            showNotification(t("particles.effect_already_exists") || "Hiệu ứng này đã được thêm rồi", "warning");
            return;
        }
        const id = genId();
        const EffectClass = ALL_EFFECTS[type];
        const config = { ...(EffectClass.DEFAULTS || {}) };
        const effectData = { id, type, config };

        arr.push(effectData);
        this.engine.addEffect(id, layer, type, config);
        this._refreshList(layer);
        this.isDirty = true;
        setSubmenuDirty(true);
    }

    _refreshList(layer) {
        const list = this.columnLists[layer];
        if (!list) return;
        list.innerHTML = "";
        const effects = this.workingState[layer] || [];

        if (effects.length === 0) {
            const placeholder = document.createElement("div");
            placeholder.className = "effects_placeholder";
            placeholder.setAttribute("data-i18n", "particles.no_effects");
            placeholder.textContent = t("particles.no_effects");
            list.appendChild(placeholder);
        } else {
            effects.forEach(e =>
                list.appendChild(this._buildEffectCard(e, layer))
            );
        }
    }

    _handleReset() {
        this.engine.stopAll();
        this.workingState.dynamic = [];
        this.workingState.static = [];
        this._refreshList("dynamic");
        this._refreshList("static");
        this.isDirty = true;
        setSubmenuDirty(true);
        showNotification(t("particles.clear_all_success"), "success");
    }

    _handleSave() {
        const current = getSettings().particles || { enabled: true };
        current.dynamic = this.workingState.dynamic;
        current.static = this.workingState.static;
        current.enabled = true;
        saveSettings({ particles: current });
        this.engine.loadState(current);

        showNotification(t("common.saved_changes"), "success");
        this.isDirty = false;
        setSubmenuDirty(false);
    }
}
