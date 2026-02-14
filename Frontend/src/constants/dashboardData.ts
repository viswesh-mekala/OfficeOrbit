export const dashboardData = {
    user: {
        name: "Viswesh",
        status: "In Office",
        location: "Bangalore Hub",
    },
    compliance: {
        percent: 72,
        currentDays: 14,
        totalDays: 20,
        status: "On Track",
    },
    weekly: {
        percent: 60,
        label: "This Week",
        subtext: "3/5 Days",
    },
    metrics: [
        { title: "Teammates", value: "8", subtext: "Mike, Sarah +6", icon: "people" },
        { title: "Current Streak", value: "4", subtext: "Days", icon: "flame", color: '#FF9800' },
    ],
    alert: {
        title: "Gap Detected",
        message: "You need 2 more days this week to hit 60%.",
        action: "",
    },
};
