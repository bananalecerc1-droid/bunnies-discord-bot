

const TOAST_DURATION = 3000; // ms
const TOAST_ANIMATION_DURATION = 300; // ms


function showToast(type, message, duration = TOAST_DURATION) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, TOAST_ANIMATION_DURATION);
    }, duration);
}


function formatDate(date, includeTime = true) {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return d.toLocaleDateString(undefined, options);
}


async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('success', 'Copied to clipboard!');
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('error', 'Failed to copy to clipboard');
        return false;
    }
}

function initSearchFilter(searchInput, itemSelector, matcher) {
    if (!searchInput) return;
    
    searchInput.addEventListener('input', () => {
        const searchText = searchInput.value.toLowerCase().trim();
        const items = document.querySelectorAll(itemSelector);
        
        items.forEach(item => {
            if (searchText === '') {
                item.style.display = '';
                return;
            }
            
            const shouldShow = matcher 
                ? matcher(item, searchText)
                : item.textContent.toLowerCase().includes(searchText);
                
            item.style.display = shouldShow ? '' : 'none';
        });
    });
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function formToJson(form) {
    const formData = new FormData(form);
    const data = {};
    
    for (const [key, value] of formData.entries()) {
        if (data[key] !== undefined) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }
    
    return data;
}

async function apiRequest(url, options = {}) {
    try {
        if (options.body && !options.headers?.['Content-Type'] && typeof options.body === 'object') {
            options.headers = {
                ...options.headers,
                'Content-Type': 'application/json'
            };
            options.body = JSON.stringify(options.body);
        }
        
        const response = await fetch(url, options);
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        showToast('error', error.message || 'Failed to complete request');
        throw error;
    }
}

function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function safeJsonParse(jsonString, fallback = {}) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error('JSON Parse Error:', e);
        return fallback;
    }
}

window.utils = {
    showToast,
    formatDate,
    copyToClipboard,
    initSearchFilter,
    formatNumber,
    formToJson,
    apiRequest,
    debounce,
    safeJsonParse
}; 
