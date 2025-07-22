import globals from "globals";
import pluginReact from "eslint-plugin-react";
import json from "@eslint/json";
import { defineConfig } from "eslint/config";


export default defineConfig([
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
  { files: ["**/*.{js,mjs,cjs,jsx}"], languageOptions: { globals: globals.browser } },
  pluginReact.configs.flat.recommended,
  { files: ["**/*.json"], plugins: { json }, language: "json/json" },
]);
