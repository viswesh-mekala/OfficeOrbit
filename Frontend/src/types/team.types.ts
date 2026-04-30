export type TeamAttendanceStatus =
    | 'office'
    | 'home'
    | 'leave'
    | 'holiday'
    | 'weekend';

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    attendanceStatus: TeamAttendanceStatus;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    joinedAt: string;
    isCurrentUser: boolean;
}

export interface Team {
    id: string;
    name: string;
    code: string;
    created_at: string;
}

export interface TeamGetResponse {
    team: Team | null;
    members: TeamMember[];
}
