import { callApi } from './api/apiClient';
import { Team, TeamGetResponse } from '../types/team.types';

export const getTeam = async () => {
    const { data, error } = await callApi<TeamGetResponse>('team-get');
    if (error) {
        return { data: null, error: new Error(error) };
    }

    return {
        data: data ?? { team: null, members: [] },
        error: null,
    };
};

export const createTeam = async (name: string) => {
    const { data, error } = await callApi<Team>('team-create', { name }, { injectTimezone: false });
    if (error) {
        return { data: null, error: new Error(error) };
    }

    return { data: data ?? null, error: null };
};

export const joinTeam = async (code: string) => {
    const { data, error } = await callApi<Team>('team-join', { code }, { injectTimezone: false });
    if (error) {
        return { data: null, error: new Error(error) };
    }

    return { data: data ?? null, error: null };
};

export const leaveTeam = async () => {
    const { error } = await callApi('team-leave', {}, { injectTimezone: false });
    if (error) {
        return { error: new Error(error) };
    }

    return { error: null };
};
