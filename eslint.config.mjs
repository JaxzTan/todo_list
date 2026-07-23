import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "Three Layer Day Board Design/**",
      ".next/**",
      "node_modules/**",
    ],
  },
];

export default eslintConfig;
