import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Ignora arquivos de configuração
  {
    ignores: [
      "tailwind.config.js",
      "postcss.config.js",
      "next.config.js",
    ],
  },

  // Config padrão do Next.js
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript"
  ),
];

export default eslintConfig;
