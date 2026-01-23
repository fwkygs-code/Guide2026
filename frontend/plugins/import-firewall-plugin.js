const path = require('path');

class ImportFirewallPlugin {
  constructor(options) {
    this.systemRoots = options.systemRoots || [];
    this.allowedPackages = options.allowedPackages || [];
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('ImportFirewallPlugin', (compilation) => {
      compilation.hooks.finishModules.tap('ImportFirewallPlugin', (modules) => {
        const violations = [];

        for (const module of modules) {
          if (!module.resource) continue;
          const resourcePath = module.resource;
          const systemRoot = this.systemRoots.find((root) => resourcePath.startsWith(root));
          if (!systemRoot) continue;

          const dependencies = module.dependencies || [];
          dependencies.forEach((dependency) => {
            const request = dependency.request || dependency.userRequest;
            if (!request) return;

            if (request.startsWith('.')) {
              const resolved = path.resolve(path.dirname(resourcePath), request);
              if (!resolved.startsWith(systemRoot)) {
                violations.push(
                  `[ImportFirewall] ${resourcePath} cannot import ${request}. Only local system files are allowed.`
                );
              }
              return;
            }

            const isAllowed = this.allowedPackages.some(
              (pkg) => request === pkg || request.startsWith(`${pkg}/`)
            );
            if (!isAllowed) {
              violations.push(
                `[ImportFirewall] ${resourcePath} cannot import "${request}". Allowed packages: ${this.allowedPackages.join(', ')}.`
              );
            }
          });
        }

        if (violations.length) {
          compilation.errors.push(new Error(violations.join('\n')));
        }
      });
    });
  }
}

module.exports = ImportFirewallPlugin;
