export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=[\s\S]*[a-z])(?=[\s\S]*[A-Z])(?=[\s\S]*[0-9])(?=[\s\S]*[\p{P}\p{S}])[\s\S]*$/u;
export const PASSWORD_REQUIREMENTS = "Use 8–128 characters with at least one uppercase letter, one lowercase letter, one number, and one symbol.";
