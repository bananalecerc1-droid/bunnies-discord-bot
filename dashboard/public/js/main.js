document.addEventListener('DOMContentLoaded', () => {
    setupServerActivityTooltips();
    initializeUI();
    
    setupLanguageSelector();
    
    initializePage();
    
    setupGlobalEvents();
    
    addSafeInitializeHelper();
});

function addSafeInitializeHelper() {
    if (window.utils) {
        window.utils.safelyInitialize = function(elementSelector, initFunction) {
            const element = typeof elementSelector === 'string' 
                ? document.querySelector(elementSelector) 
                : elementSelector;
                
            if (element) {
                return initFunction(element);
            }
            return false;
        };
        
        window.utils.onPage = function(pagePath, callback) {
            const currentPath = window.location.pathname;
            const matches = typeof pagePath === 'string' 
                ? currentPath === pagePath
                : pagePath.test(currentPath);
                
            if (matches) {
                callback();
                return true;
            }
            return false;
        };
    }
}

function initializeUI() {
    document.querySelectorAll('.card').forEach(card => {
        card.classList.add('animate-slide-in');
    });

    document.querySelectorAll('button, a').forEach(element => {
        if (!element.classList.contains('nav-link')) {
            element.classList.add('hover-pulse');
        }
    });

    initializeTooltips();
    
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        const filterTarget = searchInput.dataset.filterTarget || '.searchable-item';
        utils.initSearchFilter(searchInput, filterTarget);
    }
    
    initializeMobileUI();
    initializeCustomSelects();
    initializeCustomMultiSelects();
    observeCustomMultiSelects();
    
    setupMobileMenu();
    
    setupTouchHandling();
}

function getOptionColor(option) {
    const rawColor = option.dataset.roleColor || option.style.color;
    if (!rawColor) return '#99aab5';

    const color = String(rawColor).trim();
    if (/^\d+$/.test(color)) {
        const numericColor = Number(color);
        return numericColor > 0
            ? `#${numericColor.toString(16).padStart(6, '0')}`
            : '#99aab5';
    }

    return color;
}

function initializeCustomSelects() {
    // Multi-selects are populated dynamically and need to keep their native
    // option list so selected roles/channels remain visible and accessible.
    const selects = document.querySelectorAll('select:not(#languageSelect):not([data-native-select]):not([multiple])');
    if (!selects.length) return;

    selects.forEach((select) => {
        if (select.closest('.custom-select')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select';
        wrapper.dataset.customSelect = 'true';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        select.classList.add('custom-select-native');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const menu = document.createElement('div');
        menu.className = 'custom-select-menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;

        const syncValue = () => {
            const selected = select.options[select.selectedIndex];
            trigger.innerHTML = `<span>${selected?.textContent || ''}</span><i class="fas fa-chevron-down" aria-hidden="true"></i>`;
            menu.querySelectorAll('[role="option"]').forEach((option) => {
                const isSelected = option.dataset.value === select.value;
                option.classList.toggle('is-selected', isSelected);
                option.setAttribute('aria-selected', String(isSelected));
            });
        };

        const renderOptions = () => {
            menu.innerHTML = '';
            Array.from(select.options).forEach((option) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'custom-select-option';
                item.dataset.value = option.value;
                item.setAttribute('role', 'option');
                if (option.dataset.roleColor) {
                    const marker = document.createElement('span');
                    marker.className = 'custom-select-marker';
                    marker.style.setProperty('--role-color', getOptionColor(option));
                    marker.setAttribute('aria-hidden', 'true');
                    item.append(marker, document.createTextNode(option.textContent.trim()));
                } else {
                    item.textContent = option.textContent;
                }
                item.addEventListener('click', () => {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    syncValue();
                    closeCustomSelect(wrapper);
                });
                menu.appendChild(item);
            });
            syncValue();
        };

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = wrapper.classList.contains('is-open');
            closeAllCustomDropdowns(wrapper);
            if (!isOpen) {
                wrapper.classList.add('is-open');
                menu.hidden = false;
                trigger.setAttribute('aria-expanded', 'true');
            }
        });

        trigger.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeCustomSelect(wrapper);
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                trigger.click();
            }
        });

        select.addEventListener('change', syncValue);
        wrapper.append(trigger, menu);
        renderOptions();

        if (window.MutationObserver) {
            const observer = new MutationObserver(renderOptions);
            observer.observe(select, { childList: true, subtree: true });
        }
    });

    document.documentElement.classList.add('custom-selects-ready');

    if (!window.customSelectDocumentHandler) {
        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select.is-open').forEach(closeCustomSelect);
        });
        window.customSelectDocumentHandler = true;
    }
}

