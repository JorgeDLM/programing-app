'use strict';

function refinePreparedContext(contextPackage, options = {}) {
  if (typeof options.refiner !== 'function') {
    return {
      contextPackage,
      refinement: {
        used: false,
        reason: 'deterministic-only'
      }
    };
  }

  const nextPackage = options.refiner(contextPackage);
  return {
    contextPackage: nextPackage || contextPackage,
    refinement: {
      used: true,
      reason: 'custom-refiner'
    }
  };
}

module.exports = {
  refinePreparedContext
};
