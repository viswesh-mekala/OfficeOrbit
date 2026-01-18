import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';

interface AvatarProps {
    name: string;
    imageUrl?: string;
    size?: number;
    style?: ViewStyle;
    showOnlineStatus?: boolean;
    isOnline?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
    name,
    imageUrl,
    size = 48,
    style,
    showOnlineStatus = false,
    isOnline = false
}) => {
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <View style={[styles.container, { width: size, height: size }, style]}>
            {imageUrl ? (
                <Image
                    source={{ uri: imageUrl }}
                    style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
                />
            ) : (
                <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
                    <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
                </View>
            )}

            {showOnlineStatus && (
                <View style={[
                    styles.statusDot,
                    {
                        backgroundColor: isOnline ? theme.colors.success : '#ccc',
                        width: size * 0.3,
                        height: size * 0.3,
                        borderRadius: (size * 0.3) / 2,
                        bottom: 0,
                        right: 0
                    }
                ]} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    image: {
        resizeMode: 'cover',
    },
    placeholder: {
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    initials: {
        color: theme.colors.white,
        fontWeight: 'bold',
    },
    statusDot: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: theme.colors.white,
    }
});
