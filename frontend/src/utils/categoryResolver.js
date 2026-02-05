const buildCategoryMaps = (categories = []) => {
  const categoriesById = new Map();
  const childrenMap = new Map();

  categories.forEach((category) => {
    if (!category?.id) {
      return;
    }
    categoriesById.set(category.id, category);
    const parentKey = category.parent_id || 'root';
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, []);
    }
    childrenMap.get(parentKey).push(category);
    if (!childrenMap.has(category.id)) {
      childrenMap.set(category.id, []);
    }
  });

  return { categoriesById, childrenMap };
};

export const createCategoryResolver = (categories = [], walkthroughs = []) => {
  const { categoriesById, childrenMap } = buildCategoryMaps(categories);
  const descendantCache = new Map();
  const walkthroughCache = new Map();

  const normalizedWalkthroughs = Array.isArray(walkthroughs)
    ? walkthroughs.filter(Boolean)
    : [];

  const getNodeById = (nodeId) => {
    if (!nodeId) return null;
    return categoriesById.get(nodeId) || null;
  };

  const getChildren = (nodeId) => {
    const key = nodeId || 'root';
    return childrenMap.get(key) || [];
  };

  const collectDescendants = (nodeId, visited) => {
    const descendants = [];
    const stack = [...getChildren(nodeId)];
    const localVisited = new Set(visited);

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current?.id || localVisited.has(current.id)) {
        continue;
      }
      localVisited.add(current.id);
      descendants.push(current.id);
      const childNodes = getChildren(current.id);
      if (childNodes.length) {
        stack.push(...childNodes);
      }
    }

    return descendants;
  };

  const getDescendantIds = (nodeId, visited = new Set()) => {
    const cacheKey = nodeId || 'root';
    if (descendantCache.has(cacheKey)) {
      return descendantCache.get(cacheKey);
    }
    const descendants = collectDescendants(nodeId, visited);
    descendantCache.set(cacheKey, descendants);
    return descendants;
  };

  const getWalkthroughsForNode = (nodeId) => {
    const cacheKey = nodeId || 'root';
    if (walkthroughCache.has(cacheKey)) {
      return walkthroughCache.get(cacheKey);
    }
    const descendantIds = new Set([
      ...(nodeId ? [nodeId] : []),
      ...getDescendantIds(nodeId),
    ]);

    const matches = normalizedWalkthroughs.filter((walkthrough) => {
      if (!Array.isArray(walkthrough?.category_ids)) {
        return false;
      }
      return walkthrough.category_ids.some((categoryId) => (
        descendantIds.size === 0 ? !categoryId : descendantIds.has(categoryId)
      ));
    });

    walkthroughCache.set(cacheKey, matches);
    return matches;
  };

  const getEligibleChildren = (nodeId) => {
    const children = getChildren(nodeId);
    return children.filter((child) => getWalkthroughsForNode(child.id).length > 0);
  };

  const resolveNode = (nodeId, depth, handlers, visited = new Set()) => {
    if (!handlers) return;
    const {
      navigateToWalkthrough,
      showWalkthroughList,
      promptUserToChoose,
    } = handlers;

    if (!nodeId || visited.has(nodeId)) {
      const fallbackWalkthroughs = getWalkthroughsForNode(nodeId);
      showWalkthroughList?.(fallbackWalkthroughs);
      return;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    const walkthroughsForNode = getWalkthroughsForNode(nodeId);
    const eligibleChildren = getEligibleChildren(nodeId);

    if (walkthroughsForNode.length === 1) {
      navigateToWalkthrough?.(walkthroughsForNode[0]);
      return;
    }

    if (depth >= 3 || eligibleChildren.length === 0) {
      showWalkthroughList?.(walkthroughsForNode);
      return;
    }

    if (eligibleChildren.length === 1) {
      resolveNode(eligibleChildren[0].id, depth + 1, handlers, nextVisited);
      return;
    }

    promptUserToChoose?.(eligibleChildren, depth, (selectedId) => {
      if (!selectedId) {
        showWalkthroughList?.(walkthroughsForNode);
        return;
      }
      resolveNode(selectedId, depth + 1, handlers, nextVisited);
    });
  };

  const getEligibleRootNodes = () => getEligibleChildren(null);

  return {
    getNodeById,
    getChildren,
    getDescendantIds,
    getWalkthroughsForNode,
    getEligibleChildren,
    getEligibleRootNodes,
    resolveNode,
  };
};

export default createCategoryResolver;
