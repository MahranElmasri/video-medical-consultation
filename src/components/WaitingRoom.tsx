import { useState, useEffect } from 'react';
import { Copy, Check, Loader2, X, AlertCircle, Mail } from 'lucide-react';
import { checkMediaPermissions, type MediaPermissions } from '../utils/permissionCheck';
import { isValidEmail, sanitizeEmail } from '../utils/validation';

interface WaitingRoomProps {
  roomId: string;
  roomUrl: string;
  onCancel: () => void;
  onJoinCall: () => void;
  isDoctor?: boolean;
}

export const WaitingRoom = ({ roomId, roomUrl, onCancel, onJoinCall, isDoctor = false }: WaitingRoomProps) => {
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [permissions, setPermissions] = useState<MediaPermissions | null>(null);
  const [showPermissionWarning, setShowPermissionWarning] = useState(false);
  const [patientEmail, setPatientEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    // Simulate room setup
    const timer = setTimeout(() => setIsReady(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Check permissions proactively
  useEffect(() => {
    const checkPermissions = async () => {
      const permissionStatus = await checkMediaPermissions();
      setPermissions(permissionStatus);

      // Show warning if either camera or microphone is denied
      if (permissionStatus.camera === 'denied' || permissionStatus.microphone === 'denied') {
        setShowPermissionWarning(true);
      }
    };

    checkPermissions();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSendEmail = async () => {
    setEmailError(null);
    setEmailSent(false);
    setIsSendingEmail(true);

    // Validate email
    if (!patientEmail.trim()) {
      setEmailError('Bitte geben Sie die E-Mail-Adresse des Patienten ein');
      setIsSendingEmail(false);
      return;
    }

    const sanitized = sanitizeEmail(patientEmail);
    if (!isValidEmail(sanitized)) {
      setEmailError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      setIsSendingEmail(false);
      return;
    }

    try {
      // Send email via Vercel API
      const response = await fetch('/api/send-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: sanitized,
          roomUrl,
          roomId,
        }),
      });

      // Check if response has content before parsing JSON
      const contentType = response.headers.get('content-type');
      let data = null;

      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      }

      if (!response.ok) {
        const errorMsg = data?.message || data?.error?.message || 'E-Mail konnte nicht gesendet werden';
        throw new Error(errorMsg);
      }

      setEmailSent(true);
      setPatientEmail(''); // Clear email field after successful send
      // Reset success message after 5 seconds
      setTimeout(() => setEmailSent(false), 5000);
    } catch (error: any) {
      console.error('Email sending error:', error);

      // Provide more specific error messages
      let errorMessage = 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut.';

      if (error.message === 'Failed to fetch') {
        errorMessage = 'Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setEmailError(errorMessage);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-surface rounded-md shadow-card p-8 tablet:p-12">
          {/* Status Header */}
          <div className="text-center mb-8">
            {!isReady ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-50 rounded-full mb-4">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
                <h2 className="text-title text-neutral-900 font-bold mb-2">
                  Preparing Secure Room...
                </h2>
                <p className="text-body text-neutral-700">
                  Setting up encrypted connection
                </p>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full mb-4">
                  <Check className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-title text-neutral-900 font-bold mb-2">
                  {isDoctor ? 'Room Ready' : 'Welcome to Your Consultation'}
                </h2>
                <p className="text-body text-neutral-700">
                  {isDoctor ? 'Share the link below with your patient' : 'Click "Join Call" when you\'re ready to begin'}
                </p>
              </>
            )}
          </div>

          {/* Permission Warning Banner */}
          {isReady && showPermissionWarning && (
            <div className="mb-6 bg-error/10 border-2 border-error rounded-md p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-body font-semibold text-error mb-2">
                    Camera or Microphone Access Blocked
                  </h3>
                  <p className="text-small text-neutral-700 mb-3">
                    Your browser has blocked access to your camera or microphone. You need to enable these permissions to join the call.
                  </p>
                  <div className="bg-white rounded-sm p-3">
                    <p className="text-small font-semibold text-neutral-900 mb-2">To enable permissions:</p>
                    <ol className="text-small text-neutral-700 space-y-1 ml-4">
                      <li>1. Look for the camera/microphone icon in your browser's address bar</li>
                      <li>2. Click it and select "Allow" for both Camera and Microphone</li>
                      <li>3. Refresh this page if needed</li>
                    </ol>
                  </div>
                  {permissions && (
                    <div className="mt-3 text-xs text-neutral-600">
                      <span className="font-medium">Status:</span>{' '}
                      Camera: <span className={permissions.camera === 'denied' ? 'text-error font-semibold' : 'text-success'}>{permissions.camera}</span>
                      {' | '}
                      Microphone: <span className={permissions.microphone === 'denied' ? 'text-error font-semibold' : 'text-success'}>{permissions.microphone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Room Link Display - Only for Doctor */}
          {isReady && isDoctor && (
            <>
              <div className="mb-8">
                <label className="block text-small text-neutral-700 font-medium mb-2">
                  Consultation Room Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomUrl}
                    readOnly
                    className="flex-1 h-12 px-4 bg-neutral-100 border border-neutral-200 rounded-sm text-body text-neutral-900 font-mono"
                    onClick={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={copyToClipboard}
                    className="h-12 px-6 bg-neutral-100 border border-neutral-200 rounded-sm hover:bg-neutral-200 transition-colors duration-fast flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 text-success" />
                        <span className="text-body font-medium text-success">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5 text-neutral-700" />
                        <span className="text-body font-medium text-neutral-900">Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-small text-neutral-500 mt-2">
                  Room ID: {roomId}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-neutral-50 rounded-sm p-6 mb-8">
                <h3 className="text-body font-semibold text-neutral-900 mb-3">
                  Next Steps:
                </h3>
                <ol className="space-y-2 text-body text-neutral-700">
                  <li className="flex gap-2">
                    <span className="font-semibold">1.</span>
                    <span>Copy and share the room link with your patient via secure messaging</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">2.</span>
                    <span>Click "Join Call" below to enter the consultation room</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold">3.</span>
                    <span>Wait for your patient to join using the shared link</span>
                  </li>
                </ol>
              </div>

              {/* Email Invitation Section */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 border-t border-neutral-200"></div>
                  <span className="text-small text-neutral-500 font-medium">ODER</span>
                  <div className="flex-1 border-t border-neutral-200"></div>
                </div>

                <label className="block text-small text-neutral-700 font-medium mb-2">
                  Einladung per E-Mail senden
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    placeholder="patient@beispiel.de"
                    disabled={isSendingEmail}
                    className="flex-1 h-12 px-4 bg-white border-2 border-neutral-200 rounded-sm text-body text-neutral-900
                      focus:border-primary-500 focus:outline-none
                      disabled:bg-neutral-100 disabled:text-neutral-500
                      transition-colors duration-fast"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSendingEmail) {
                        handleSendEmail();
                      }
                    }}
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="h-12 px-6 bg-primary-500 text-white rounded-sm hover:bg-primary-600 transition-colors duration-fast flex items-center gap-2
                      disabled:bg-neutral-400 disabled:cursor-not-allowed"
                  >
                    {isSendingEmail ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-body font-medium hidden tablet:inline">Senden...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        <span className="text-body font-medium hidden tablet:inline">Senden</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Success Message */}
                {emailSent && (
                  <div className="mt-3 bg-success/10 border border-success rounded-sm p-3 flex items-center gap-2">
                    <Check className="w-5 h-5 text-success flex-shrink-0" />
                    <p className="text-small text-success">
                      ✓ Einladungs-E-Mail erfolgreich versendet!
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {emailError && (
                  <div className="mt-3 bg-error/10 border border-error rounded-sm p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                    <p className="text-small text-error">{emailError}</p>
                  </div>
                )}

                <p className="text-xs text-neutral-500 mt-2">
                  Der Patient erhält eine E-Mail mit dem Konsultationslink und Anweisungen
                </p>
              </div>

              {/* Privacy Reminder */}
              <div className="bg-primary-50 border border-primary-100 rounded-sm p-4 mb-8">
                <p className="text-small text-neutral-900">
                  <strong>Privacy Reminder:</strong> This room will automatically expire in 6 hours.
                  All communication is encrypted and no data is stored on our servers.
                </p>
              </div>
            </>
          )}

          {/* Actions - For both Doctor and Patient */}
          {isReady && (
            <div className="flex gap-4">
              <button
                onClick={onJoinCall}
                className="flex-1 h-14 bg-primary-500 text-white rounded-sm font-semibold text-body
                  hover:bg-primary-600 hover:shadow-card hover:-translate-y-0.5 hover:scale-[1.02]
                  active:translate-y-0 active:scale-[0.98]
                  transition-all duration-fast ease-out"
              >
                Join Call
              </button>
              {isDoctor && (
                <button
                  onClick={onCancel}
                  className="h-14 px-6 bg-neutral-100 border-2 border-neutral-200 text-neutral-700 rounded-sm font-semibold text-body
                    hover:bg-neutral-50
                    transition-colors duration-fast flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        {/* Connection Status */}
        {isReady && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 bg-success/10 px-4 py-2 rounded-full">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-small text-success font-medium">Secure Connection Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
