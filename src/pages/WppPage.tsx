import React from "react";
import { WppQrConnect } from "../components/WppQrConnect";

export const WppPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Tarjeta principal: QR */}
      <WppQrConnect endpoint="https://n8n.alliasoft.com/webhook/wiltech/wpp" />


    </div>
  );
};
