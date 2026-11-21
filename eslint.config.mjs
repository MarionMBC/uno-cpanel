import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prototipo de Claude Design (referencia, no se compila) y Cloud Functions (paquete aparte).
    "project/**",
    "functions/**",
  ]),
  {
    // Deuda heredada: varias pantallas copian datos de Firestore al estado del formulario en un
    // effect. Se deja visible como warning hasta refactorizarlas.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
]);

export default eslintConfig;