window.initializeCustomSelects = initializeCustomSelects;

function closeCustomSelect(wrapper) {
    wrapper.classList.remove('is-open');
    const trigger = wrapper.querySelector('.custom-select-trigger, .custom-multi-select-trigger');
    const menu = wrapper.querySelector('.custom-select-menu, .custom-multi-select-list');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
}

function closeAllCustomDropdowns(exceptWrapper = null) {
    document.querySelectorAll('.custom-select.is-open, .custom-multi-select.is-open')
        .forEach(wrapper => {
            if (wrapper !== exceptWrapper) closeCustomSelect(wrapper);
        });
}

function initializeCustomMultiSelects(root = document) {
    const selects = root.querySelectorAll('select[multiple]:not(.custom-multi-select-native)');
    if (!selects.length) return;

    selects.forEach(select => {
        select.classList.add('custom-multi-select-native');

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-multi-select';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-multi-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');

        const triggerValue = document.createElement('span');
        triggerValue.className = 'custom-multi-select-value';
        const triggerIcon = document.createElement('i');
        triggerIcon.className = 'fas fa-chevron-down custom-multi-select-chevron';
        triggerIcon.setAttribute('aria-hidden', 'true');
        trigger.append(triggerValue, triggerIcon);

        const list = document.createElement('div');
        list.className = 'custom-multi-select-list';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-multiselectable', 'true');
        list.setAttribute('aria-label', select.getAttribute('aria-label') || 'Select multiple options');
        list.hidden = true;

        let cards = [];

        function syncSelect() {
            const selected = cards.filter(({ option }) => option.selected);
            const selectedNames = selected.map(({ option }) => option.textContent.trim());

            if (!selectedNames.length) {
                triggerValue.textContent = 'Select roles';
                triggerValue.classList.add('is-placeholder');
            } else if (selectedNames.length === 1) {
                triggerValue.textContent = selectedNames[0];
                triggerValue.classList.remove('is-placeholder');
            } else {
                triggerValue.textContent = `${selectedNames.length} roles selected`;
                triggerValue.classList.remove('is-placeholder');
            }

            trigger.title = selectedNames.join(', ') || 'Select roles';
            cards.forEach(({ card, option }) => {
                const isSelected = option.selected;
                card.classList.toggle('is-selected', isSelected);
                card.setAttribute('aria-selected', String(isSelected));
            });
        }

        function renderOptions() {
            list.innerHTML = '';
            cards = Array.from(select.options).map((option, index) => {
                const card = document.createElement('button');
                const marker = document.createElement('span');
                const label = document.createElement('span');
                const check = document.createElement('span');

                card.type = 'button';
                card.className = 'custom-multi-select-option';
                card.dataset.value = option.value;
                card.setAttribute('role', 'option');
                card.setAttribute('tabindex', '0');
                card.style.setProperty('--role-color', getOptionColor(option));

                marker.className = 'custom-multi-select-marker';
                marker.setAttribute('aria-hidden', 'true');
                label.className = 'custom-multi-select-label';
                label.textContent = option.textContent.trim();
                check.className = 'custom-multi-select-check fas fa-check';
                check.setAttribute('aria-hidden', 'true');

                card.append(marker, label, check);
                card.style.setProperty('--option-index', index);

                const toggleOption = () => {
                    option.selected = !option.selected;
                    syncSelect();
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                };

                card.addEventListener('click', event => {
                    event.stopPropagation();
                    toggleOption();
                });
                card.addEventListener('keydown', event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleOption();
                    }
                });

                list.appendChild(card);
                return { card, option };
            });

            syncSelect();
        }

        const close = () => {
            closeCustomSelect(wrapper);
        };

        trigger.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = wrapper.classList.contains('is-open');
            closeAllCustomDropdowns(wrapper);

            wrapper.classList.toggle('is-open', !isOpen);
            trigger.setAttribute('aria-expanded', String(!isOpen));
            list.hidden = isOpen;
        });

        trigger.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                close();
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                trigger.click();
            }
        });

        select.addEventListener('change', syncSelect);
        wrapper.append(trigger, list);
        renderOptions();

        if (window.MutationObserver) {
            const observer = new MutationObserver(renderOptions);
            observer.observe(select, { childList: true, subtree: true });
        }
    });

    if (!window.customMultiSelectDocumentHandler) {
        document.addEventListener('click', event => {
            document.querySelectorAll('.custom-multi-select.is-open').forEach(wrapper => {
                if (!wrapper.contains(event.target)) {
                    closeCustomSelect(wrapper);
                }
            });
        });
        window.customMultiSelectDocumentHandler = true;
    }
}

