import React from "react";
import { WhatsappLogo } from "@phosphor-icons/react";

/**
 * WhatsAppLoginButton — simple adaptive "Sign in with WhatsApp" button
 * Based on WhatsApp design standards
 */
interface WhatsAppLoginButtonProps {
  variant?: "light" | "dark";
  onClick?: () => void;
}

const WhatsAppLoginButton: React.FC<WhatsAppLoginButtonProps> = ({
  variant = "dark",
  onClick,
}) => {
  const isLight = variant === "light";

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-semibold transition-all duration-200 ${
        isLight
          ? "bg-white text-gray-800 border border-gray-300 hover:bg-gray-100"
          : "bg-[#25D366] text-white hover:bg-[#20b355]"
      }`}
      style={{ boxShadow: isLight ? "0 1px 2px rgba(0,0,0,0.1)" : "none" }}
    >
      <WhatsappLogo
        size={22}
        weight="fill"
        className={isLight ? "text-[#25D366]" : "text-white"}
      />
      Sign in with WhatsApp
    </button>
  );
};

export default WhatsAppLoginButton;
