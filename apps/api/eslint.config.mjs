import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.integration.json"],
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
);
