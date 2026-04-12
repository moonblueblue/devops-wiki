import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  wikiSidebar: [
    {
      type: 'category',
      label: '1. Linux',
      link: {type: 'doc', id: 'linux/index'},
      items: [
        'linux/linux-distro-comparison',
        'linux/filesystem-hierarchy',
        'linux/user-group-permission',
        'linux/package-management',
      ],
    },
    {
      type: 'category',
      label: '2. Network',
      link: {type: 'doc', id: 'network/index'},
      items: [],
    },
    {
      type: 'category',
      label: '3. Container',
      link: {type: 'doc', id: 'container/index'},
      items: [],
    },
    {
      type: 'category',
      label: '4. Kubernetes',
      link: {type: 'doc', id: 'kubernetes/index'},
      items: [
        'kubernetes/kubernetes-2025-2026-release-overview',
      ],
    },
    {
      type: 'category',
      label: '5. IaC',
      link: {type: 'doc', id: 'iac/index'},
      items: [],
    },
    {
      type: 'category',
      label: '6. CICD',
      link: {type: 'doc', id: 'cicd/index'},
      items: [],
    },
    {
      type: 'category',
      label: '7. GitOps',
      link: {type: 'doc', id: 'gitops/index'},
      items: [],
    },
    {
      type: 'category',
      label: '8. Observability',
      link: {type: 'doc', id: 'observability/index'},
      items: [],
    },
    {
      type: 'category',
      label: '9. Security',
      link: {type: 'doc', id: 'security/index'},
      items: [],
    },
    {
      type: 'category',
      label: '10. SRE',
      link: {type: 'doc', id: 'sre/index'},
      items: [],
    },
  ],
};

export default sidebars;
