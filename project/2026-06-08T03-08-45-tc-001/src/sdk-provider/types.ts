// 通用类型定义
export interface LinkConfig {
  url: string;
  type: 'internal' | 'external';
  params?: Record<string, any>;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  import: {
    package: string;
    exportName: string;
    type: string;
  };
  props: Record<string, PropDefinition>;
  aiGenerationGuide?: {
    purpose: string;
    usageScenarios: string[];
    keyFeatures: string[];
    layoutStructure?: Record<string, string>;
    styleGuide?: Record<string, any>;
    bestPractices: string[];
    codeExample: string;
  };
  dependencies?: Record<string, string>;
  apis?: Array<{
    name: string;
    description: string;
    timing: string;
  }>;
  meta?: {
    author?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface PropDefinition {
  type: string;
  description: string;
  required: boolean;
  default?: any;
  category?: string;
  properties?: Record<string, any>;
  items?: any;
  enum?: any[];
}