function observeCustomMultiSelects() {
    if (window.customMultiSelectObserver || !window.MutationObserver) return;

    window.customMultiSelectObserver = new MutationObserver(() => {
        initializeCustomMultiSelects();
    });
    window.customMultiSelectObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

window.initializeCustomMultiSelects = initializeCustomMultiSelects;

function initializeMobileUI() {
    document.querySelectorAll('input, select, textarea').forEach(input => {
        if (!input.classList.contains('mobile-input') && 
            !input.classList.contains('mobile-select')) {
            
            if (input.tagName === 'SELECT') {
                input.classList.add('mobile-select');
            } else {
                input.classList.add('mobile-input');
            }
            
            input.addEventListener('focus', function() {
                this.classList.add('mobile-focus');
            });
            
            input.addEventListener('blur', function() {
                this.classList.remove('mobile-focus');
            });
        }
    });
    
    document.querySelectorAll('button:not(.mobile-nav-toggle), .btn').forEach(button => {
        button.classList.add('touch-friendly');
    });
}

function setupLanguageSelector() {
    const languageSelects = document.querySelectorAll('#languageSelect, #dropdownLanguageSelect');
    const mobileLangButton = document.getElementById('mobileLangButton');
    const mobileLangSelector = document.getElementById('mobileLangSelector');
    
    if (languageSelects.length) {
        languageSelects.forEach((languageSelect) => languageSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        }));
    }
    
    if (mobileLangButton && mobileLangSelector) {
        mobileLangButton.addEventListener('click', () => {
            mobileLangSelector.classList.toggle('translate-y-full');
            mobileLangSelector.classList.toggle('translate-y-0');
        });
        
        mobileLangSelector.querySelectorAll('a[data-lang]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = e.target.closest('a').dataset.lang;
                changeLanguage(lang);
            });
        });
    }
    
    if (document.documentElement.dir === 'rtl') {
        applyRtlAdjustments();
    }
}

function changeLanguage(lang) {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    
    document.cookie = `preferredLanguage=${lang}; max-age=${365 * 24 * 60 * 60}; path=/`;
    
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    document.querySelectorAll('#languageSelect, #dropdownLanguageSelect')
        .forEach((languageSelect) => { languageSelect.value = lang; });
    
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    
    setTimeout(() => {
        window.location.href = url.toString();
    }, 300);
}

