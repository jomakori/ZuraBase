module.exports = {
  presets: [
    "@babel/preset-env",
    ["@babel/preset-react", { runtime: "automatic" }],
    "@babel/preset-typescript",
  ],
  env: {
    test: {
      presets: [
        ["@babel/preset-env", { targets: { node: "current" } }],
        ["@babel/preset-react", { runtime: "automatic" }],
        "@babel/preset-typescript",
      ],
      plugins: [
        // Transform import.meta.env to process.env for Jest compatibility
        function() {
          return {
            visitor: {
              MemberExpression(path) {
                // Transform import.meta.env.VARNAME to process.env.VARNAME
                if (
                  path.node.object.type === 'MetaProperty' &&
                  path.node.object.meta.name === 'import' &&
                  path.node.object.property.name === 'meta' &&
                  path.node.property.name === 'env'
                ) {
                  path.replaceWith(
                    path.hub.file.opts.filename.includes('node_modules')
                      ? path.node
                      : this.types.memberExpression(
                          this.types.identifier('process'),
                          this.types.identifier('env')
                        )
                  );
                }
              },
            },
          };
        },
      ],
    },
  },
};
