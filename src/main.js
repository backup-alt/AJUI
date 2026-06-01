import './styles.css';
import screenPolishCss from './screen-polish.css?inline';
import QRCode from 'qrcode';

const screens = {
  home: {
    title: 'Annai Jewellers - Home',
    path: '/screens/annai_home_interactive_royal_repaired/code.html',
  },
  shop: {
    title: 'Annai Jewellers - Shop',
    path: '/screens/shop_jewellery_updated_header/code.html',
  },
  schemes: {
    title: 'Plan Details',
    path: '/screens/scheme_details_multi_scheme_carousel/code.html',
  },
  news: {
    title: 'Annai Jewellers - News Feed',
    path: '/screens/annai_news_feed_updated_header/code.html',
  },
  payments: {
    title: 'Payment History - Annai Jewellers',
    path: '/screens/payments_updated_nav/code.html',
  },
  profile: {
    title: 'Annai Jewellers - Profile',
    path: '/screens/profile_updated_nav/code.html',
  },
  join: {
    title: 'Join Scheme - Annai Jewellers',
    path: '/screens/join_scheme_personalized_refined/code.html',
  },
  schemeCategories: {
    title: 'Select Scheme - Annai Jewellers',
    path: '/screens/scheme_categories/code.html',
  },
  homeLoading: {
    title: 'Annai Jewellers - Loading',
    path: '/screens/annai_home_loading/code.html',
  },
  newsLoading: {
    title: 'Annai News Feed - Loading',
    path: '/screens/annai_news_feed_loading/code.html',
  },
  newsEmpty: {
    title: 'Annai News Feed',
    path: '/screens/annai_news_feed_no_content/code.html',
  },
  shopLoading: {
    title: 'Annai Jewellers - Loading Shop',
    path: '/screens/shop_jewellery_loading/code.html',
  },
  shopEmpty: {
    title: 'Annai Jewellers | Shop',
    path: '/screens/shop_jewellery_empty_state/code.html',
  },
  schemeLoading: {
    title: 'Plan Details Loading',
    path: '/screens/scheme_details_loading/code.html',
  },
  schemeNoActive: {
    title: 'Annai Jewellers - No Active Schemes',
    path: '/screens/scheme_details_no_active_schemes/code.html',
  },
  networkError1: {
    title: 'Connection Interrupted - Annai Jewellers',
    path: '/screens/scheme_details_minimal_animated_network_error_1/code.html',
  },
  networkError2: {
    title: 'Connection Interrupted - Annai Jewellers',
    path: '/screens/scheme_details_minimal_animated_network_error_2/code.html',
  },
  networkError3: {
    title: 'Connection Interrupted - Annai Jewellers',
    path: '/screens/scheme_details_minimal_animated_network_error_3/code.html',
  },
};

const aliases = {
  annai_home_interactive_royal_repaired: 'home',
  annai_home_loading: 'homeLoading',
  annai_news_feed_loading: 'newsLoading',
  annai_news_feed_no_content: 'newsEmpty',
  annai_news_feed_updated_header: 'news',
  join_scheme_personalized_refined: 'join',
  payments_updated_nav: 'payments',
  profile_updated_nav: 'profile',
  scheme_categories: 'schemeCategories',
  scheme_details_loading: 'schemeLoading',
  scheme_details_minimal_animated_network_error_1: 'networkError1',
  scheme_details_minimal_animated_network_error_2: 'networkError2',
  scheme_details_minimal_animated_network_error_3: 'networkError3',
  scheme_details_multi_scheme_carousel: 'schemes',
  scheme_details_no_active_schemes: 'schemeNoActive',
  shop_jewellery_empty_state: 'shopEmpty',
  shop_jewellery_loading: 'shopLoading',
  shop_jewellery_updated_header: 'shop',
};

const screenStack = document.getElementById('screen-stack');
const initialFrame = document.getElementById('screen-frame');
const splash = document.getElementById('splash-screen');
const qrModal = document.getElementById('qr-modal');
const qrCanvas = document.getElementById('qr-canvas');
const appNav = document.getElementById('app-nav');

