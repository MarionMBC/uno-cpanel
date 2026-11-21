// ESLint 8 busca configs planas hacia arriba y encontraría la de Next en la
// raíz (que ignora functions/**). Esta config plana reutiliza .eslintrc.js.
const {FlatCompat} = require("@eslint/eslintrc");
const js = require("@eslint/js");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  {ignores: ["node_modules/**"]},
  ...compat.config(require("./.eslintrc.js")),
];
