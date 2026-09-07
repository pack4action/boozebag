// Loads the site's plain-global game modules into plain Node.
//
// The site's scripts are plain browser globals -- no modules, no build step
// -- so a file is run in a throwaway context holding nothing but a fake
// `window`, and whatever it hangs there is handed back. That keeps the
// tested code the exact same file the page loads, rather than a copy that
// drifts from it.
//
// Several files can be loaded into ONE fake window, in order, because they
// depend on each other the same way the page's <script> tags do:
// gym-walk.js reads window.BoozebagGymPlan at call time.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JS_DIR = path.join(__dirname, '..', '..', 'assets', 'js');

function loadSite(files) {
  const window = {};
  files.forEach((name) => {
    const file = path.join(JS_DIR, name);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window }, { filename: file });
  });
  return window;
}

function loadPlan() {
  const { BoozebagGymPlan } = loadSite(['gym-plan.js']);
  if (!BoozebagGymPlan) throw new Error('gym-plan.js did not define window.BoozebagGymPlan');
  return BoozebagGymPlan;
}

function loadWalk() {
  const { BoozebagGymPlan, BoozebagGymWalk } = loadSite(['gym-plan.js', 'gym-walk.js']);
  if (!BoozebagGymWalk) throw new Error('gym-walk.js did not define window.BoozebagGymWalk');
  return { plan: BoozebagGymPlan, walk: BoozebagGymWalk };
}

module.exports = { loadSite, loadPlan, loadWalk };
