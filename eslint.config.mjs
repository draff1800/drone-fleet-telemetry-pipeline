export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.ts"]
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    rules: {
      "no-unused-vars": "off"
    }
  }
];
