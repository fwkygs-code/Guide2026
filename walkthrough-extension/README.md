# Walkthrough Extension File Structure

```
walkthrough-extension/
├── manifest.json
├── package.json
├── tsconfig.json
├── webpack.config.js
├── src/
│   ├── types/
│   │   ├── index.ts
│   │   ├── walkthrough-types.ts
│   │   ├── message-types.ts
│   │   ├── overlay-types.ts
│   │   ├── error-types.ts
│   │   └── step-types.ts
│   ├── constants/
│   │   ├── index.ts
│   │   ├── error-codes.ts
│   │   ├── message-codes.ts
│   │   └── default-config.ts
│   ├── background/
│   │   ├── index.ts
│   │   ├── background.ts
│   │   ├── message-router.ts
│   │   ├── storage-manager.ts
│   │   └── error-logger.ts
│   ├── content/
│   │   ├── index.ts
│   │   ├── content-script.ts
│   │   ├── session-controller.ts
│   │   ├── spa-detector.ts
│   │   └── reload-handler.ts
│   ├── overlay/
│   │   ├── index.ts
│   │   ├── overlay-renderer.ts
│   │   ├── spotlight-manager.ts
│   │   ├── step-ui-manager.ts
│   │   └── event-interceptor.ts
│   ├── state/
│   │   ├── index.ts
│   │   ├── state-store.ts
│   │   └── dom-observer.ts
│   ├── error/
│   │   ├── index.ts
│   │   └── error-boundary.ts
│   ├── utils/
│   │   ├── index.ts
│   │   ├── dom-utils.ts
│   │   ├── url-utils.ts
│   │   ├── animation-utils.ts
│   │   ├── performance-utils.ts
│   │   └── validation-utils.ts
│   └── demo/
│       ├── index.ts
│       └── walkthrough-definition.ts
├── dist/
└── assets/
    ├── icons/
    └── css/
```
