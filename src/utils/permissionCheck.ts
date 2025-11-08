export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface MediaPermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
}

/**
 * Check camera and microphone permissions status
 * Returns the permission state for both devices
 */
export const checkMediaPermissions = async (): Promise<MediaPermissions> => {
  const result: MediaPermissions = {
    camera: 'unsupported',
    microphone: 'unsupported',
  };

  // Check if Permissions API is available
  if (!navigator.permissions || !navigator.permissions.query) {
    console.warn('[PermissionCheck] Permissions API not supported');
    return result;
  }

  try {
    // Check camera permission
    try {
      const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      result.camera = cameraPermission.state as PermissionStatus;
      console.log('[PermissionCheck] Camera permission:', result.camera);
    } catch (error) {
      console.warn('[PermissionCheck] Could not query camera permission:', error);
      // Fallback: try to detect via getUserMedia availability
      result.camera = 'prompt';
    }

    // Check microphone permission
    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      result.microphone = micPermission.state as PermissionStatus;
      console.log('[PermissionCheck] Microphone permission:', result.microphone);
    } catch (error) {
      console.warn('[PermissionCheck] Could not query microphone permission:', error);
      // Fallback: try to detect via getUserMedia availability
      result.microphone = 'prompt';
    }
  } catch (error) {
    console.error('[PermissionCheck] Error checking permissions:', error);
  }

  return result;
};

/**
 * Detect the user's browser
 */
export const detectBrowser = (): string => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
    return 'Chrome';
  } else if (userAgent.includes('firefox')) {
    return 'Firefox';
  } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
    return 'Safari';
  } else if (userAgent.includes('edg')) {
    return 'Edge';
  } else if (userAgent.includes('opera') || userAgent.includes('opr')) {
    return 'Opera';
  }

  return 'Unknown';
};

/**
 * Get browser-specific instructions for enabling camera/microphone
 */
export const getBrowserInstructions = (browser: string): string[] => {
  switch (browser) {
    case 'Chrome':
    case 'Edge':
      return [
        'Click the camera icon in the address bar (or lock icon)',
        'Select "Allow" for Camera and Microphone',
        'Refresh the page and try again',
      ];
    case 'Firefox':
      return [
        'Click the camera or microphone icon in the address bar',
        'Remove the "Blocked" status for both devices',
        'Refresh the page and try again',
      ];
    case 'Safari':
      return [
        'Go to Safari > Settings (or Preferences) > Websites',
        'Select Camera and Microphone from the left sidebar',
        'Find this website and change permission to "Allow"',
        'Refresh the page and try again',
      ];
    default:
      return [
        'Look for a camera/microphone icon in your browser\'s address bar',
        'Change the permission settings to "Allow"',
        'Refresh the page and try again',
      ];
  }
};

/**
 * Check if media devices are available (hardware check)
 */
export const checkMediaDevicesAvailable = async (): Promise<{
  hasCamera: boolean;
  hasMicrophone: boolean;
}> => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { hasCamera: false, hasMicrophone: false };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();

    const hasCamera = devices.some(device => device.kind === 'videoinput');
    const hasMicrophone = devices.some(device => device.kind === 'audioinput');

    console.log('[PermissionCheck] Devices available:', { hasCamera, hasMicrophone });

    return { hasCamera, hasMicrophone };
  } catch (error) {
    console.error('[PermissionCheck] Error checking media devices:', error);
    return { hasCamera: false, hasMicrophone: false };
  }
};