function initializeTooltips() {
    const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
    
    tooltipTriggers.forEach(trigger => {
        const tooltipText = trigger.dataset.tooltip;
        const tooltipPosition = trigger.dataset.tooltipPosition || 'top';
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${tooltipPosition}`;
        tooltip.textContent = tooltipText;
        
        trigger.addEventListener('mouseenter', () => {
            document.body.appendChild(tooltip);
            
            const triggerRect = trigger.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let top, left;
            
            switch (tooltipPosition) {
                case 'top':
                    top = triggerRect.top - tooltipRect.height - 10;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = triggerRect.bottom + 10;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.left - tooltipRect.width - 10;
                    break;
                case 'right':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.right + 10;
                    break;
            }
            
            tooltip.style.top = `${top + window.scrollY}px`;
            tooltip.style.left = `${left + window.scrollX}px`;
            
            setTimeout(() => {
                tooltip.classList.add('show');
            }, 10);
        });
        
        trigger.addEventListener('mouseleave', () => {
            const activeTooltip = document.querySelector('.tooltip.show');
            if (activeTooltip) {
                activeTooltip.classList.remove('show');
                setTimeout(() => {
                    activeTooltip.remove();
                }, 200);
            }
        });
    });
}

function setupGlobalEvents() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
            e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth'
                });
        }
    });
});

    const saveBar = document.getElementById('saveBar');
    if (saveBar) {
        document.querySelectorAll('.settings-trigger').forEach(element => {
            element.addEventListener('change', () => {
                saveBar.classList.add('show');
            });
        });
        
        const resetButton = document.getElementById('resetSettings');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                saveBar.classList.remove('show');
                utils.showToast('success', 'Settings reset to defaults');
            });
        }
    }
    
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const textToCopy = btn.dataset.copyText || btn.parentElement.textContent.trim();
            utils.copyToClipboard(textToCopy);
        });
    });
}

function initializePage() {
    console.log('Initializing page...');
    
    setupDarkMode();
    
    setupMobileMenu();
    
    initializeUI();
    
    setupLanguageSelector();
    
    setupRefreshStats();
    
    if (window.location.pathname === '/') {
        setupDashboard();
    }
    
    setupDropdowns();
}

function setupSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const navLinks = sidebar.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.classList.add('hover');
        });
        
        link.addEventListener('mouseleave', () => {
            link.classList.remove('hover');
        });
    });
    
    const sectionTitles = sidebar.querySelectorAll('.nav-section-title');
    sectionTitles.forEach(title => {
        title.addEventListener('click', () => {
            const section = title.closest('.nav-section');
            if (section) {
                const links = section.querySelector('.nav-links');
                if (links) {
                    links.classList.toggle('hidden');
                    title.classList.toggle('collapsed');
                }
            }
        });
    });
}

function setupDarkMode() {
    const themeToggle = document.getElementById('themeToggle');

    // theme.js owns the click handler and persisted theme state. Keep this
    // initializer as a presence check so the control is not toggled twice.
    if (window.themeManager && themeToggle) {
        console.log('Theme toggle available through themeManager');
    }
}

function applyThemeAdjustments() {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    document.querySelectorAll('[data-theme-adjust]').forEach(el => {
        if (isDarkMode) {
            el.classList.add('dark-theme');
            el.classList.remove('light-theme');
        } else {
            el.classList.add('light-theme');
            el.classList.remove('dark-theme');
        }
    });
    
    document.dispatchEvent(new CustomEvent('themeChanged', { 
        detail: { isDarkMode } 
    }));
}

function setupServerActivityTooltips() {
    const bars = document.querySelectorAll('.activity-bar');
    bars.forEach(bar => {
        bar.addEventListener('mouseenter', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'server-activity-tooltip';
            tooltip.textContent = `${bar.dataset.count || 0} messages · ${bar.dataset.label || ''}`;
            document.body.appendChild(tooltip);
            const rect = bar.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 10}px`;
            bar._activityTooltip = tooltip;
        });
        bar.addEventListener('mouseleave', () => {
            bar._activityTooltip?.remove();
            bar._activityTooltip = null;
        });
    });
}

