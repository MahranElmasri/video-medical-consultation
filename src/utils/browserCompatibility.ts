/**
 * Browser compatibility utilities for mobile devices
 */

export interface BrowserInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'samsung' | 'unknown';
  supportsGetUserMedia: boolean;
}

/**
 * Detect browser and device information
 */
export const getBrowserInfo = (): BrowserInfo => {
  const userAgent = navigator.userAgent.toLowerCase();

  // Detect mobile
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);

  // Detect browser
  let browser: BrowserInfo['browser'] = 'unknown';
  if (userAgent.includes('samsungbrowser')) {
    browser = 'samsung';
  } else if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    browser = 'chrome';
  } else if (userAgent.includes('firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    browser = 'safari';
  } else if (userAgent.includes('edg')) {
    browser = 'edge';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    browser = 'opera';
  }

  // Check getUserMedia support
  const supportsGetUserMedia = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia
  );

  return {
    isMobile,
    isIOS,
    isAndroid,
    browser,
    supportsGetUserMedia,
  };
};

/**
 * Check if the site is running on HTTPS (required for camera/mic on mobile)
 */
export const isSecureContext = (): boolean => {
  return (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

/**
 * Get mobile-specific instructions for enabling camera/microphone
 */
export const getMobilePermissionInstructions = (browserInfo: BrowserInfo): string[] => {
  if (browserInfo.isIOS) {
    return [
      'Open your iPhone Settings app',
      'Scroll down and tap Safari (or your browser)',
      'Under "Settings for Websites", tap Camera and Microphone',
      'Ensure both are set to "Ask" or "Allow"',
      'Return to this page and refresh',
      'Tap "Join Call" again',
    ];
  }

  if (browserInfo.isAndroid) {
    if (browserInfo.browser === 'chrome' || browserInfo.browser === 'samsung') {
      return [
        'Close any overlays or bubbles from other apps (like Facebook Messenger)',
        'Tap the lock or info icon in the address bar',
        'Tap "Permissions" or "Site settings"',
        'Enable Camera and Microphone',
        'Refresh the page and try again',
      ];
    } else if (browserInfo.browser === 'firefox') {
      return [
        'Close any overlays from other apps',
        'Tap the menu (three dots) in the address bar',
        'Tap "Settings" > "Site permissions"',
        'Enable Camera and Microphone for this site',
        'Refresh the page and try again',
      ];
    }
  }

  return [
    'Close any overlays or popups from other apps',
    'Check your browser settings for camera/microphone permissions',
    'Ensure this site is allowed to access your devices',
    'Refresh the page and try again',
  ];
};

/**
 * Check if there might be overlays blocking permission requests
 * This is a common issue on Android when apps like Facebook Messenger have chat heads
 */
export const checkForPotentialOverlays = (): boolean => {
  const browserInfo = getBrowserInfo();

  // On Android Chrome, overlays are a common issue
  if (browserInfo.isAndroid && browserInfo.browser === 'chrome') {
    return true; // Potentially problematic
  }

  return false;
};

/**
 * Request camera and microphone with mobile-optimized approach
 * Returns a promise that resolves with the stream or rejects with a helpful error
 */
export const requestMediaDevicesMobile = async (): Promise<MediaStream> => {
  const browserInfo = getBrowserInfo();

  // Check secure context first
  if (!isSecureContext()) {
    throw new Error(
      'Camera and microphone require HTTPS. Please access this site using https:// instead of http://'
    );
  }

  // Check getUserMedia support
  if (!browserInfo.supportsGetUserMedia) {
    throw new Error(
      'Your browser does not support camera and microphone access. Please use a modern browser like Chrome, Firefox, or Safari.'
    );
  }

  try {
    // For mobile devices, use lower resolution and framerate for better performance
    const constraints: MediaStreamConstraints = {
      video: browserInfo.isMobile
        ? {
            width: { ideal: 640, max: 1280 },  // Lower resolution for mobile
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 }, // Lower framerate for mobile
            facingMode: 'user', // Front camera for mobile
          }
        : {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: browserInfo.isMobile ? 16000 : 48000, // Lower sample rate for mobile
      },
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    if (error instanceof DOMException) {
      // Handle specific mobile errors
      if (error.name === 'NotAllowedError') {
        if (checkForPotentialOverlays()) {
          throw new Error(
            'Permission denied. Please close any chat bubbles or overlays from other apps (like Facebook Messenger), then try again.'
          );
        }
        throw new Error(
          'Camera and microphone access denied. Please enable permissions in your browser settings.'
        );
      } else if (error.name === 'NotFoundError') {
        throw new Error(
          'No camera or microphone found. Please ensure your device has these capabilities and they are not being used by another app.'
        );
      } else if (error.name === 'NotReadableError') {
        throw new Error(
          'Camera or microphone is already in use by another application. Please close other apps using your camera/microphone and try again.'
        );
      } else if (error.name === 'OverconstrainedError') {
        throw new Error(
          'Your device does not support the required video quality. Please try with a different device.'
        );
      } else if (error.name === 'SecurityError') {
        throw new Error(
          'Security error. Please ensure you are accessing this page via HTTPS and not in a private/incognito window on some mobile browsers.'
        );
      }
    }

    throw error;
  }
};

/**
 * Show a mobile-friendly help dialog for permission issues
 */
export const getMobilePermissionHelp = (): {
  title: string;
  message: string;
  steps: string[];
} => {
  const browserInfo = getBrowserInfo();

  if (!isSecureContext()) {
    return {
      title: 'HTTPS Required',
      message:
        'For security reasons, camera and microphone access requires a secure connection (HTTPS).',
      steps: [
        'Make sure the URL starts with "https://"',
        'Contact the site administrator if you see "http://" in the address bar',
      ],
    };
  }

  if (checkForPotentialOverlays()) {
    return {
      title: 'Close Overlays and Chat Bubbles',
      message:
        'Android Chrome cannot ask for permissions when other apps have overlays on the screen.',
      steps: [
        'Look for floating chat heads (Facebook Messenger, WhatsApp, etc.)',
        'Close or minimize these chat bubbles',
        'Pull down your notification shade and dismiss any persistent notifications',
        'Return to this page and tap "Join Call" again',
      ],
    };
  }

  return {
    title: 'Enable Camera & Microphone',
    message:
      'This video consultation requires access to your camera and microphone.',
    steps: getMobilePermissionInstructions(browserInfo),
  };
};
