import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Calendar, DateData, LocaleConfig } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getWeeklyAttendance, AttendanceLog, AttendanceStatus, updateAttendanceDay } from '../../services/AttendanceService';
import { useRouter } from 'expo-router';


// Setup basic locale if needed, though default english is fine
LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    today: "Today"
};
LocaleConfig.defaultLocale = 'en';

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const STATUS_THEME: Record<string, { fill: string; text: string; label: string }> = {
    present: { fill: '#66ff66', text: '#0F172A', label: 'Office' },
    wfh: { fill: '#ff4d4d', text: '#FFFFFF', label: 'Home' },
    leave: { fill: '#ffb84d', text: '#0F172A', label: 'Leave' },
    holiday: { fill: '#ff9900', text: '#0F172A', label: 'Holiday' },
    absent: { fill: '#9CA3AF', text: '#FFFFFF', label: 'Absent' },
    weekend: { fill: '#5B4DFF', text: '#FFFFFF', label: 'Weekend' },
    empty: { fill: '#F3F4F6', text: '#6B7280', label: 'No Record' },
};

export const Attendance: React.FC = () => {
    const router = useRouter();
    // Current date for default state
    const today = new Date();
    const todayString = formatLocalDate(today);

    const [selectedDate, setSelectedDate] = useState(todayString);
    const [currentMonth, setCurrentMonth] = useState(todayString);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState(new Date());
    const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingDay, setUpdatingDay] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Fetch real attendance data from API
    const fetchAttendance = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await getWeeklyAttendance(90); // fetch up to 90 days
            if (!error && data) {
                setAttendanceLogs(data);
            }
        } catch (_err) {
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
            const statusTheme = STATUS_THEME[log.status] || STATUS_THEME.empty;
            dates[log.date] = {
                customStyles: {
                    container: {
                        backgroundColor: statusTheme.fill,
                        borderRadius: 8,
                    },
                    text: {
                        color: statusTheme.text,
                        fontWeight: '700',
                    },
                },
            };
        });
        return dates;
    }, [attendanceLogs]);

    const weekendDates = useMemo(() => {
        const weekendMarks: { [key: string]: any } = {};
        const monthDate = new Date(currentMonth);
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                    const dateString = formatLocalDate(d);
                if (!attendanceByDate[dateString]) {
                    weekendMarks[dateString] = {
                        customStyles: {
                            container: {
                                backgroundColor: STATUS_THEME.weekend.fill,
                                borderRadius: 8,
                            },
                            text: {
                                color: STATUS_THEME.weekend.text,
                                fontWeight: '700',
                            },
                        },
                    };
                }
            }
        }
        return weekendMarks;
    }, [attendanceByDate, currentMonth]);

    // Merged Marked Dates (Presence + Selection)
    const markedDates = useMemo(() => {
        const marks = { ...weekendDates, ...presentDates };
        if (selectedDate) {
            const existing = marks[selectedDate]?.customStyles;
            marks[selectedDate] = {
                ...(marks[selectedDate] || {}),
                customStyles: {
                    container: {
                        backgroundColor: existing?.container?.backgroundColor || '#111827',
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: '#111827',
                    },
                    text: {
                        color: existing?.text?.color || '#FFFFFF',
                        fontWeight: '800',
                    },
                },
            };
        }
        return marks;
    }, [presentDates, weekendDates, selectedDate]);

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
            const newDateStr = formatLocalDate(date);
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
        if (log.status === 'absent') return 'No Record';
        return STATUS_THEME[log.status]?.label || 'Unknown';
    };

    const getStatusThemeForDate = (date: string, log: AttendanceLog | null) => {
        if (log) {
            return STATUS_THEME[log.status] || STATUS_THEME.empty;
        }
        const dayOfWeek = new Date(date).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) return STATUS_THEME.weekend;
        return STATUS_THEME.empty;
    };

    const handleEditSelectedDay = () => {
        if (updatingDay) return;
        setShowEditModal(true);
    };

    const handleStatusUpdate = async (status: AttendanceStatus) => {
        try {
            setUpdatingDay(true);
            setShowEditModal(false);
            const { error } = await updateAttendanceDay(selectedDate, status);
            if (error) {
                Alert.alert('Update Failed', error.message);
                return;
            }
            await fetchAttendance();
            Alert.alert('Saved', 'Day status updated successfully.');
        } catch {
            Alert.alert('Update Failed', 'Could not update this day. Please try again.');
        } finally {
            setUpdatingDay(false);
        }
    };

    const selectedStatusTheme = getStatusThemeForDate(selectedDate, selectedLog);

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
                <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push('/profile')}>
                    <Ionicons name="person-circle" size={40} color="#FF8A65" />
                </TouchableOpacity>
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
                        markingType="custom"
                        theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#111111',
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
                            textDayHeaderFontWeight: '800',
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
                <View style={styles.legendContainer}>
                    <Text style={styles.legendTitle}>Legend</Text>
                    <View style={styles.legendRow}>
                        {['present', 'wfh', 'leave', 'holiday', 'weekend'].map((key) => (
                            <View key={key} style={styles.legendItem}>
                                <View style={[styles.legendSwatch, { backgroundColor: STATUS_THEME[key].fill }]} />
                                <Text style={styles.legendText}>{STATUS_THEME[key].label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Summary Card */}
                <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <View>
                            <Text style={styles.summaryDate}>{summaryDateDisplay}</Text>
                            <View style={styles.statusRow}>
                                <View style={[styles.statusBadge, { backgroundColor: selectedStatusTheme.fill }]}>
                                    <Text style={[styles.statusBadgeText, { color: selectedStatusTheme.text }]}>
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
                        <TouchableOpacity style={styles.editButton} onPress={handleEditSelectedDay} disabled={updatingDay}>
                            {updatingDay ? (
                                <ActivityIndicator size="small" color={theme.colors.primary} />
                            ) : (
                                <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
                            )}
                        </TouchableOpacity>
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
                                    {' '}{selectedLog?.location_check_in?.address || 'NULL'}
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
                                    {' '}{selectedLog?.check_out ? 'Checked out' : 'NULL'}
                                </Text>
                            </View>
                            <Text style={styles.timelineTime}>{formatLogTime(selectedLog?.check_out ?? null)}</Text>
                        </View>
                    </View>



                </Animated.View>

            </ScrollView>

            <Modal
                visible={showEditModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowEditModal(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Edit Day Status</Text>
                        <Text style={styles.modalSubtitle}>{summaryDateDisplay}</Text>
                        <View style={styles.modalOptions}>
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleStatusUpdate('present')}>
                                <View style={[styles.optionDot, { backgroundColor: STATUS_THEME.present.fill }]} />
                                <Text style={styles.modalOptionText}>Office</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleStatusUpdate('wfh')}>
                                <View style={[styles.optionDot, { backgroundColor: STATUS_THEME.wfh.fill }]} />
                                <Text style={styles.modalOptionText}>Home</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleStatusUpdate('holiday')}>
                                <View style={[styles.optionDot, { backgroundColor: STATUS_THEME.holiday.fill }]} />
                                <Text style={styles.modalOptionText}>Holiday</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalOption} onPress={() => handleStatusUpdate('leave')}>
                                <View style={[styles.optionDot, { backgroundColor: STATUS_THEME.leave.fill }]} />
                                <Text style={styles.modalOptionText}>Leave</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowEditModal(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
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
        marginBottom: 6,
    },
    // daysHeader, dayLabel, datesGrid, dateCell, dateTouch... mostly unused now as Calendar handles it
    // But keeping general styles for Card below

    summaryCard: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#F5F5F5',
        marginTop: 14
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
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusBadgeText: {
        fontWeight: '700',
        fontSize: 12,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },
    modalSubtitle: {
        marginTop: 2,
        marginBottom: 12,
        color: '#6B7280',
        fontSize: 13,
        fontWeight: '500',
    },
    modalOptions: {
        gap: 8,
    },
    legendContainer: {
        marginHorizontal: 20,
        marginTop: 2,
        marginBottom: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
    },
    legendTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4B5563',
        marginBottom: 6,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    legendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendSwatch: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 11,
        color: '#374151',
        fontWeight: '600',
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        gap: 10,
    },
    optionDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    modalOptionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    modalCancel: {
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingVertical: 10,
    },
    modalCancelText: {
        color: '#4B5563',
        fontWeight: '600',
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
