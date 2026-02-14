import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, FlatList, Platform, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Avatar } from '../../components/common/Avatar';

// Mock data types
interface TeamMember {
    id: string;
    name: string;
    role: 'Admin' | 'Member';
    isOnline: boolean;
    imageUrl?: string;
}

interface TeamData {
    name: string;
    code: string;
    members: TeamMember[];
}

export const TeamPage: React.FC = () => {
    const [isInTeam, setIsInTeam] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [teamName, setTeamName] = useState('');

    // Mock team data
    const [team, setTeam] = useState<TeamData>({
        name: "Engineering Squad",
        code: "ENG-2024",
        members: [
            { id: '1', name: 'Viswesh Nani', role: 'Admin', isOnline: true },
            { id: '2', name: 'Sarah Smith', role: 'Member', isOnline: true },
            { id: '3', name: 'John Doe', role: 'Member', isOnline: false },
            { id: '4', name: 'Mike Ross', role: 'Member', isOnline: true },
        ]
    });

    const handleJoinTeam = () => {
        if (!joinCode.trim()) {
            Alert.alert("Error", "Please enter a team code");
            return;
        }
        // Simulate API call
        setIsInTeam(true);
    };

    const handleCreateTeam = () => {
        if (!teamName.trim()) {
            Alert.alert("Error", "Please enter a team name");
            return;
        }
        // Simulate creation
        setIsInTeam(true);
    };

    const renderNoTeamView = () => (
        <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Team Collaboration</Text>
                <Text style={styles.subtitle}>Join an existing team or create a new one to start tracking together.</Text>
            </View>

            <View style={styles.actionContainer}>
                <Card style={styles.actionCard}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="people" size={32} color={theme.colors.primary} />
                    </View>
                    <Text style={styles.cardTitle}>Join a Team</Text>
                    <Text style={styles.cardDesc}>Enter the unique code shared by your team admin.</Text>

                    <Input
                        placeholder="Enter Team Code"
                        value={joinCode}
                        onChangeText={setJoinCode}
                        autoCapitalize="characters"
                    />
                    <Button title="Join Team" onPress={handleJoinTeam} />
                </Card>

                <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                </View>

                <Card style={styles.actionCard}>
                    <View style={[styles.iconContainer, { backgroundColor: '#E0F2F1' }]}>
                        <Ionicons name="add-circle" size={32} color="#00897B" />
                    </View>
                    <Text style={styles.cardTitle}>Create a Team</Text>
                    <Text style={styles.cardDesc}>Start a new organization and invite members.</Text>

                    <Input
                        placeholder="Team Name"
                        value={teamName}
                        onChangeText={setTeamName}
                    />
                    <Button
                        title="Create New Team"
                        variant="secondary"
                        onPress={handleCreateTeam}
                        style={{ backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.primary }}
                        textStyle={{ color: theme.colors.primary }}
                    />
                </Card>
            </View>
        </ScrollView>
    );

    const renderTeamDashboard = () => (
        <View style={styles.dashboardContainer}>
            <LinearGradient
                colors={[theme.colors.primary, theme.colors.secondary]}
                style={styles.teamHeader}
            >
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.teamName}>{team.name}</Text>
                        <View style={styles.codeContainer}>
                            <Text style={styles.codeLabel}>Team Code:</Text>
                            <TouchableOpacity style={styles.codeBox}>
                                <Text style={styles.codeText}>{team.code}</Text>
                                <Ionicons name="copy-outline" size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{team.members.length}</Text>
                            <Text style={styles.statLabel}>Members</Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {team.members.filter(m => m.isOnline).length}
                            </Text>
                            <Text style={styles.statLabel}>Online</Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.listContainer}>
                <Text style={styles.sectionTitle}>Team Members</Text>
                <FlatList
                    data={team.members}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.memberItem}>
                            <View style={styles.memberInfo}>
                                <Avatar
                                    name={item.name}
                                    imageUrl={item.imageUrl}
                                    showOnlineStatus
                                    isOnline={item.isOnline}
                                />
                                <View style={styles.nameContainer}>
                                    <Text style={styles.memberName}>{item.name}</Text>
                                    <Text style={styles.memberRole}>{item.role}</Text>
                                </View>
                            </View>
                            <TouchableOpacity>
                                <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
                {isInTeam ? renderTeamDashboard() : renderNoTeamView()}
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    header: {
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.xl,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.s,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.text.secondary,
        lineHeight: 24,
    },
    actionContainer: {
        gap: theme.spacing.l,
    },
    actionCard: {
        padding: theme.spacing.l,
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.m,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.xs,
    },
    cardDesc: {
        fontSize: 14,
        color: theme.colors.text.secondary,
        textAlign: 'center',
        marginBottom: theme.spacing.l,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: theme.spacing.s,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    orText: {
        marginHorizontal: theme.spacing.m,
        color: theme.colors.text.secondary,
        fontWeight: '500',
    },
    // Dashboard Styles
    dashboardContainer: {
        flex: 1,
    },
    teamHeader: {
        paddingTop: 60,
        paddingBottom: theme.spacing.xl,
        paddingHorizontal: theme.spacing.l,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    teamName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: theme.spacing.s,
    },
    codeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.s,
    },
    codeLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    codeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    codeText: {
        color: 'white',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: 8,
        borderRadius: 12,
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    statValue: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 10,
    },
    separator: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    listContainer: {
        flex: 1,
        padding: theme.spacing.l,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.text.primary,
        marginBottom: theme.spacing.m,
    },
    listContent: {
        paddingBottom: theme.spacing.xl,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        padding: theme.spacing.m,
        borderRadius: 12,
        marginBottom: theme.spacing.m,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    memberInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.m,
    },
    nameContainer: {
        gap: 2,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text.primary,
    },
    memberRole: {
        fontSize: 12,
        color: theme.colors.text.secondary,
    },
});
