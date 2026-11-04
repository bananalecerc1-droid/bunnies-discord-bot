document.addEventListener('DOMContentLoaded', async () => {
    let hasChanges = false;
    const saveBar = document.getElementById('saveBar');
    const toast = document.querySelector('.toast');
    const channelModal = document.getElementById('channelModal');
    
    document.querySelectorAll('.emoji-picker-btn').forEach(btn => {
        const input = btn.parentElement.querySelector('input');
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emoji-mart').forEach(p => p.remove());

            const rect = btn.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

            const picker = new EmojiMart.Picker({
                data: async () => {
                    const response = await fetch('https://cdn.jsdelivr.net/npm/@emoji-mart/data');
                    return response.json();
                },
                onEmojiSelect: emoji => {
                    input.value = emoji.native;
                    picker.remove();
                    input.dispatchEvent(new Event('change'));
                    showChanges();
                },
                theme: 'dark',
                set: 'native',
                showPreview: false,
                showSkinTones: false,
                maxFrequentRows: 2
            });

            document.body.appendChild(picker);
            
            const isRTL = document.dir === 'rtl';
            const pickerRect = picker.getBoundingClientRect();
            
            let top = rect.bottom + scrollTop + 5;
            let left = isRTL ? rect.left + scrollLeft - pickerRect.width + rect.width : rect.left + scrollLeft;

            if (top + pickerRect.height > window.innerHeight) {
                top = rect.top + scrollTop - pickerRect.height - 5;
            }
            if (left + pickerRect.width > window.innerWidth) {
                left = window.innerWidth - pickerRect.width - 5;
            }
            if (left < 0) {
                left = 5;
            }

            picker.style.position = 'absolute';
            picker.style.top = `${top}px`;
            picker.style.left = `${left}px`;
            picker.style.zIndex = '1000';

            const closePickerOnClickOutside = (e) => {
                if (!picker.contains(e.target) && !btn.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePickerOnClickOutside);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', closePickerOnClickOutside);
            }, 100);
        });
    });

    const addChannelBtn = document.getElementById('add-channel');
    const channelSelect = document.getElementById('channelSelect');
    const confirmChannelBtn = document.getElementById('confirmChannel');
    const cancelChannelBtn = document.getElementById('cancelChannel');
    const channelsContainer = document.getElementById('channels-container');

    async function fetchChannels() {
        try {
            const response = await fetch('/api/channels');
            const channels = await response.json();
            
            channelSelect.innerHTML = '<option value="">Select a channel</option>';
            
            channels.forEach(channel => {
                const option = document.createElement('option');
                option.value = channel.id;
                option.textContent = `#${channel.name}`;
                channelSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching channels:', error);
            showToast('Error fetching channels', 'error');
        }
    }

    addChannelBtn.addEventListener('click', async () => {
        await fetchChannels();
        channelModal.classList.remove('hidden');
    });

    cancelChannelBtn.addEventListener('click', () => {
        channelModal.classList.add('hidden');
    });

    confirmChannelBtn.addEventListener('click', () => {
        const selectedChannel = channelSelect.value;
        if (!selectedChannel) return;

        const channelItem = document.createElement('div');
        channelItem.className = 'channel-item flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-lg';
        channelItem.innerHTML = `
            <span class="text-gray-700 dark:text-gray-300">#${channelSelect.options[channelSelect.selectedIndex].text}</span>
            <button class="remove-channel text-red-500 hover:text-red-600" data-channel="${selectedChannel}">
                <i class="fas fa-trash"></i>
            </button>
        `;

        const removeBtn = channelItem.querySelector('.remove-channel');
        removeBtn.addEventListener('click', () => {
            channelItem.remove();
            showChanges();
            updateNoChannelsMessage();
        });

        const noChannelsMsg = channelsContainer.querySelector('.text-center');
        if (noChannelsMsg) noChannelsMsg.remove();
        
        channelsContainer.appendChild(channelItem);
        channelModal.classList.add('hidden');
        showChanges();
    });

    document.querySelectorAll('.remove-channel').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.channel-item').remove();
            showChanges();
            updateNoChannelsMessage();
        });
    });

    function updateNoChannelsMessage() {
        const hasChannels = channelsContainer.querySelector('.channel-item');
        if (!hasChannels) {
            channelsContainer.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400 py-4">
                    No channels added
                </div>
            `;
        }
    }

    function showChanges() {
        hasChanges = true;
        saveBar.classList.add('show');
    }

    function hideChanges() {
        hasChanges = false;
        saveBar.classList.remove('show');
    }

    function showToast(message, type = 'success') {
        toast.className = `toast ${type} show`;
        toast.querySelector('.toast-message').textContent = message;
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', showChanges);
    });

    const colorInput = document.getElementById('color');
    const colorTextInput = document.getElementById('color-text');

    colorInput.addEventListener('input', () => {
        colorTextInput.value = colorInput.value;
        showChanges();
    });

    colorTextInput.addEventListener('input', () => {
        colorInput.value = colorTextInput.value;
        showChanges();
    });

    document.getElementById('saveBtn').addEventListener('click', async () => {
        try {
            const settings = {
                enabled: document.getElementById('suggestions-enabled').checked,
                cooldown: parseInt(document.getElementById('cooldown').value) * 1000,
                color: document.getElementById('color').value,
                minLength: parseInt(document.getElementById('min-length').value),
                maxLength: parseInt(document.getElementById('max-length').value),
                maxImageSize: parseInt(document.getElementById('max-image-size').value),
                allowImages: document.getElementById('allow-images').checked,
                requireContent: document.getElementById('require-content').checked,
                deleteOriginal: document.getElementById('delete-original').checked,
                channels: Array.from(document.querySelectorAll('.channel-item .remove-channel')).map(btn => btn.dataset.channel),
                reactions: {
                    enabled: document.getElementById('reactions-enabled').checked,
                    upvote: document.getElementById('upvote-emoji').value,
                    downvote: document.getElementById('downvote-emoji').value,
                    star: document.getElementById('star-emoji').value
                },
                thread: {
                    enabled: document.getElementById('thread-enabled').checked,
                    name: document.getElementById('thread-name').value,
                    archiveDuration: parseInt(document.getElementById('archive-duration').value)
                }
            };

            const response = await fetch('/api/settings/suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) throw new Error('Failed to save settings');

            hideChanges();
            showToast('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Failed to save settings', 'error');
        }
    });

    document.getElementById('resetBtn').addEventListener('click', async () => {
        try {
            location.reload();
        } catch (error) {
            console.error('Error resetting settings:', error);
            showToast('Failed to reset settings', 'error');
        }
    });
}); 
