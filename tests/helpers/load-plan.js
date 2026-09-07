// Loads assets/js/gym-plan.js into plain Node.
//
// The site's scripts are plain browser globals -- no modules, no build step
// -- so the file is run in a throwaway context holding nothing but a fake
// `window`, and whatever it hangs there is handed back. That keeps the
// tested code the exact same file the page loads, rather than a copy that
// drifts from it.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PLAN_SRC = path.join(__dirname, '..', '..', 'assets', 'js', 'gym-plan.js');

function loadPlan() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(PLAN_SRC, 'utf8'), { window }, { filename: PLAN_SRC });
  if (!window.BoozebagGymPlan) {
    throw new Error(`${PLAN_SRC} did not define window.BoozebagGymPlan`);
  }
  return window.BoozebagGymPlan;
}

module.exports = { loadPlan };
