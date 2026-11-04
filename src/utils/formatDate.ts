export const formatDate = (date: Date | null): string => {
    if (!date) return 'Unknown';
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}; 
