import { X } from 'lucide-react';

interface CallEndedProps {
  isDoctor: boolean;
}

export const CallEnded = ({ isDoctor }: CallEndedProps) => {
  const handleClose = () => {
    // Close the browser window/tab
    window.close();

    // If window.close() doesn't work (blocked by browser), show a message
    setTimeout(() => {
      alert('You can safely close this window now.');
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-surface to-primary-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-surface rounded-md shadow-modal p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-title font-bold text-neutral-900 mb-3">
            {isDoctor ? 'Sprechstunde beendet' : 'Videosprechstunde beendet'}
          </h1>

          {/* Message */}
          <p className="text-body text-neutral-600 mb-8">
            {isDoctor
              ? 'Die Videosprechstunde wurde erfolgreich beendet. Vielen Dank für Ihre Zeit.'
              : 'Vielen Dank, dass Sie an der Videosprechstunde teilgenommen haben. Gute Besserung!'}
          </p>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-full h-12 bg-primary-500 text-white rounded-sm font-semibold text-body
              hover:bg-primary-600 transition-colors duration-fast
              flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Fenster schließen
          </button>

          {/* Additional Info */}
          <p className="text-small text-neutral-500 mt-6">
            Sie können diese Seite jetzt sicher schließen
          </p>
        </div>
      </div>
    </div>
  );
};
