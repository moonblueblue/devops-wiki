import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'DevOps - Wiki',
  tagline: 'DevOps 엔지니어를 위한 로드맵 기반 위키',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://moonblueblue.github.io',
  baseUrl: '/devops-wiki/',

  organizationName: 'moonblueblue',
  projectName: 'devops-wiki',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'content',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/moonblueblue/devops-wiki/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  markdown: {
    mermaid: true,
  },

  themes: [
    '@docusaurus/theme-mermaid',
    ['@easyops-cn/docusaurus-search-local', {
      hashed: true,
      language: ['ko', 'en'],
      highlightSearchTermsOnTargetPage: true,
      searchBarPosition: 'right',
    }],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'DevOps - Wiki',
      items: [
        {
          href: 'https://github.com/moonblueblue/devops-wiki',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      copyright: `© ${new Date().getFullYear()} DevOps - Wiki`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'hcl', 'python', 'go'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
