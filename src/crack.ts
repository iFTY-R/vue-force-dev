import { error } from './utils/console';
import { enablePiniaDevtools } from './plugins/index';
import type { VueDevtoolsMessageDetail } from './types/message';

const initializedVue3Apps = new WeakSet<object>();
const initializedVue2Constructors = new WeakSet<object>();

export function crack(data: VueDevtoolsMessageDetail) {
  const result = crackAllVueApps();

  if (result) data.devtoolsEnabled = true;

  return result;
}

export function crackAllVueApps() {
  const hasVue3 = crackVue3();
  const hasVue2 = crackVue2();

  return hasVue3 || hasVue2;
}

function crackVue2() {
  const apps = getVueRootInstances(2);
  if (!apps.length) return false;

  let initialized = false;
  for (const app of apps) {
    const Vue = getVue2Constructor(app);
    if (!Vue || initializedVue2Constructors.has(Vue)) continue;

    initializedVue2Constructors.add(Vue);
    initialized = initVue2Devtools(Vue) || initialized;
  }

  return initialized;
}

function initVue2Devtools(Vue) {
  const devtools = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  Vue.config.devtools = true;
  devtools.emit('init', Vue);

  return true;
}

function crackVue3() {
  const apps = getVueRootInstances(3);
  if (!apps.length) return false;

  const devtools = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  let initialized = false;

  for (const app of apps) {
    if (initializedVue3Apps.has(app)) continue;

    initializedVue3Apps.add(app);
    devtools.enabled = true;
    const version = app.version;
    devtools.emit('app:init' /* APP_INIT */, app, version, {
      Fragment: Symbol.for('v-fgt'),
      Text: Symbol.for('v-txt'),
      Comment: Symbol.for('v-cmt'),
      Static: Symbol.for('v-stc'),
    });

    try {
      enablePiniaDevtools(app, 3);
    } catch (e) {
      error(e);
    }

    initialized = true;
  }

  return initialized;
}

function getVueRootInstances(version: number) {
  const signProperty = version === 2 ? '__vue__' : '__vue_app__';
  const instances = [];
  const visitedRoots = new WeakSet<Document | ShadowRoot>();

  const visitRoot = (root: Document | ShadowRoot) => {
    if (visitedRoots.has(root)) return;
    visitedRoots.add(root);

    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i][signProperty]) {
        instances.push(all[i][signProperty]);
      }

      if (all[i].shadowRoot) {
        visitRoot(all[i].shadowRoot);
      }
    }
  };

  visitRoot(document);

  return instances;
}

function getVue2Constructor(app) {
  let Vue = Object.getPrototypeOf(app)?.constructor;
  while (Vue?.super) {
    Vue = Vue.super;
  }

  return Vue;
}
