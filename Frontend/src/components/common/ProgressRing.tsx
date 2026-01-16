import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../../theme/theme';

interface ProgressRingProps {
    percent: number;
    currentDays: number;
    totalDays: number;
    status: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ percent, currentDays, totalDays, status }) => {
    const size = 140; // Reduced from 180
    const strokeWidth = 12; // Reduced from 15
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percent / 100) * circumference;

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>WFO COMPLIANCE</Text>
            <View style={styles.ringContainer}>
                <Svg width={size} height={size}>
                    {/* Background Circle */}
                    <Circle
                        stroke="#E0E7FF"
                        fill="none"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress Circle */}
                    <Circle
                        stroke={theme.colors.primary}
                        fill="none"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        origin={`${size / 2}, ${size / 2}`}
                    />
                </Svg>
                <View style={styles.centerText}>
                    <Text style={styles.percentText}>{percent}%</Text>
                    <Text style={styles.daysText}>{currentDays}/{totalDays} Days</Text>
                </View>
            </View>

            <View style={styles.statusPill}>
                <Text style={styles.statusText}>✔ {status}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 24, // Reduced radius
        padding: 16, // Reduced padding
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    headerTitle: {
        fontSize: 12, // Smaller
        fontWeight: '600',
        color: theme.colors.text.secondary,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    ringContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    centerText: {
        position: 'absolute',
        alignItems: 'center',
    },
    percentText: {
        fontSize: 28, // Smaller
        fontWeight: '700',
        color: theme.colors.text.primary,
    },
    daysText: {
        fontSize: 12,
        color: theme.colors.text.secondary,
    },
    statusPill: {
        backgroundColor: '#E8F5E9',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
    },
    statusText: {
        color: theme.colors.success,
        fontWeight: '600',
        fontSize: 12,
    },
});
