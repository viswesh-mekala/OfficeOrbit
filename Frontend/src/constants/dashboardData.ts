export const dashboardData = {
    user: {
        name: "Alex",
        status: "In Office",
        location: "Bangalore Hub",
    },
    compliance: {
        percent: 72,
        currentDays: 14,
        totalDays: 20,
        status: "On Track",
    },
    metrics: [
        { title: "Teammates", value: "8", subtext: "", icon: "people" },
        { title: "Current Streak", value: "4", subtext: "Days", icon: "flame" },
    ],
    alert: {
        title: "Gap Detected",
        message: "You need 2 more days this week to hit 60%.",
        action: "Book for Thursday",
    },
};
