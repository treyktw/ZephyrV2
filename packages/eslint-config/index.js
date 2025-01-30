module.exports = {
  extends: [
    "next/core-web-vitals",
    "prettier",
  ],
  settings: {
    next: {
      rootDir: ["apps/*/"],
    },
  },
  rules: {
    "@next/next/no-html-link-for-pages": "off",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
    },
  ],
};
