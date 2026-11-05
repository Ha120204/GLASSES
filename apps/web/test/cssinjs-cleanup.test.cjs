const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

test('Ant Design runs style cleanup registered after unmount', async () => {
  const hookPath = require.resolve('@ant-design/cssinjs/lib/hooks/useEffectCleanupRegister.js', {
    paths: [require.resolve('antd')],
  });
  const originalLoad = Module._load;
  let effectCleanup;

  try {
    Module._load = function (request, parent, isMain) {
      if (request === 'react' && parent?.filename === hookPath) {
        return {
          useInsertionEffect() {},
          useEffect(setup) { effectCleanup = setup(); },
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    delete require.cache[hookPath];
    const useCleanupRegister = require(hookPath).default;
    const register = useCleanupRegister([]);
    let cleanupsRun = 0;
    register(() => { cleanupsRun += 1; });
    assert.equal(cleanupsRun, 0);
    effectCleanup();
    assert.equal(cleanupsRun, 1);
    register(() => { cleanupsRun += 1; });
    assert.equal(cleanupsRun, 1);
    await Promise.resolve();
    assert.equal(cleanupsRun, 2);
  } finally {
    Module._load = originalLoad;
    delete require.cache[hookPath];
  }
});
