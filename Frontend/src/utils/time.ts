/**
 * Time formatting and parsing utilities used across the app.
 */

/** Parse "HH:MM" string → Date object (today with that time) */
export const parseTimeToDate = (timeStr: string | null): Date => {
    const d = new Date();
    if (timeStr) {
        const parts = timeStr.split(':');
        d.setHours(parseInt(parts[0]) || 9, parseInt(parts[1]) || 0, 0, 0);
    } else {
        d.setHours(9, 0, 0, 0);
    }
    return d;
};

/** Format "HH:MM" string → "9:00 AM" display string */
export const formatTimeDisplay = (timeStr: string | null): string => {
    if (!timeStr) return '--:--';
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
};

/** Format Date object → "HH:MM" for DB storage */
export const formatTimeForDB = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

/** Format Date object → "9:00 AM" display string */
export const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
};
