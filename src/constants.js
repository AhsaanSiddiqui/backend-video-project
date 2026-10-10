export const DB_NAME = 'videosreamingdb';

// View counting: each user (owner included) adds at most this many views
// to a video per UTC day, and views within the cooldown are not counted.
export const MAX_VIEWS_PER_USER_PER_DAY = 5;
export const VIEW_COOLDOWN_MS = 30 * 1000;
