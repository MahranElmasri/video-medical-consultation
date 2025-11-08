import { useState } from 'react';
import { Shield, Lock, Clock, Video } from 'lucide-react';

interface LandingPageProps {
  onStartConsultation: () => void;
}

export const LandingPage = ({ onStartConsultation }: LandingPageProps) => {
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await onStartConsultation();
    } catch (error) {
      console.error('Failed to start consultation:', error);
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-16 tablet:py-24">
        <div className="max-w-4xl w-full text-center">
          <div className="bg-surface rounded-md shadow-card p-8 tablet:p-12">
            {/* Title */}
            <h1 className="text-[40px] tablet:text-hero font-bold text-neutral-900 mb-4 leading-tight">
              Secure Medical Video Consultation
            </h1>
            
            {/* Subtitle */}
            <p className="text-body-lg text-neutral-700 mb-12 max-w-2xl mx-auto">
              Connect with healthcare professionals through encrypted, HIPAA-compliant video consultations.
            </p>

            {/* Trust Badges */}
            <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4 mb-12">
              <div className="bg-neutral-100 rounded-sm p-6 flex items-center justify-center gap-3">
                <Shield className="w-5 h-5 text-success" />
                <span className="text-small text-neutral-900 font-medium">HIPAA Compliant</span>
              </div>
              <div className="bg-neutral-100 rounded-sm p-6 flex items-center justify-center gap-3">
                <Lock className="w-5 h-5 text-success" />
                <span className="text-small text-neutral-900 font-medium">End-to-End Encrypted</span>
              </div>
              <div className="bg-neutral-100 rounded-sm p-6 flex items-center justify-center gap-3">
                <Clock className="w-5 h-5 text-success" />
                <span className="text-small text-neutral-900 font-medium">No Data Storage</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="w-full tablet:w-auto min-w-[240px] h-14 bg-primary-500 text-white rounded-sm font-semibold text-body px-6 
                hover:bg-primary-600 hover:shadow-card hover:-translate-y-0.5 hover:scale-[1.02]
                active:translate-y-0 active:scale-[0.98]
                disabled:bg-neutral-200 disabled:text-neutral-500 disabled:cursor-not-allowed
                transition-all duration-fast ease-out"
            >
              {isStarting ? 'Starting...' : 'Start Consultation'}
            </button>
          </div>

          {/* How It Works */}
          <div className="mt-16 grid grid-cols-1 tablet:grid-cols-3 gap-8">
            <div className="text-left">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary-500 font-bold text-body-lg">1</span>
              </div>
              <h3 className="text-subtitle text-neutral-900 font-semibold mb-2">Create Room</h3>
              <p className="text-body text-neutral-700">
                Generate a secure consultation room with a unique, unguessable link.
              </p>
            </div>
            
            <div className="text-left">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary-500 font-bold text-body-lg">2</span>
              </div>
              <h3 className="text-subtitle text-neutral-900 font-semibold mb-2">Share Link</h3>
              <p className="text-body text-neutral-700">
                Send the room link to your patient via secure messaging or email.
              </p>
            </div>
            
            <div className="text-left">
              <div className="w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-primary-500 font-bold text-body-lg">3</span>
              </div>
              <h3 className="text-subtitle text-neutral-900 font-semibold mb-2">Connect</h3>
              <p className="text-body text-neutral-700">
                Join the video call with secure, peer-to-peer encrypted communication.
              </p>
            </div>
          </div>

          {/* Security Info */}
          <div className="mt-16 bg-neutral-50 rounded-md p-8 text-left">
            <h3 className="text-subtitle text-neutral-900 font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-6 h-6 text-primary-500" />
              Security & Privacy
            </h3>
            <div className="space-y-3 text-body text-neutral-700">
              <p>
                All video and audio streams are encrypted with DTLS/SRTP protocols, ensuring secure peer-to-peer communication.
              </p>
              <p>
                Your consultation room expires automatically after 6 hours, and no video data is stored on our servers.
              </p>
              <p>
                This platform complies with HIPAA security requirements for protecting electronic protected health information (ePHI).
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-small text-neutral-500">
            By using this service, you agree to our Privacy Policy and Terms of Service.
          </p>
        </div>
      </footer>
    </div>
  );
};
