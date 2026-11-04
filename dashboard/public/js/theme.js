const THEME_STORAGE_KEY = 'darkMode';
const THEME_TRANSITION_DURATION = 300; // ms

const LIGHT_THEME = {
    'primary': '#777BC9',
    'background-primary': '#F9FAFB',
    'background-secondary': '#F3F4F6',
    'background-tertiary': '#E5E7EB',
    'text-primary': '#111827',
    'text-secondary': '#374151',
    'text-muted': '#6B7280',
    'border-color': 'rgba(229, 231, 235, 0.8)',
    'accent-color': '#777BC9',
    'accent-hover': '#9694E5',
    'danger-color': '#EF4444',
    'success-color': '#10B981'
};

const DARK_THEME = {
    'primary': '#777BC9',
    'background-primary': '#111827',
    'background-secondary': '#1F2937',
    'background-tertiary': '#374151',
    'text-primary': '#F3F4F6',
    'text-secondary': '#D1D5DB',
    'text-muted': '#9CA3AF',
    'border-color': 'rgba(55, 65, 81, 0.5)',
    'accent-color': '#777BC9',
    'accent-hover': '#9694E5',
    'danger-color': '#EF4444',
    'success-color': '#10B981'
};

function initTheme() {
    const themeToggles = document.querySelectorAll('.theme-toggle-control');
    if (!themeToggles.length) return;
    
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const isDark = savedTheme === 'true'
        || (savedTheme === null
            && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark);
    
    themeToggles.forEach(themeToggle => themeToggle.addEventListener('click', () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        setTheme(!isDarkMode);
        
        localStorage.setItem(THEME_STORAGE_KEY, (!isDarkMode).toString());
    }));
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (localStorage.getItem(THEME_STORAGE_KEY) === null) {
            setTheme(e.matches);
        }
    });
}

function setTheme(isDark) {
    document.querySelectorAll('.theme-toggle-control').forEach(themeToggle => {
        const icon = themeToggle.querySelector('i');
        const label = themeToggle.querySelector('span');

        if (isDark) {
            document.documentElement.classList.add('dark');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
            if (label) label.textContent = 'Light mode';
            themeToggle.setAttribute('aria-label', 'Switch to light mode');
            themeToggle.setAttribute('title', 'Switch to light mode');
            themeToggle.setAttribute('aria-pressed', 'true');
        } else {
            document.documentElement.classList.remove('dark');
            if (icon) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            }
            if (label) label.textContent = 'Dark mode';
            themeToggle.setAttribute('aria-label', 'Switch to dark mode');
            themeToggle.setAttribute('title', 'Switch to dark mode');
            themeToggle.setAttribute('aria-pressed', 'false');
        }
    });

    if (isDark) {
        document.documentElement.classList.add('dark');
        applyThemeColors(DARK_THEME);
    } else {
        document.documentElement.classList.remove('dark');
        applyThemeColors(LIGHT_THEME);
    }
    
    const event = new CustomEvent('themeChanged', { detail: { isDark } });
    document.dispatchEvent(event);
}

function applyThemeColors(colors) {
    const root = document.documentElement;
    
    Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });
}

document.addEventListener('DOMContentLoaded', initTheme);

window.themeManager = {
    setTheme,
    isDarkMode: () => document.documentElement.classList.contains('dark'),
    toggleTheme: () => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(!isDark);
        localStorage.setItem(THEME_STORAGE_KEY, (!isDark).toString());
    }
};

(function() {
    const savedTheme = localStorage.getItem('darkMode');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'true') {
        document.documentElement.classList.add('dark');
    } else if (savedTheme === 'false') {
        document.documentElement.classList.remove('dark');
    } else if (systemPrefersDark) {
        document.documentElement.classList.add('dark');
    }
})();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    const savedTheme = localStorage.getItem('darkMode');
    
    if (!savedTheme) {
        if (e.matches) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
}); 
