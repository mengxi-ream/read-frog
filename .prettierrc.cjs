module.exports = {
  plugins: [
    "prettier-plugin-packagejson",
    "@trivago/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: ["^@([^/]+)(.*)/?(.*)$", "^@/(.*)/?(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderGroupNamespaceSpecifiers: true,
  arrowParens: "always",
  printWidth: 80,
  singleQuote: true,
  trailingComma: "all",
  tabWidth: 2,
};
