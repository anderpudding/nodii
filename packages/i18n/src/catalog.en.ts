import type { MessageKey } from './catalog.ko';
import type { PluralKey } from './translate';

export const en: Partial<Record<MessageKey | PluralKey, string>> = {
  // goal

  // settings
  'settings.language': 'Language',
  'settings.language.system': 'System',
  'settings.language.ko': '한국어',
  'settings.language.en': 'English',
  'settings.language.loadFailed': "Couldn't load your language setting",
  'settings.language.saveFailed': "Couldn't save your language",

  // sync

  // auth
  'auth.brand': 'Nodii',
  'auth.title': 'Get Started with Nodii',
  'auth.description':
    "Log in with a 6-digit code sent to your email. If you're new, you'll sign up too.",
  'auth.email.help':
    "Your code is valid for 10 minutes. Check your spam folder if you don't see the email.",
  'auth.code.title': 'Code Sent',
  'auth.code.description':
    "Enter the 6-digit code sent to {email}. Check your spam folder if you don't see the email.",
  'auth.email': 'Email',
  'auth.email.placeholder': 'name@example.com',
  'auth.email.invalid': 'Check your email address.',
  'auth.password': 'Password',
  'auth.code': 'Code',
  'auth.code.label': '6-digit code',
  'auth.send': 'Get Code',
  'auth.sending': 'Sending…',
  'auth.login': 'Log In',
  'auth.loggingIn': 'Logging In…',
  'auth.verifying': 'Verifying…',
  'auth.resend': 'Resend Code',
  'auth.resendCountdown': 'You can request a new code in {minutes}:{seconds}',
  'auth.changeEmail': 'Use Another Email',
  'auth.error.invalid_code': "That code doesn't match. Check the numbers in your email.",
  'auth.error.expired': 'Your code has expired (10 minutes). Get a new code.',
  'auth.error.rate_limited': 'Too many requests. Try again in a moment.',
  'auth.error.network': 'Check your internet connection and try again.',
  'auth.error.unknown': "Couldn't log in. Try again in a moment.",
  'auth.error.review': "Your email or password doesn't match. Check them again.",
  'auth.logout': 'Log Out',
  'auth.logout.local': 'Logged out on this device',
  'auth.logout.failed': "Couldn't log out. Try again.",

  // mobile

  // day

  // todo

  // calendar

  // date

  // routine

  // common

  // app
  'app.update.versions': 'Current version {current} · Required version {minimum}',
  'app.config.title': 'Connection Setup Required',
  'app.config.description':
    'Set the Supabase URL and public key in your development environment, then restart.',
  'app.menu.failed': "Couldn't prepare the menu. Reopen the app.",
  'app.session.checking': 'Checking your login details…',
  'app.profile.failed': "Couldn't load your date settings.",
  'app.sidebar': 'Calendar and management menus',
  'app.management': 'Management',
  'app.connection': 'Connection status',
  'app.settingsManagement': 'Settings and management',
  'app.error.description': 'Your data is still here. Try again.',
  'app.update.title': 'Update Required',
  'app.update.instruction': 'Update from the App Store.',
  'app.update.data': 'Your data will stay as it is.',
  'app.update.pending': 'The App Store link is being prepared.',

  // menu
  'menu.about': 'About Nodii',
  'menu.settings': 'Settings…',
  'menu.services': 'Services',
  'menu.hide': 'Hide Nodii',
  'menu.hideOthers': 'Hide Others',
  'menu.showAll': 'Show All',
  'menu.quit': 'Quit Nodii',
  'menu.file': 'File',
  'menu.newTodo': 'New Todo',
  'menu.closeWindow': 'Close Window',
  'menu.edit': 'Edit',
  'menu.redo': 'Redo',
  'menu.cut': 'Cut',
  'menu.copy': 'Copy',
  'menu.paste': 'Paste',
  'menu.selectAll': 'Select All',
  'menu.fullscreen': 'Enter Full Screen',
  'menu.window': 'Window',
  'menu.minimize': 'Minimize',
  'menu.maximize': 'Zoom',
  'menu.bringAllToFront': 'Bring All to Front',
};
