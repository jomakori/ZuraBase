import React from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import WhatsAppLoginButton from "./WhatsAppLoginButton";

interface ImportIntegrationsSectionProps {
  isLinked?: boolean;
  whatsappName?: string;
  onLogin?: () => void;
}

/**
 * ImportIntegrationsSection — centralized import zone for Strands
 * Includes WhatsApp, and future integrations
 */
const ImportIntegrationsSection: React.FC<ImportIntegrationsSectionProps> = ({
  isLinked = false,
  whatsappName,
  onLogin,
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>📥</span> Import
        </h2>
        <span className="text-sm text-gray-500">
          Connect and sync your external accounts
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {isLinked ? (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-green-50 border border-green-200 px-4 py-2 rounded-md">
            <WhatsappLogo size={20} className="text-[#25D366]" />
            Synced&nbsp;w/&nbsp;
            <span className="font-semibold text-gray-800">
              {whatsappName || "WhatsApp User"}
            </span>
          </div>
        ) : (
          <WhatsAppLoginButton variant="dark" onClick={onLogin} />
        )}

        {/* Placeholder for future integrations */}
        <p className="text-xs text-gray-400">
          More import integrations (Emails, Telegram, Notion) coming soon.
        </p>
      </div>
    </div>
  );
};

export default ImportIntegrationsSection;
