import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getWeeklyAttendance, AttendanceLog } from '../../services/AttendanceService';


// Setup basic locale if needed, though default english is fine
LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    today: "Today"
};
LocaleConfig.defaultLocale = 'en';

export const Attendance: React.FC = () => {
    // Current date for default state
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    const [selectedDate, setSelectedDate] = useState(todayString);
    const [currentMonth, setCurrentMonth] = useState(todayString);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());
    const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch real attendance data from API
    const fetchAttendance = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await getWeeklyAttendance(90); // fetch up to 90 days
            if (!error && data) {
                setAttendanceLogs(data);
            }
        } catch (err) {
            console.error('Failed to fetch attendance:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // Build calendar markings from real data
    const attendanceByDate = useMemo(() => {
        const map: { [key: string]: AttendanceLog } = {};
        attendanceLogs.forEach(log => {
            map[log.date] = log;
        });
        return map;
    }, [attendanceLogs]);

    const presentDates = useMemo(() => {
        const dates: { [key: string]: any } = {};
        attendanceLogs.forEach(log => {
            let dotColor = '#00C853'; // green = office
            if (log.status === 'wfh') dotColor = '#2196F3'; // blue = WFH
            else if (log.status === 'absent') dotColor = '#F44336'; // red = absent
            else if (log.status === 'leave') dotColor = '#FF9800'; // orange = leave
            else if (log.status === 'holiday') dotColor = '#9C27B0'; // purple = holiday

            dates[log.date] = { marked: true, dotColor };
        });
        return dates;
    }, [attendanceLogs]);

    // Merged Marked Dates (Presence + Selection)
    const markedDates = useMemo(() => {
        const marks = { ...presentDates };
        if (selectedDate) {
            marks[selectedDate] = {
                ...(marks[selectedDate] || {}),
                selected: true,
                selectedColor: '#1A1A1A',
                selectedTextColor: '#FFFFFF',
                dotColor: marks[selectedDate] ? '#FFFFFF' : undefined
            };
        }
        return marks;
    }, [presentDates, selectedDate]);

    // Get selected day's log
    const selectedLog = attendanceByDate[selectedDate] || null;

    // Format check-in/out times for display
    const formatLogTime = (isoString: string | null): string => {
        if (!isoString) return '--:--';
        const d = new Date(isoString);
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
        return `${displayHours}:${displayMinutes} ${ampm}`;
    };

    const handleMonthChange = (date: DateData) => {
        setCurrentMonth(date.dateString);
    };

    const handleDayPress = (day: DateData) => {
        setSelectedDate(day.dateString);
    };

    const onDateChange = (event: any, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (date) {
            setPickerDate(date);
            const newDateStr = date.toISOString().split('T')[0];
            setCurrentMonth(newDateStr);
            setSelectedDate(newDateStr);
        }
    };

    // Format header date (e.g., "October 2023")
    const headerDateDisplay = useMemo(() => {
        const d = new Date(currentMonth);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [currentMonth]);

    // Format summary date (e.g. "Tue, Oct 24")
    const summaryDateDisplay = useMemo(() => {
        const d = new Date(selectedDate);
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }, [selectedDate]);

    // Status label for the selected day
    const getStatusLabel = (log: AttendanceLog | null): string => {
        if (!log) return 'No Record';
        switch (log.status) {
            case 'present': return 'Office';
            case 'wfh': return 'Work From Home';
            case 'leave': return 'Leave';
            case 'holiday': return 'Holiday';
            case 'absent': return 'Absent';
            default: return 'Unknown';
        }
    };


    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.monthSelector}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={styles.monthText}>{headerDateDisplay}</Text>
                    <Ionicons name="chevron-down" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <View style={styles.avatarContainer}>
                    <Ionicons name="person-circle" size={40} color="#FF8A65" />
                </View>
            </View>

            {/* Native Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default" // Spinner on iOS, Calendar/default on Android
                    onChange={onDateChange}
                    maximumDate={new Date(2030, 11, 31)}
                    minimumDate={new Date(2020, 0, 1)}
                />
            )}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Calendar Grid */}
                <View style={styles.calendarContainer}>
                    <Calendar
                        current={currentMonth}
                        key={currentMonth} // Force re-render if month changes externally prevents glitches
                        onDayPress={handleDayPress}
                        onMonthChange={handleMonthChange}
                        markedDates={markedDates}
                        theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#BBB',
                            selectedDayBackgroundColor: '#1A1A1A',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: theme.colors.primary,
                            dayTextColor: '#333',
                            textDisabledColor: '#d9e1e8',
                            dotColor: '#00C853',
                            selectedDotColor: '#ffffff',
                            arrowColor: '#1A1A1A', // Standard arrows
                            disabledArrowColor: '#d9e1e8',
                            monthTextColor: '#1A1A1A',
                            indicatorColor: theme.colors.primary,
                            textDayFontWeight: '500',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '600',
                            textDayFontSize: 13, // Smaller font
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 12,
                            // Hide the default header since we have our custom one? 
                            // Actually user said "after that usual page with M,T W", so keep day names
                            // But we have our own header for Month/Year, so maybe hide calendar header title?
                            // Let's hide the title but keep arrows if user wants to swipe
                            // 'stylesheet.calendar.header': {
                            //     header: {
                            //         flexDirection: 'row',
                            //         justifyContent: 'space-between',
                            //         paddingLeft: 10,
                            //         paddingRight: 10,
                            //         marginTop: 6,
                            //         alignItems: 'center'
                            //     }
                            // }
                        }}
                        // We are handling the month/year text ourselves in the top custom header
                        // So we can hide the title here or align it.
                        // Ideally we hide the month name in the calendar component since we show it up top
                        renderHeader={() => null}
                        enableSwipeMonths={true}
                    />
                </View>

                {/* Summary Card */}
                <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View>
                            <Text style={styles.summaryDate}>{summaryDateDisplay}</Text>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusBadge, !selectedLog && { backgroundColor: '#F5F5F5' }]}>
                                    <View style={[styles.statusBadgeDot, !selectedLog && { backgroundColor: '#999' }]} />
                                    <Text style={[styles.statusBadgeText, !selectedLog && { color: '#999' }]}>
                                        {getStatusLabel(selectedLog)}
                                    </Text>
                                </View>
                                {selectedLog?.duration_minutes ? (
                                    <Text style={styles.statusTime}>
                                        • {Math.floor(selectedLog.duration_minutes / 60)}h {selectedLog.duration_minutes % 60}m
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </View>

                    {/* Timeline */}
                    <View style={styles.timelineContainer}>
                        {/* Vertical Line */}
                        <View style={styles.timelineLine} />

                        {/* Arrival */}
                        <View style={styles.timelineItem}>
                            <View style={[styles.iconContainer, { backgroundColor: '#EEF2FF' }]}>
                                <Ionicons name="log-in-outline" size={20} color={theme.colors.primary} />
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineLabel}>Arrival</Text>
                                <Text style={styles.timelineLocation}>
                                    <Ionicons name="location-sharp" size={12} color="#999" />
                                    {' '}{selectedLog?.location_check_in?.address || 'N/A'}
                                </Text>
                            </View>
                            <Text style={styles.timelineTime}>{formatLogTime(selectedLog?.check_in ?? null)}</Text>
                        </View>

                        {/* Departure */}
                        <View style={[styles.timelineItem, { marginTop: 24 }]}>
                            <View style={[styles.iconContainer, { backgroundColor: '#F5F5F5' }]}>
                                <Ionicons name="log-out-outline" size={20} color="#666" />
                            </View>
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineLabel}>Departure</Text>
                                <Text style={styles.timelineLocation}>
                                    <Ionicons name="business" size={12} color="#999" />
                                    {' '}{selectedLog?.check_out ? 'Checked out' : 'Not yet'}
                                </Text>
                            </View>
                            <Text style={styles.timelineTime}>{formatLogTime(selectedLog?.check_out ?? null)}</Text>
                        </View>
                    </View>



                </Animated.View>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: 15,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 8,
    },
    monthSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    monthText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.colors.primary,
    },
    avatarContainer: {
        // Simple avatar container
    },
    calendarContainer: {
        marginBottom: 8,
    },
    // daysHeader, dayLabel, datesGrid, dateCell, dateTouch... mostly unused now as Calendar handles it
    // But keeping general styles for Card below

    summaryCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#F5F5F5',
        marginTop: 24
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16, // Reduced margin
    },
    summaryDate: {
        fontSize: 20, // Smaller
        fontWeight: 'bold',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#E8F5E9', // Light green bg
        borderRadius: 20,
        gap: 6,
    },
    statusBadgeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#00C853',
    },
    statusBadgeText: {
        color: '#2E7D32',
        fontWeight: '600',
        fontSize: 11,
    },
    statusTime: {
        color: '#999',
        fontSize: 12,
    },
    editButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F5F7FA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineContainer: {
        position: 'relative',
        paddingLeft: 8,
        marginBottom: 20, // Reduced margin
    },
    timelineLine: {
        position: 'absolute',
        top: 20,
        bottom: 20,
        left: 26, // Center of width 36 icon container
        width: 1,
        backgroundColor: '#E0E0E0',
        zIndex: 0,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 1, // Above line
    },
    iconContainer: {
        width: 36, // Smaller icon container
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineContent: {
        flex: 1,
    },
    timelineLabel: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
        marginBottom: 2,
    },
    timelineLocation: {
        fontSize: 11,
        color: '#999',
    },
    timelineTime: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },

});
