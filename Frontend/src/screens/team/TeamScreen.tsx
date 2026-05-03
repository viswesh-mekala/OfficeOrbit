import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
  Platform,
  KeyboardAvoidingView,
  RefreshControl,
  ActivityIndicator,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../../theme/theme';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Avatar } from '../../components/common/Avatar';
import {
  createTeam,
  getTeam,
  joinTeam,
  leaveTeam,
} from '../../services/teamService';
import {
  TeamAttendanceStatus,
  TeamGetResponse,
  TeamMember,
} from '../../types/team.types';

const getStatusPresentation = (status: TeamAttendanceStatus) => {
  switch (status) {
    case 'office':
      return {
        label: 'Office',
        backgroundColor: '#E9FFE9',
        textColor: '#1F7A1F',
      };
    case 'home':
      return {
        label: 'Home',
        backgroundColor: '#FFE3E3',
        textColor: '#B91C1C',
      };
    case 'leave':
      return {
        label: 'Leave',
        backgroundColor: '#FFF1DE',
        textColor: '#B45309',
      };
    case 'holiday':
      return {
        label: 'Holiday',
        backgroundColor: '#FFEBD1',
        textColor: '#C2410C',
      };
    case 'weekend':
      return {
        label: 'Weekend',
        backgroundColor: '#EDEAFF',
        textColor: '#4C1D95',
      };
    default:
      return {
        label: 'Home',
        backgroundColor: '#FFE3E3',
        textColor: '#B91C1C',
      };
  }
};