let activeRoute = 'home';
let activeFrame = initialFrame;
let splashHidden = false;
let initialAppLoaded = false;
let splashTimer = window.setTimeout(revealAppAfterSplash, 8000);
let screensWarmed = false;
let qrReady = false;
const SPLASH_MIN_DURATION = 3200;
const SPLASH_ROUTE_SETTLE_DELAY = 520;
const SPLASH_EXIT_DURATION = 560;
const splashStartedAt = performance.now();

const frames = new Map([['home', initialFrame]]);
const preloadedRoutes = [
  'shop',
  'schemes',
  'news',
  'payments',
  'profile',
  'schemeCategories',
  'join',
];
const QR_PAYLOAD = 'ANNAI-JEWELLERS|CUSTOMER:John Doe|ID:AJ-2026-0001';

function normaliseRoute(route) {
  const cleanRoute = route.replace(/^#?\/?/, '').trim();
  return screens[cleanRoute] ? cleanRoute : aliases[cleanRoute] || 'home';
}

function routeFromHash() {
  const rawRoute = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  return normaliseRoute(rawRoute || 'home');
}

function navigateTo(route) {
  const nextRoute = normaliseRoute(route);
  if (activeRoute === nextRoute) {
    return;
  }
  window.location.hash = `/${nextRoute}`;
}

function routeGroup(route) {
  return route === 'schemeCategories' || route === 'join' || route === 'schemes'
    ? 'schemes'
    : route;
}

function syncAppNav(route) {
  const activeGroup = routeGroup(route);
  appNav.querySelectorAll('[data-route]').forEach((button) => {
    const buttonGroup = routeGroup(normaliseRoute(button.dataset.route));
    const isActive = buttonGroup === activeGroup;
    button.classList.toggle('is-active', isActive);
    if (isActive) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  });
}

function createFrame(route) {
  const screen = screens[route];
  const nextFrame = document.createElement('iframe');
  nextFrame.className = 'screen-frame';
  nextFrame.title = screen.title;
  nextFrame.src = screen.path;
  nextFrame.loading = 'eager';
  nextFrame.dataset.route = route;
  nextFrame.setAttribute('aria-hidden', 'true');
  nextFrame.addEventListener('load', () => bindFrameNavigation(nextFrame));
  screenStack.append(nextFrame);
  frames.set(route, nextFrame);
  return nextFrame;
}

function getFrame(route) {
  return frames.get(route) || createFrame(route);
}

function routeForNavControl(control) {
  const icons = Array.from(control.querySelectorAll('.material-symbols-outlined'))
    .map((icon) => icon.textContent.trim().toLowerCase())
    .join(' ');
  const label = [
    control.getAttribute('aria-label'),
    control.getAttribute('title'),
    control.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const signal = `${icons} ${label}`;

  if (signal.includes('home')) {
    return 'home';
  }
  if (signal.includes('shopping_bag') || signal.includes('shop')) {
    return 'shop';
  }
  if (signal.includes('savings') || signal.includes('scheme')) {
    return 'schemes';
  }
  if (signal.includes('newspaper') || signal.includes('news')) {
    return 'news';
  }
  if (signal.includes('receipt_long') || signal.includes('payment')) {
    return 'payments';
  }
  if (signal.includes('person') || signal.includes('profile')) {
    return 'profile';
  }

  return null;
}

function syncScreenChrome(doc, route) {
  const groupedRoute = routeGroup(route);

  doc.querySelectorAll('nav a, nav button').forEach((control) => {
    const controlRoute = routeForNavControl(control);
    if (controlRoute === groupedRoute) {
      control.dataset.annaiActive = 'true';
    } else {
      delete control.dataset.annaiActive;
    }
  });
}

function applyScreenPolish(doc, route) {
  if (!doc.getElementById('annai-polish-style')) {
    const style = doc.createElement('style');
    style.id = 'annai-polish-style';
    style.textContent = screenPolishCss;
    doc.head.append(style);
  }

  doc.documentElement.dataset.annaiRoute = route;
  if (doc.body) {
    doc.body.dataset.annaiRoute = route;
  }
  syncScreenChrome(doc, route);
}

function loadRoute(route) {
  const nextRoute = normaliseRoute(route);
  const screen = screens[nextRoute];
  const nextFrame = getFrame(nextRoute);
  const expectedSrc = new URL(screen.path, window.location.origin).href;
  if (nextFrame.src !== expectedSrc) {
    nextFrame.src = screen.path;
  }

  activeRoute = nextRoute;
  document.title = screen.title;
  syncAppNav(nextRoute);

  if (activeFrame !== nextFrame) {
    activeFrame.classList.remove('is-active');
    activeFrame.setAttribute('aria-hidden', 'true');
  }

  nextFrame.classList.add('is-active');
  nextFrame.removeAttribute('aria-hidden');
  activeFrame = nextFrame;
  window.requestAnimationFrame(() => bindFrameNavigation(nextFrame));
}

function warmScreens() {
  if (screensWarmed) {
    return;
  }

  screensWarmed = true;
  const warm = () => {
    let index = 0;
    const warmNext = () => {
      getFrame(preloadedRoutes[index]);
      index += 1;
      if (index < preloadedRoutes.length) {
        window.setTimeout(warmNext, 90);
      }
    };
    warmNext();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warm, { timeout: 800 });
  } else {
    window.setTimeout(warm, 250);
  }
}

function hideSplash() {
  if (splashHidden) {
    return;
  }

  splashHidden = true;
  window.clearTimeout(splashTimer);
  splash.classList.add('is-hidden');
  window.setTimeout(() => {
    splash.remove();
    warmScreens();
  }, SPLASH_EXIT_DURATION);
}

function loadInitialRoute() {
  if (initialAppLoaded) {
    return;
  }

  initialAppLoaded = true;
  loadRoute(routeFromHash());
}

function revealAppAfterSplash() {
  if (splashHidden) {
    return;
  }

  loadInitialRoute();
  window.setTimeout(hideSplash, SPLASH_ROUTE_SETTLE_DELAY);
}

function primeSplash() {
  window.clearTimeout(splashTimer);
  const splashImages = Array.from(splash.querySelectorAll('img'));
  const waitForImages = splashImages.map((image) => {
    if (image.complete) {
      return Promise.resolve();
    }

    if (typeof image.decode === 'function') {
      return image.decode().catch(() => {});
    }

    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  });

  Promise.all(waitForImages).finally(() => {
    const elapsed = performance.now() - splashStartedAt;
    const remaining = Math.max(0, SPLASH_MIN_DURATION - elapsed);
    splashTimer = window.setTimeout(revealAppAfterSplash, remaining);
  });
}

async function renderQrCode() {
  if (qrReady || !qrCanvas) {
    return;
  }

  await QRCode.toCanvas(qrCanvas, QR_PAYLOAD, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1a1c1c',
      light: '#ffffff',
    },
  });
  qrReady = true;
}

