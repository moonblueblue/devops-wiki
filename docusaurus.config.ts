import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: "Moon Blue's DevOps - Wiki",
  tagline: 'DevOps 엔지니어를 위한 로드맵 기반 위키',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://moonblueblue.github.io',
  baseUrl: '/devops-wiki/',

  organizationName: 'moonblueblue',
  projectName: 'devops-wiki',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

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
    format: 'md',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
      onBrokenMarkdownImages: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    ['@easyops-cn/docusaurus-search-local', {
      hashed: true,
      language: ['ko', 'en'],
      highlightSearchTermsOnTargetPage: true,
      searchBarPosition: 'right',
      docsRouteBasePath: '/',
      docsDir: 'content',
      indexBlog: false,
      // 카테고리별로 인덱스를 나눠 첫 검색 다운로드를 줄인다(7.8MB -> 최대 2.8MB, gzip).
      // 검색창은 현재 카테고리만 찾는다. 전체 검색은 검색 페이지의 Everywhere.
      searchContextByPaths: [
        {label: 'Linux', path: 'linux'},
        {label: 'Network', path: 'network'},
        {label: 'Container', path: 'container'},
        {label: 'Kubernetes', path: 'kubernetes'},
        {label: 'CI/CD', path: 'cicd'},
        {label: 'Observability', path: 'observability'},
        {label: 'IaC', path: 'iac'},
        {label: 'Security', path: 'security'},
        {label: 'SRE', path: 'sre'},
      ],
      // 홈처럼 카테고리 밖 페이지에서는 전체를 검색한다.
      useAllContextsWithNoSearchContext: true,
    }],
  ],

  themeConfig: {
    docs: {
      sidebar: {
        autoCollapseCategories: true,
      },
    },
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Moon Blue's DevOps - Wiki",
      logo: {
        alt: 'Moon Blue Logo',
        src: 'img/logo.svg',
        href: '/',
      },
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
      copyright: `© ${new Date().getFullYear()} Moon Blue's DevOps - Wiki`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'hcl', 'python', 'go'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