function setupRefreshStats() {
    const refreshBtn = document.getElementById('refresh-stats');
    if (!refreshBtn) return;
    
    refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('animate-spin');
        
        fetch('/api/dashboard/stats')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    updateDashboardStats(data.stats);
                    const timestamp = new Date().toLocaleTimeString();
                    document.getElementById('last-update').textContent = `Updated ${timestamp}`;
        } else {
                    console.error('Failed to fetch stats:', data.error);
        }
    })
    .catch(error => {
                console.error('Error refreshing stats:', error);
            })
            .finally(() => {
                refreshBtn.classList.remove('animate-spin');
            });
    });
}

function setupMobileMenu() {
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const sidebar = document.querySelector('.sidebar');
    
    if (!mobileNavToggle || !mobileNavOverlay || !sidebar) {
        console.warn('Mobile navigation elements not found. Mobile menu will not function correctly.');
        return;
    }
    
    console.log('Setting up mobile menu handlers');
    
    sidebar.classList.add('animate-mobile');
    
    sidebar.style.transform = 'translateZ(0)';
    sidebar.style.webkitTransform = 'translateZ(0)';
    sidebar.style.backfaceVisibility = 'hidden';
    sidebar.style.perspective = '1000';
    
    const sidebarContent = sidebar.querySelector('.sidebar-content');
    if (sidebarContent) {
        sidebarContent.style.position = 'relative';
        sidebarContent.style.zIndex = '5';
    }
    
    const allClickableElements = sidebar.querySelectorAll('a, button');
    console.log('Found clickable elements:', allClickableElements.length);
    
    allClickableElements.forEach((element, index) => {
        if (element.id === 'themeToggle') {
            element.setAttribute('data-mobile-enhanced', 'true');
            element.setAttribute('data-element-index', index);
            
            element.style.cursor = 'pointer';
            element.style.touchAction = 'manipulation';
            element.style.webkitTapHighlightColor = 'transparent';
            element.style.position = 'relative';
            element.style.zIndex = '10';

            // theme.js owns the click handler. Adding another handler here
            // makes one click switch twice on pages that load both scripts.
            return;
        }
        
        const clone = element.cloneNode(true);
        
        clone.style.cursor = 'pointer';
        clone.style.touchAction = 'manipulation';
        clone.style.webkitTapHighlightColor = 'transparent';
        clone.style.position = 'relative';
        clone.style.zIndex = '10';
        
        element.parentNode.replaceChild(clone, element);
        
        clone.setAttribute('data-mobile-enhanced', 'true');
        clone.setAttribute('data-element-index', index);
        
        ['click', 'touchend'].forEach(eventType => {
            clone.addEventListener(eventType, (e) => {
                e.stopPropagation();
                
                console.log(`Sidebar element ${eventType}:`, clone.textContent, 'index:', index);
                
                if (clone.tagName === 'A' && clone.href) {
                    if (window.innerWidth <= 992 && sidebar.classList.contains('show')) {
                        setTimeout(() => toggleMobileNav(), 10);
                        
                        const targetUrl = clone.href;
                        setTimeout(() => {
                            console.log('Navigating to:', targetUrl);
                            window.location.href = targetUrl;
                        }, 300);
                        
                        if (eventType === 'click') {
                            e.preventDefault();
                        }
                    }
                }
            }, { capture: true, passive: false });
        });
    });
    
    function toggleMobileNav() {
        console.log('Toggling mobile navigation');
        
        sidebar.classList.toggle('show');
        mobileNavOverlay.classList.toggle('show');
        
        const isExpanded = sidebar.classList.contains('show');
        mobileNavToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        
        document.body.classList.toggle('overflow-hidden');
        
        if (isExpanded) {
            sidebar.style.visibility = 'visible';
            sidebar.style.transform = 'translateX(0) translateZ(0)';
            sidebar.style.webkitTransform = 'translateX(0) translateZ(0)';
            
            const allLinks = sidebar.querySelectorAll('a, button');
            allLinks.forEach(link => {
                link.style.pointerEvents = 'auto';
                link.style.position = 'relative';
                link.style.zIndex = '10';
                
                if (window.location.search.includes('debug')) {
                    link.style.border = '1px solid red';
                }
            });
            
            sidebar.offsetWidth;
        } else {
            sidebar.style.transform = 'translateX(-100%) translateZ(0)';
            sidebar.style.webkitTransform = 'translateX(-100%) translateZ(0)';
            
            setTimeout(() => {
                if (!sidebar.classList.contains('show')) {
                    sidebar.style.visibility = 'hidden';
                }
            }, 300);
        }
        
        const icon = mobileNavToggle.querySelector('i');
        if (icon) {
            if (sidebar.classList.contains('show')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    }
    
    mobileNavToggle.addEventListener('click', toggleMobileNav);
    mobileNavOverlay.addEventListener('click', toggleMobileNav);
    
    const sidebarLinks = sidebar.querySelectorAll('a.nav-link');
    sidebarLinks.forEach(link => {
        link.style.pointerEvents = 'auto';
        link.style.position = 'relative';
        link.style.zIndex = '15';
        
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && sidebar.classList.contains('show')) {
                console.log('Nav link clicked:', link.textContent);
                
                if (!e.defaultPrevented) {
                    toggleMobileNav();
                }
            }
        });
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 992 && sidebar.classList.contains('show')) {
            toggleMobileNav();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            toggleMobileNav();
        }
    });
}

