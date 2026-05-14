export const createNotificationResponse = (
  identifier: string,
  data: Record<string, unknown> = {},
) => ({
  notification: {
    request: {
      identifier,
      content: {
        data,
      },
    },
  },
});
