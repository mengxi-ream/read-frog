const valueParser = require("postcss-value-parser")

const DEFAULTS = {
  fromPrefix: "--tw-",
  toPrefix: "--rf-tw-",
}

function renameVarName(varName, fromPrefix, toPrefix) {
  if (!varName.startsWith(fromPrefix))
    return varName
  return toPrefix + varName.slice(fromPrefix.length)
}

/**
 * Walk a declaration value and rewrite var(--from-...) references.
 */
function rewriteValueVars(rawValue, fromPrefix, toPrefix) {
  const ast = valueParser(rawValue)

  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.type === "function") {
        // Only transform var() references
        if (node.value.toLowerCase() === "var" && node.nodes.length) {
          // The first "word" inside var() is the custom property name
          const first = node.nodes.find(n => n.type === "word")
          if (first) {
            const newName = renameVarName(first.value, fromPrefix, toPrefix)
            first.value = newName
          }
        }
        // Recurse into nested functions (calc(), color-mix(), etc.)
        visit(node.nodes)
      }
    }
  }

  visit(ast.nodes)
  return ast.toString()
}

/**
 * PostCSS plugin to rename custom properties and references.
 */
module.exports = (opts = {}) => {
  const { fromPrefix, toPrefix } = { ...DEFAULTS, ...opts }

  return {
    postcssPlugin: "postcss-rename-custom-props",
    Once(root) {
      // 1) Rename @property --tw-... rules
      root.walkAtRules((at) => {
        if (at.name === "property") {
          const param = at.params.trim()
          if (param.startsWith(fromPrefix)) {
            at.params = renameVarName(param, fromPrefix, toPrefix)
          }
        }
      })

      // 2) Rename declarations: property names and their values
      root.walkDecls((decl) => {
        // 2a) If the declaration is a custom property definition like --tw-foo: ...
        if (decl.prop.startsWith(fromPrefix)) {
          decl.prop = renameVarName(decl.prop, fromPrefix, toPrefix)
        }

        // 2b) Rewrite any var(--tw-...) references appearing in values
        if (decl.value && decl.value.includes("var(") && decl.value.includes(fromPrefix)) {
          decl.value = rewriteValueVars(decl.value, fromPrefix, toPrefix)
        }
      })
    },
  }
}

module.exports.postcss = true