export const TeamPage: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamState, setTeamState] = useState<TeamGetResponse>({
    team: null,
    members: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const isInTeam = Boolean(teamState.team);
  const officeCount = useMemo(
    () =>
      teamState.members.filter((member) => member.attendanceStatus === 'office')
        .length,
    [teamState.members],
  );
  const homeCount = useMemo(
    () =>
      teamState.members.filter((member) => member.attendanceStatus === 'home')
        .length,
    [teamState.members],
  );

  const loadTeam = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await getTeam();

    if (error) {
      Alert.alert('Unable to load team', error.message);
    } else if (data) {
      setTeamState(data);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTeam();
    }, [loadTeam]),
  );

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) {
      Alert.alert('Error', 'Please enter a team code');
      return;
    }

    setJoinLoading(true);
    const { error } = await joinTeam(joinCode.trim().toUpperCase());
    setJoinLoading(false);

    if (error) {
      Alert.alert('Unable to join team', error.message);
      return;
    }

    setJoinCode('');
    await loadTeam();
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    setCreateLoading(true);
    const { error } = await createTeam(teamName.trim());
    setCreateLoading(false);

    if (error) {
      Alert.alert('Unable to create team', error.message);
      return;
    }

    setTeamName('');
    await loadTeam();
  };

  const handleCopyCode = async () => {
    if (!teamState.team?.code) return;
    // Use Share so the user can tap "Copy" in the native sheet—no native module needed.
    await Share.share({ message: teamState.team.code });
  };

  const handleShareCode = async () => {
    if (!teamState.team?.code) return;
    const teamName = teamState.team.name;
    const code = teamState.team.code;

    // WhatsApp markdown: *text* = bold, `text` = monospace/code block.
    // Putting the code in backticks makes it visually distinct so the recipient
    // can long-press → Copy on just that word — no manual typing needed.
    const message =
      `🚀 You're invited to join *${teamName}* on OfficeOrbit!\n\n` +
      `Team code: \`${code}\`\n\n` +
      `📲 *How to join:*\n` +
      `1. Download OfficeOrbit\n` +
      `2. Tap *Team → Join a Team*\n` +
      `3. Paste the code above\n\n` +
      `OfficeOrbit tracks office attendance automatically — zero manual check-ins. See who's in today and hit your WFO targets effortlessly.`;
    await Share.share({ message, title: `Join ${teamName} on OfficeOrbit` });
  };

  const confirmLeaveTeam = () => {
    Alert.alert(
      'Leave Team',
      'You will leave this team immediately. You can still join or create another team later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void handleLeaveTeam();
          },
        },
      ],
    );
  };

  const handleLeaveTeam = async () => {
    setLeaveLoading(true);
    const { error } = await leaveTeam();
    setLeaveLoading(false);

    if (error) {
      Alert.alert('Unable to leave team', error.message);
      return;
    }

    setTeamState({ team: null, members: [] });
  };

  const renderNoTeamView = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadTeam(true)}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Team Collaboration</Text>
        <Text style={styles.subtitle}>
          Join an existing team with a code or create a new one so everyone can
          see who is in office today.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        <Card style={styles.actionCard}>
          <View style={styles.iconContainer}>
            <Ionicons name='people' size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.cardTitle}>Join a Team</Text>
          <Text style={styles.cardDesc}>
            Enter the team code shared by your teammates.
          </Text>

          <Input
            placeholder='Enter Team Code'
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize='characters'
          />
          <Button
            title='Join Team'
            onPress={handleJoinTeam}
            loading={joinLoading}
          />
        </Card>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <Card style={styles.actionCard}>
          <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons
              name='add-circle'
              size={32}
              color={theme.colors.success}
            />
          </View>
          <Text style={styles.cardTitle}>Create a Team</Text>
          <Text style={styles.cardDesc}>
            Start a team and share the generated code with others.
          </Text>

          <Input
            placeholder='Team Name'
            value={teamName}
            onChangeText={setTeamName}
          />
          <Button
            title='Create New Team'
            variant='secondary'
            onPress={handleCreateTeam}
            loading={createLoading}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
          />
        </Card>
      </View>
    </ScrollView>
  );

  const renderMember = ({ item }: { item: TeamMember }) => {
    const status = getStatusPresentation(item.attendanceStatus);

    return (
      <View style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <Avatar name={item.name} size={46} />
          <View style={styles.nameContainer}>
            <View style={styles.memberHeaderRow}>
              <Text
                style={styles.memberName}
                numberOfLines={1}
                ellipsizeMode='tail'
              >
                {item.name}
              </Text>
              {item.isCurrentUser && <Text style={styles.youTag}>You</Text>}
            </View>
            <Text style={styles.memberEmail} numberOfLines={1}>
              {item.email}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: status.backgroundColor },
          ]}
        >
          <Text style={[styles.statusBadgeText, { color: status.textColor }]}>
            {status.label}
          </Text>
        </View>
      </View>
    );
  };

  const renderTeamDashboard = () => (
    <View style={styles.dashboardContainer}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.secondary]}
        style={styles.teamHeader}
      >
        <View style={styles.headerContent}>
          <View style={styles.teamMeta}>
            <Text style={styles.teamName}>{teamState.team?.name}</Text>
            <TouchableOpacity
              style={styles.codeBox}
              onPress={handleCopyCode}
              activeOpacity={0.85}
            >
              <Ionicons name='copy-outline' size={14} color='white' />
              <Text style={styles.codeText}>{teamState.team?.code}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareCode}
            >
              <Ionicons name='share-social-outline' size={18} color='#FFF' />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => void loadTeam()}
            >
              <Ionicons name='refresh' size={18} color='#FFF' />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{teamState.members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{officeCount}</Text>
            <Text style={styles.statLabel}>Office</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{homeCount}</Text>
            <Text style={styles.statLabel}>Home</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={teamState.members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadTeam(true)}
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Team Members</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerActions}>
            <Button
              title='Leave Team'
              variant='secondary'
              onPress={confirmLeaveTeam}
              loading={leaveLoading}
              style={styles.leaveButton}
              textStyle={styles.leaveButtonText}
            />
          </View>
        }
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading your team...</Text>
      </View>
    );
  }

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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.m,
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontWeight: '500',
  },
  scrollContent: {
    padding: theme.spacing.l,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    lineHeight: 20,
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
  secondaryButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  secondaryButtonText: {
    color: theme.colors.primary,
  },
  dashboardContainer: {
    flex: 1,
  },
  teamHeader: {
    paddingTop: 60,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.l,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.m,
  },
  teamMeta: {
    flex: 1,
  },
  teamName: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: theme.spacing.s,
  },
  codeBox: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  codeText: {
    color: 'white',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.s,
    marginTop: theme.spacing.l,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  listHeader: {
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.l,
    paddingBottom: theme.spacing.s,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  memberItem: {
    marginHorizontal: theme.spacing.l,
    marginBottom: theme.spacing.m,
    padding: theme.spacing.m,
    borderRadius: 16,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: theme.spacing.m,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.m,
  },
  nameContainer: {
    flex: 1,
    gap: 3,
  },
  memberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flexGrow: 1,
    flexShrink: 1,
  },
  youTag: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    flexShrink: 0,
  },
  memberEmail: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 96,
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerActions: {
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.s,
    gap: theme.spacing.m,
  },
  leaveButton: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#F3C6C6',
  },
  leaveButtonText: {
    color: '#D14343',
  },
});
