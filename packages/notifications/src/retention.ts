// How long the inbox keeps a notification (ADR-0026 point 6): the worker's notification.prune deletes one this many
// days after it was read, and any, read or not, this many days after it was created.

export const READ_NOTIFICATION_KEPT_DAYS = 90;
export const ANY_NOTIFICATION_KEPT_DAYS = 365;
