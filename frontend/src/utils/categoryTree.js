const normalizeId = (value) =>
  value === null || value === undefined ? null : String(value);

export const normalizeCategories = (categories = []) => {
  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .filter((category) => category && category.id !== undefined && category.id !== null)
    .map((category) => {
      const id = normalizeId(category.id);
      const parentId = normalizeId(category.parent_id);
      return {
        ...category,
        id,
        parent_id: parentId,
      };
    });
};

export const buildCategoryTree = (categories = []) => {
  const normalized = normalizeCategories(categories);

  const byParent = normalized.reduce((acc, category) => {
    const parentKey = category.parent_id || 'root';
    if (!acc[parentKey]) {
      acc[parentKey] = [];
    }
    acc[parentKey].push(category);
    return acc;
  }, {});

  const buildNodes = (parentId = 'root', visited = new Set(), depth = 0) => {
    const nodes = (byParent[parentId] || [])
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return nodes
      .map((node) => {
        if (visited.has(node.id)) {
          return null;
        }
        const nextVisited = new Set(visited);
        nextVisited.add(node.id);
        return {
          ...node,
          depth,
          children: buildNodes(node.id, nextVisited, depth + 1),
        };
      })
      .filter(Boolean);
  };

  return buildNodes();
};

export const flattenCategoryTree = (tree = [], depth = 0) => {
  return tree.flatMap((node) => {
    const currentNode = {
      id: node.id,
      label: node.name || '',
      depth,
    };
    const children = flattenCategoryTree(node.children || [], depth + 1);
    return [currentNode, ...children];
  });
};

export const getFlattenedCategories = (categories = []) => {
  const tree = buildCategoryTree(categories);
  return flattenCategoryTree(tree);
};
