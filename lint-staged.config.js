/**
 * @type {import('lint-staged').Configuration}
 */
export default {
    "*.{js,ts,json,md}": ["prettier --write", "eslint --fix"],
};
