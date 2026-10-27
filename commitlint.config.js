// Mensajes de commit con el formato Conventional Commits: https://www.conventionalcommits.org
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'body-max-line-length': [1, 'always', 120],
  },
};
