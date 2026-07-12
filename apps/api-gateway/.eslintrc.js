module.exports = {
  overrides: [
    {
      files: ['**/*.spec.ts'],
      parserOptions: {
        project: './apps/api-gateway/tsconfig.spec.json',
      },
    },
  ],
};
