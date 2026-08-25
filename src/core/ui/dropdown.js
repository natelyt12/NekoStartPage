import { Icons } from "/src/core/icon.js";

export function initSubsectionSvg(rootNode = document) {
    const sbsct_svgContainers = rootNode.querySelectorAll(".sbsctsvg");
    sbsct_svgContainers.forEach((container) => {
        if (container.children.length === 0) {
            container.innerHTML = Icons.chevronDown;
        }
    });

    const submenuButtons = rootNode.querySelectorAll(".submenu_button");
    submenuButtons.forEach((btn) => {
        if (!btn.querySelector(".sbsctsvg, svg:last-child:not(:first-child)")) {
            if (!btn.querySelector("span")) {
                const i18nKey = btn.getAttribute("data-i18n");
                const textContent = btn.innerHTML.trim();
                if (i18nKey) {
                    btn.innerHTML = `<span data-i18n="${i18nKey}">${textContent}</span>`;
                    btn.removeAttribute("data-i18n");
                } else if (textContent) {
                    btn.innerHTML = `<span>${textContent}</span>`;
                }
            }
            btn.insertAdjacentHTML('beforeend', Icons.chevronRight);
        }
    });
}

export function setDropdownValue(btn, value) {
    if (!btn) return;

    let dropdown = btn.nextElementSibling;
    while (dropdown && !dropdown.classList.contains("dropdown")) {
        dropdown = dropdown.nextElementSibling;
    }

    if (dropdown) {
        const item = dropdown.querySelector(`.dropdown_item[data-value="${value}"]`);
        const displaySpan = btn.querySelector(".selected_value");

        if (item && displaySpan) {
            displaySpan.textContent = item.textContent;

            if (item.hasAttribute("data-i18n")) {
                displaySpan.setAttribute("data-i18n", item.getAttribute("data-i18n"));
            } else {
                displaySpan.removeAttribute("data-i18n");
            }

            btn.setAttribute("data-selected", value);
        }
    }
}

function updateDropdownUI(dropdownId, value) {
    const btn = document.getElementById(dropdownId);
    setDropdownValue(btn, value);
}

export function initSubToggle() {
    document.addEventListener("mousedown", (event) => {
        const target = event.target;
        const isClickInsideDropdown = target.closest(".dropdown_wrapper");

        if (!isClickInsideDropdown) {
            document.querySelectorAll(".dropdown.opening").forEach((sub) => {
                sub.classList.remove("opening");
                setTimeout(() => {
                    if (!sub.classList.contains("opening")) {
                        sub.classList.remove("active", "open_upwards");
                    }
                }, 200);
                let controlBtn = sub.previousElementSibling;
                while (controlBtn && !controlBtn.classList.contains("dropdown_button")) {
                    controlBtn = controlBtn.previousElementSibling;
                }
                if (controlBtn) controlBtn.classList.remove("btn_active");
            });
        }

        const btn = target.closest(".dropdown_button");
        if (btn) {
            let dropdown = btn.nextElementSibling;
            while (dropdown && !dropdown.classList.contains("dropdown")) {
                dropdown = dropdown.nextElementSibling;
            }
            if (dropdown) {
                const wasOpening = dropdown.classList.contains("opening");

                document.querySelectorAll(".dropdown.opening").forEach((sub) => {
                    if (sub !== dropdown) {
                        sub.classList.remove("opening");
                        setTimeout(() => {
                            if (!sub.classList.contains("opening")) {
                                sub.classList.remove("active", "open_upwards");
                            }
                        }, 200);
                        let controlBtn = sub.previousElementSibling;
                        while (controlBtn && !controlBtn.classList.contains("dropdown_button")) {
                            controlBtn = controlBtn.previousElementSibling;
                        }
                        if (controlBtn) controlBtn.classList.remove("btn_active");
                    }
                });

                if (wasOpening) {
                    dropdown.classList.remove("opening");
                    btn.classList.remove("btn_active");
                    setTimeout(() => {
                        if (!dropdown.classList.contains("opening")) {
                            dropdown.classList.remove("active", "open_upwards");
                        }
                    }, 200);
                } else {
                    dropdown.classList.add("active");
                    dropdown.offsetHeight;
                    dropdown.classList.add("opening");
                    btn.classList.add("btn_active");

                    const rect = btn.getBoundingClientRect();
                    const scrollParent = btn.closest('.popup_content, #settings_content') || document.body;
                    const parentRect = scrollParent === document.body ? { top: 0, bottom: window.innerHeight } : scrollParent.getBoundingClientRect();

                    if (parentRect.bottom - rect.bottom < 250 && rect.top - parentRect.top > 200) {
                        dropdown.classList.add("open_upwards");
                    } else {
                        dropdown.classList.remove("open_upwards");
                    }
                }
            }
            return;
        }

        const item = target.closest(".dropdown_item");
        if (item) {
            const dropdown = item.closest(".dropdown");
            let controlBtn = dropdown.previousElementSibling;
            while (controlBtn && !controlBtn.classList.contains("dropdown_button")) {
                controlBtn = controlBtn.previousElementSibling;
            }

            if (controlBtn) {
                const value = item.getAttribute("data-value");
                const id = controlBtn.id;

                const changeEvent = new CustomEvent("dropdownChange", {
                    bubbles: true,
                    detail: { id: id, value: value },
                });
                document.dispatchEvent(changeEvent);

                dropdown.classList.remove("opening");
                controlBtn.classList.remove("btn_active");
                setTimeout(() => {
                    if (!dropdown.classList.contains("opening")) {
                        dropdown.classList.remove("active", "open_upwards");
                    }
                }, 200);
            }
        }
    });

    document.addEventListener("dropdownChange", (e) => {
        const { id, value } = e.detail;
        if (id && value !== undefined && value !== null) {
            updateDropdownUI(id, value);
        }
    });
}