function showQrModal() {
  renderQrCode().catch(() => {});
  qrModal.hidden = false;
  qrModal.classList.add('is-open');
}

function hideQrModal() {
  qrModal.classList.remove('is-open');
  window.setTimeout(() => {
    qrModal.hidden = true;
  }, 180);
}

function isQrTap(target) {
  const node =
    target && typeof target.closest === 'function' ? target : target?.parentElement;
  if (!node) {
    return false;
  }

  const qrIcon = node.closest('.material-symbols-outlined');
  if (qrIcon?.textContent.trim().toLowerCase() === 'qr_code_2') {
    return true;
  }

  const candidate = node.closest('div');
  return candidate?.textContent.trim().toLowerCase() === 'qr_code_2';
}

function routeForSchemeDetailsCard(target) {
  if (activeRoute !== 'schemes') {
    return null;
  }

  const node =
    target && typeof target.closest === 'function' ? target : target?.parentElement;
  if (!node) {
    return null;
  }

  const localAction = node.closest('[onclick]');
  if (
    localAction &&
    /switchScheme|nextScheme|prevScheme|switchTab/i.test(
      localAction.getAttribute('onclick') || '',
    )
  ) {
    return null;
  }

  const card = node.closest('#hero-card, .metric-card');
  return card ? 'join' : null;
}