function setupDropdowns() {
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    
    dropdownToggles.forEach(toggle => {
        const dropdown = toggle.nextElementSibling;
        if (!dropdown || !dropdown.classList.contains('dropdown-content')) return;
        
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            document.querySelectorAll('.dropdown-content.show').forEach(open => {
                if (open !== dropdown) {
                    open.classList.remove('show');
                }
            });
            
            dropdown.classList.toggle('show');
        });
    });
    
    document.addEventListener('click', (e) => {
        const dropdowns = document.querySelectorAll('.dropdown-content.show');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target) && 
                !dropdown.previousElementSibling.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    });
}

function setupDashboard() {
    console.log('Setting up dashboard...');
    
}

function initializeCounters() {
    document.querySelectorAll('.stat-value').forEach(counter => {
        const target = parseFloat(counter.textContent) || 0;
        let current = 0;
        const increment = target / 20;
        
        counter.textContent = '0';
        
        const updateCounter = () => {
            current += increment;
            if (current > target) {
                current = target;
            }
            
            counter.textContent = Number.isInteger(target) ? 
                Math.floor(current).toString() : 
                current.toFixed(1);
                
            if (current < target) {
                requestAnimationFrame(updateCounter);
            }
        };
        
        requestAnimationFrame(updateCounter);
    });
}

