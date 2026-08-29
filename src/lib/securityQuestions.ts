// Shared between the registration form and My Account's "set/change
// security question" form, so the preset list only lives in one place.
export const SECURITY_QUESTION_PRESETS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What was your childhood nickname?",
] as const;

export const SECURITY_QUESTION_CUSTOM = "__custom__";