function routeForControl(control) {
  if (control.id === 'editProfileButton' || control.closest('#profileForm')) {
    return null;
  }

  const inlineAction = control.getAttribute('onclick') || '';
  if (/switchScheme|nextScheme|prevScheme|switchTab/i.test(inlineAction)) {
    return null;
  }

  const icons = Array.from(control.querySelectorAll('.material-symbols-outlined'))
    .map((icon) => icon.textContent.trim().toLowerCase())
    .join(' ');
  const imageText = Array.from(control.querySelectorAll('img'))
    .map((image) => image.getAttribute('alt') || '')
    .join(' ');
  const accessibleText = [
    control.getAttribute('aria-label'),
    control.getAttribute('title'),
    imageText,
  ]
    .filter(Boolean)
    .join(' ');
  const label = control.textContent.trim().replace(/\s+/g, ' ').toLowerCase();
  const signal = `${icons} ${accessibleText} ${label}`.toLowerCase();

  if (
    activeRoute === 'schemeCategories' &&
    control.tagName === 'BUTTON' &&
    !control.hasAttribute('aria-pressed') &&
    control.querySelector('img') &&
    control.querySelector('h3')
  ) {
    return 'join';
  }
  if (label.includes('explore saving') && label.includes('scheme')) {
    return 'schemeCategories';
  }
  if (label.includes('continue to pay')) {
    return 'payments';
  }
  if (signal.includes('arrow_back')) {
    return 'back';
  }
  if (signal.includes('home')) {
    return 'home';
  }
  if (signal.includes('shopping_bag') || signal.includes('shop')) {
    return 'shop';
  }
  if (signal.includes('savings') || signal.includes('scheme')) {
    if (signal.includes('explore') || signal.includes('select') || signal.includes('join')) {
      return 'schemeCategories';
    }
    return 'schemes';
  }
  if (signal.includes('newspaper') || signal.includes('news')) {
    return 'news';
  }
  if (signal.includes('receipt_long') || signal.includes('payment')) {
    return 'payments';
  }
  if (signal.includes('person') || signal.includes('profile')) {
    return 'profile';
  }
  return null;
}

function bindFrameNavigation(frameElement = activeFrame) {
  let doc;
  try {
    doc = frameElement.contentDocument;
  } catch {
    return;
  }

  if (!doc) {
    return;
  }

  applyScreenPolish(doc, frameElement.dataset.route || activeRoute);

  if (doc.__annaiNavigationBound) {
    return;
  }

  doc.__annaiNavigationBound = true;
  doc.addEventListener(
    'click',
    (event) => {
      if (isQrTap(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showQrModal();
        return;
      }

      const target =
        event.target && typeof event.target.closest === 'function'
          ? event.target
          : event.target?.parentElement;
      const cardRoute = routeForSchemeDetailsCard(target);
      if (cardRoute) {
        event.preventDefault();
        event.stopImmediatePropagation();
        navigateTo(cardRoute);
        return;
      }

      const control = target?.closest('a, button, [role="button"], [onclick]');
      if (!control) {
        return;
      }

      const route = routeForControl(control);
      if (!route) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (route === 'back') {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          navigateTo('home');
        }
        return;
      }

      navigateTo(route);
    },
    true,
  );
}

function handleAppBack() {
  if (!qrModal.hidden) {
    hideQrModal();
    return;
  }

  if (activeRoute !== 'home') {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigateTo('home');
    }
  }
}

window.__annaiHandleNativeBack = handleAppBack;
window.addEventListener('hashchange', () => loadRoute(routeFromHash()));
qrModal.addEventListener('click', (event) => {
  if (event.target.closest('[data-close-qr]')) {
    hideQrModal();
  }
});
appNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-route]');
  if (button) {
    navigateTo(button.dataset.route);
  }
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !qrModal.hidden) {
    hideQrModal();
  }
});
initialFrame.addEventListener('load', () => bindFrameNavigation(initialFrame));

const initialRoute = routeFromHash();
document.title = screens[initialRoute].title;
syncAppNav(initialRoute);
primeSplash();