function showToast(title, message, type) {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 max-w-sm bg-white dark:bg-gray-800 border-l-4 shadow-md p-4 
                       ${type === 'success' ? 'border-green-500' : 'border-red-500'} 
                       rounded-r-lg z-50 animate-fade-in`;
    
    toast.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0">
                ${type === 'success' 
                    ? '<i class="fas fa-check-circle text-green-500 text-lg"></i>' 
                    : '<i class="fas fa-exclamation-circle text-red-500 text-lg"></i>'}
            </div>
            <div class="ml-3">
                <p class="text-sm font-medium text-gray-900 dark:text-white">${title}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${message}</p>
            </div>
            <div class="ml-auto pl-3">
                <button class="text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    toast.querySelector('button').addEventListener('click', function() {
        toast.classList.add('animate-fade-out');
                setTimeout(() => {
            document.body.removeChild(toast);
                }, 300);
            });
    
    setTimeout(() => {
        if (document.body.contains(toast)) {
            toast.classList.add('animate-fade-out');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }
    }, 3000);
}

function applyRtlAdjustments() {
    document.body.classList.add('rtl');
    
    document.querySelectorAll('.ml-auto').forEach(el => {
        el.classList.remove('ml-auto');
        el.classList.add('mr-auto');
    });
    
    document.querySelectorAll('.flex.space-x-2, .flex.space-x-3, .flex.space-x-4').forEach(el => {
        el.style.flexDirection = 'row-reverse';
    });
    
    document.querySelectorAll('.fa-chevron-right').forEach(el => {
        el.classList.remove('fa-chevron-right');
        el.classList.add('fa-chevron-left');
    });
}

function updateDashboardStats(stats) {
    const pingElement = document.querySelector('[data-stat="ping"]');
    if (pingElement) {
        pingElement.textContent = 'Ping: ' + stats.ping + 'ms';
    }
    
    const memoryElement = document.querySelector('[data-stat="memory"]');
    if (memoryElement) {
        memoryElement.textContent = 'Memory: ' + stats.memoryUsage + ' MB';
    }
    
    const serversElement = document.querySelector('[data-stat-type="servers"]');
    if (serversElement) {
        const countElement = serversElement.querySelector('.animate-count');
        if (countElement) countElement.textContent = stats.servers;
    }
    
    const usersElement = document.querySelector('[data-stat-type="users"]');
    if (usersElement) {
        const countElement = usersElement.querySelector('.animate-count');
        if (countElement) countElement.textContent = stats.users;
    }
    
    const commandsElement = document.querySelector('[data-stat-type="commands"]');
    if (commandsElement) {
        const countElement = commandsElement.querySelector('.animate-count');
        if (countElement) countElement.textContent = stats.commands;
    }
    
    if (stats.protection) {
        document.getElementById('activeProtections').textContent = 
            stats.protection.activeProtections;
        document.getElementById('totalRoles').textContent = 
            stats.protection.protectedRoles;
        document.getElementById('whitelistedBots').textContent = 
            stats.protection.whitelistedBots;
        document.getElementById('blockedActions').textContent = 
            stats.protection.activeLogs;
    }
}

function setupTouchHandling() {
    if (typeof document === 'undefined' || !('ontouchstart' in window)) {
        return;
    }
    
    console.log('Setting up enhanced touch handling for mobile');
    
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const allLinks = sidebar.querySelectorAll('a, button');
    allLinks.forEach(link => {
        link.addEventListener('touchstart', function(e) {
            console.log('Touch start on element:', this.textContent?.trim());
            
            this.classList.add('touch-active');
            
            e.stopPropagation();
        }, { passive: true });
        
        link.addEventListener('touchend', function(e) {
            console.log('Touch end on element:', this.textContent?.trim());
            
            this.classList.remove('touch-active');
            
            if (this.tagName === 'A' && this.href && 
                window.innerWidth <= 992 && sidebar.classList.contains('show')) {
                
                console.log('Processing touch-based navigation');
                
                const targetUrl = this.href;
                
                const mobileNavToggle = document.getElementById('mobileNavToggle');
                if (mobileNavToggle) {
                    mobileNavToggle.click();
                } else {
                    sidebar.classList.remove('show');
                    const overlay = document.getElementById('mobileNavOverlay');
                    if (overlay) overlay.classList.remove('show');
                }
                
                setTimeout(() => {
                    window.location.href = targetUrl;
                }, 300);
                
                e.preventDefault();
            }
        }, { passive: false });
    });
    
    sidebar.addEventListener('touchstart', function(e) {
        console.log('Sidebar touch start at:', e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
}
